import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from "axios";
import { ICxoneAuthCache } from "../lib/cxoneAuth";

const SCRIPT_PATH = "/incontactapi/services/v33.0/scripts/start";

export interface IStartScriptParams extends INodeFunctionBaseParams {
	config: {
		// Auth
		cacheStorageType: "context" | "input";
		cacheKey: string;
		// Script
		skillId: string;
		scriptPath: string;
		parameters?: string;
		// Output
		storageType: "context" | "input";
		storageKey: string;
	};
}

export const startScript = createNodeDescriptor({
	type: "startScript",
	defaultLabel: "Start Script",
	summary: "Start a CXone script via the Scripts API",
	tags: ["service"],
	fields: [
		// --- Auth ---
		{
			key: "cacheStorageType",
			label: "Token Cache Location",
			type: "select",
			defaultValue: "context",
			params: {
				options: [
					{ label: "context", value: "context" },
					{ label: "input", value: "input" }
				],
				required: true
			},
			description: "Where to read the auth cache written by the Get Token node"
		},
		{
			key: "cacheKey",
			label: "Token Cache Key",
			type: "cognigyText",
			defaultValue: "cxoneToken",
			params: { required: true }
		},
		// --- Script ---
		{
			key: "skillId",
			label: "Skill ID",
			type: "cognigyText",
			params: { required: true },
			description: "The skill ID to associate with the script start"
		},
		{
			key: "scriptPath",
			label: "Script Path",
			type: "cognigyText",
			params: { required: true },
			description: "Full path to the script, e.g. Folder\\Subfolder\\Script Name"
		},
		{
			key: "parameters",
			label: "Parameters",
			type: "cognigyText",
			description: "Pipe-delimited parameter string passed as the Parameters query value, e.g. banking|send_sms|{{context.phone}}|{{context.body}}"
		},
		// --- Output ---
		{
			key: "storageType",
			label: "Store Response In",
			type: "select",
			defaultValue: "context",
			params: {
				options: [
					{ label: "context", value: "context" },
					{ label: "input", value: "input" }
				],
				required: true
			}
		},
		{
			key: "storageKey",
			label: "Storage Key",
			type: "cognigyText",
			defaultValue: "scriptResponse",
			params: { required: true }
		}
	],
	sections: [
		{
			key: "authSection",
			label: "Authentication",
			defaultCollapsed: false,
			fields: ["cacheStorageType", "cacheKey"]
		},
		{
			key: "scriptSection",
			label: "Script",
			defaultCollapsed: false,
			fields: ["skillId", "scriptPath", "parameters"]
		},
		{
			key: "outputSection",
			label: "Output",
			defaultCollapsed: false,
			fields: ["storageType", "storageKey"]
		}
	],
	form: [
		{ type: "section", key: "authSection" },
		{ type: "section", key: "scriptSection" },
		{ type: "section", key: "outputSection" }
	],
	preview: {
		type: "text",
		key: "scriptPath"
	},
	function: async ({ cognigy, config: rawConfig }: INodeFunctionBaseParams) => {
		const { api, context, input } = cognigy;
		const {
			cacheStorageType,
			cacheKey,
			skillId,
			scriptPath,
			parameters,
			storageType,
			storageKey
		} = rawConfig as IStartScriptParams["config"];

		const log = (msg: string) => api.log("debug", `CXone Start Script: ${msg}`);

		// Read auth cache written by Get Token node
		const cacheStore = cacheStorageType === "context" ? context : input;
		const cache: ICxoneAuthCache = (cacheStore[cacheKey] as ICxoneAuthCache) || {};

		log(`cache key: ${cacheKey}, storage: ${cacheStorageType}`);
		log(`cache contents: ${JSON.stringify({ token: cache.token ? "[present]" : "[missing]", apiBaseUrl: cache.apiBaseUrl, tenantId: cache.tenantId })}`);

		if (!cache.token) {
			throw new Error("CXone Start Script: no auth token in cache — run Get Token node first");
		}
		if (!cache.apiBaseUrl) {
			throw new Error("CXone Start Script: apiBaseUrl missing from auth cache");
		}

		// Build query string — scriptPath and Parameters are URL-encoded
		const queryParts: string[] = [
			`skillId=${skillId}`,
			`scriptPath=${encodeURIComponent(scriptPath)}`
		];

		if (parameters && parameters.trim() !== "") {
			queryParts.push(`Parameters=${encodeURIComponent(parameters)}`);
		}

		const url = `${cache.apiBaseUrl}${SCRIPT_PATH}?${queryParts.join("&")}`;

		log(`skillId: ${skillId}`);
		log(`scriptPath (raw): ${scriptPath}`);
		log(`scriptPath (encoded): ${encodeURIComponent(scriptPath)}`);
		log(`parameters (raw): ${parameters ?? "(none)"}`);
		log(`parameters (encoded): ${parameters ? encodeURIComponent(parameters) : "(none)"}`);
		log(`full URL: ${url}`);
		log(`token (first 20 chars): ${cache.token.substring(0, 20)}...`);

		const response = await axios.post(url, {}, {
			headers: {
				Authorization: `Bearer ${cache.token}`,
				Accept: "application/json"
			}
		});

		log(`response status: ${response.status}`);
		log(`response data: ${JSON.stringify(response.data)}`);

		const result = response.data || {};

		if (storageType === "context") {
			context[storageKey] = result;
		} else {
			// @ts-ignore
			api.addToInput(storageKey, result);
		}

		log(`response stored in ${storageType}.${storageKey}`);
	}
});
