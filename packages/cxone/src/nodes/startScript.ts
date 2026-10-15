import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from "axios";
import { assertNumericId, callCxone, ICxoneCredentials, REQUEST_TIMEOUT_MS } from "../lib/cxoneAuth";

const SCRIPT_PATH = "/incontactapi/services/v33.0/scripts/start";

export interface IStartScriptParams extends INodeFunctionBaseParams {
	config: {
		// Auth
		authConnection: ICxoneCredentials;
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
			key: "authConnection",
			label: "CXone Auth",
			type: "connection",
			params: {
				connectionType: "cxone-auth",
				required: true
			},
			description: "Authentication is handled automatically and cached per environment, client and user"
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
			fields: ["authConnection"]
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
			authConnection,
			skillId,
			scriptPath,
			parameters,
			storageType,
			storageKey
		} = rawConfig as IStartScriptParams["config"];

		const log = (msg: string) => api.log("info", `CXone Start Script: ${msg}`);

		const data = await callCxone({
			cognigy,
			node: "Start Script",
			creds: authConnection,
			validate: () => assertNumericId(skillId, "Skill ID"),
			request: (cache) => {
				const queryParts: string[] = [
					`skillId=${skillId.trim()}`,
					`scriptPath=${encodeURIComponent(scriptPath)}`
				];

				if (parameters && parameters.trim() !== "") {
					queryParts.push(`Parameters=${encodeURIComponent(parameters)}`);
				}

				log(`starting script ${scriptPath} on skill ${skillId}`);

				return axios.post(`${cache.apiBaseUrl}${SCRIPT_PATH}?${queryParts.join("&")}`, {}, {
					timeout: REQUEST_TIMEOUT_MS,
					headers: {
						Authorization: `Bearer ${cache.token}`,
						Accept: "application/json"
					}
				});
			}
		});

		const result = data || {};

		if (storageType === "context") {
			context[storageKey] = result;
		} else {
			// @ts-ignore
			api.addToInput(storageKey, result);
		}

	}
});
