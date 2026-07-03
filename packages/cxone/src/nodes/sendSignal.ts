import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from "axios";
import { ICxoneAuthCache } from "../lib/cxoneAuth";

const SIGNAL_PATH = "/incontactapi/services/v33.0/interactions";

export interface ISendSignalParams extends INodeFunctionBaseParams {
	config: {
		// Auth
		cacheStorageType: "context" | "input";
		cacheKey: string;
		// Signal
		contactId: string;
		p1?: string;
		p2?: string;
		p3?: string;
		p4?: string;
		p5?: string;
		p6?: string;
		p7?: string;
		p8?: string;
		p9?: string;
		// Output
		storageType: "context" | "input";
		storageKey: string;
	};
}

export const sendSignal = createNodeDescriptor({
	type: "sendSignal",
	defaultLabel: "Send Signal",
	summary: "Send a CXone Signal API call to an active interaction",
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
		// --- Signal ---
		{
			key: "contactId",
			label: "Contact ID",
			type: "cognigyText",
			params: { required: true },
			description: "The active interaction / contact ID to signal"
		},
		{
			key: "p1",
			label: "p1",
			type: "cognigyText",
			description: "Optional signal parameter 1"
		},
		{
			key: "p2",
			label: "p2",
			type: "cognigyText",
			description: "Optional signal parameter 2"
		},
		{
			key: "p3",
			label: "p3",
			type: "cognigyText",
			description: "Optional signal parameter 3"
		},
		{
			key: "p4",
			label: "p4",
			type: "cognigyText",
			description: "Optional signal parameter 4"
		},
		{
			key: "p5",
			label: "p5",
			type: "cognigyText",
			description: "Optional signal parameter 5"
		},
		{
			key: "p6",
			label: "p6",
			type: "cognigyText",
			description: "Optional signal parameter 6"
		},
		{
			key: "p7",
			label: "p7",
			type: "cognigyText",
			description: "Optional signal parameter 7"
		},
		{
			key: "p8",
			label: "p8",
			type: "cognigyText",
			description: "Optional signal parameter 8"
		},
		{
			key: "p9",
			label: "p9",
			type: "cognigyText",
			description: "Optional signal parameter 9"
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
			defaultValue: "signalResponse",
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
			key: "signalSection",
			label: "Signal",
			defaultCollapsed: false,
			fields: ["contactId"]
		},
		{
			key: "parametersSection",
			label: "Parameters (p1–p9)",
			defaultCollapsed: true,
			fields: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"]
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
		{ type: "section", key: "signalSection" },
		{ type: "section", key: "parametersSection" },
		{ type: "section", key: "outputSection" }
	],
	preview: {
		type: "text",
		key: "contactId"
	},
	function: async ({ cognigy, config: rawConfig }: INodeFunctionBaseParams) => {
		const { api, context, input } = cognigy;
		const {
			cacheStorageType,
			cacheKey,
			contactId,
			p1, p2, p3, p4, p5, p6, p7, p8, p9,
			storageType,
			storageKey
		} = rawConfig as ISendSignalParams["config"];

		const log = (msg: string) => api.log("info", `CXone Send Signal: ${msg}`);

		// Read auth cache written by Get Token node
		const cacheStore = cacheStorageType === "context" ? context : input;
		const cache: ICxoneAuthCache = (cacheStore[cacheKey] as ICxoneAuthCache) || {};

		if (!cache.token) {
			throw new Error("CXone Send Signal: no auth token in cache — run Get Token node first");
		}
		if (!cache.apiBaseUrl) {
			throw new Error("CXone Send Signal: apiBaseUrl missing from auth cache");
		}

		// Build signal URL with optional query parameters
		const baseUrl = `${cache.apiBaseUrl}${SIGNAL_PATH}/${contactId}/signal`;
		const paramValues = [p1, p2, p3, p4, p5, p6, p7, p8, p9];
		const queryParts = paramValues
			.map((v, i) => (v && v.trim() !== "" ? `p${i + 1}=${encodeURIComponent(v)}` : null))
			.filter(Boolean);

		const url = queryParts.length > 0 ? `${baseUrl}?${queryParts.join("&")}` : baseUrl;

		log(`signalling contact ${contactId}`);

		const response = await axios.post(url, {}, {
			headers: {
				Authorization: `Bearer ${cache.token}`,
				Accept: "application/json"
			}
		});

		const result = response.data || {};
		log("signal sent");

		if (storageType === "context") {
			context[storageKey] = result;
		} else {
			// @ts-ignore
			api.addToInput(storageKey, result);
		}
	}
});
