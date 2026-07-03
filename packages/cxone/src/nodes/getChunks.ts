import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from "axios";
import { ICxoneAuthCache } from "../lib/cxoneAuth";

const RETRIEVAL_PATH = "/eai-knowledge-hub-services/retrieval-service/v1/retrieve";

interface ICleanChunk {
	title: string;
	content: string;
	relevance_percent: string;
}

interface ICleanOutput {
	success: boolean;
	message: string;
	content: ICleanChunk[];
}

export interface IGetChunksParams extends INodeFunctionBaseParams {
	config: {
		// Auth
		cacheStorageType: "context" | "input";
		cacheKey: string;
		// Query
		knowledgehubId: string;
		queryText: string;
		numberOfResults: number;
		filter?: object;
		// Raw output
		writeRawOutput: boolean;
		storageType: "context" | "input";
		storageKey: string;
		// Clean output
		writeCleanOutput: boolean;
		cleanStorageType: "context" | "input";
		cleanStorageKey: string;
	};
}

export const getChunks = createNodeDescriptor({
	type: "getChunks",
	defaultLabel: "Get Chunks",
	summary: "Retrieve knowledge chunks from the CXone Knowledge Hub retrieval service",
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
		// --- Query ---
		{
			key: "knowledgehubId",
			label: "Knowledge Hub ID",
			type: "cognigyText",
			params: { required: true }
		},
		{
			key: "queryText",
			label: "Query Text",
			type: "cognigyText",
			params: { required: true }
		},
		{
			key: "numberOfResults",
			label: "Number of Results",
			type: "number",
			defaultValue: 5,
			params: { required: true }
		},
		// --- Filter ---
		{
			key: "filter",
			label: "Filter",
			type: "json",
			description: "Optional filter object. Supports operators: equals, notEquals, greaterThan, greaterThanOrEquals, lessThan, lessThanOrEquals, in, notIn, startsWith. Combine with andAll / orAll arrays."
		},
		// --- Raw output ---
		{
			key: "writeRawOutput",
			label: "Store Full Chunk Data",
			type: "toggle",
			defaultValue: true,
			description: "Write the full API response to a key"
		},
		{
			key: "storageType",
			label: "Raw Output Location",
			type: "select",
			defaultValue: "context",
			condition: { key: "writeRawOutput", value: true },
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
			label: "Raw Output Key",
			type: "cognigyText",
			defaultValue: "chunks",
			condition: { key: "writeRawOutput", value: true },
			params: { required: true }
		},
		// --- Clean output ---
		{
			key: "writeCleanOutput",
			label: "Store Clean Content Output",
			type: "toggle",
			defaultValue: false,
			description: "Maps results to { title, content, relevance_percent } and writes to a separate key"
		},
		{
			key: "cleanStorageType",
			label: "Clean Output Location",
			type: "select",
			defaultValue: "context",
			condition: { key: "writeCleanOutput", value: true },
			params: {
				options: [
					{ label: "context", value: "context" },
					{ label: "input", value: "input" }
				],
				required: true
			}
		},
		{
			key: "cleanStorageKey",
			label: "Clean Output Key",
			type: "cognigyText",
			defaultValue: "chunksClean",
			condition: { key: "writeCleanOutput", value: true },
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
			key: "query",
			label: "Query",
			defaultCollapsed: false,
			fields: ["knowledgehubId", "queryText", "numberOfResults"]
		},
		{
			key: "filterSection",
			label: "Filter",
			defaultCollapsed: true,
			fields: ["filter"]
		},
		{
			key: "storage",
			label: "Output",
			defaultCollapsed: false,
			fields: [
				"writeRawOutput", "storageType", "storageKey",
				"writeCleanOutput", "cleanStorageType", "cleanStorageKey"
			]
		}
	],
	form: [
		{ type: "section", key: "authSection" },
		{ type: "section", key: "query" },
		{ type: "section", key: "filterSection" },
		{ type: "section", key: "storage" }
	],
	preview: {
		type: "text",
		key: "queryText"
	},
	function: async ({ cognigy, config: rawConfig }: INodeFunctionBaseParams) => {
		const { api, context, input } = cognigy;
		const {
			cacheStorageType,
			cacheKey,
			knowledgehubId,
			queryText,
			numberOfResults,
			filter,
			writeRawOutput,
			storageType,
			storageKey,
			writeCleanOutput,
			cleanStorageType,
			cleanStorageKey
		} = rawConfig as IGetChunksParams["config"];

		const log = (msg: string) => api.log("info", `CXone Get Chunks: ${msg}`);

		// Read auth cache written by Get Token node
		const cacheStore = cacheStorageType === "context" ? context : input;
		const cache: ICxoneAuthCache = (cacheStore[cacheKey] as ICxoneAuthCache) || {};

		if (!cache.token) {
			throw new Error("CXone Get Chunks: no auth token in cache — run Get Token node first");
		}
		if (!cache.apiBaseUrl) {
			throw new Error("CXone Get Chunks: apiBaseUrl missing from auth cache");
		}
		if (!cache.tenantId) {
			throw new Error("CXone Get Chunks: tenantId missing from auth cache");
		}

		// Build and send request
		const payload: Record<string, any> = {
			knowledgehubId,
			meta: { tenantId: cache.tenantId },
			query: { queryText },
			queryConfig: { numberOfResults }
		};

		if (filter && Object.keys(filter).length > 0) {
			payload.queryConfig.filter = filter;
		}

		log(`querying "${queryText}" against hub ${knowledgehubId}`);

		const response = await axios.post(`${cache.apiBaseUrl}${RETRIEVAL_PATH}`, payload, {
			headers: {
				Authorization: `Bearer ${cache.token}`,
				"Content-Type": "application/json",
				Accept: "application/json"
			}
		});

		const results = response.data;
		log("received response");

		// Raw output
		if (writeRawOutput) {
			if (storageType === "context") {
				context[storageKey] = results;
			} else {
				// @ts-ignore
				api.addToInput(storageKey, results);
			}
		}

		// Clean output
		if (writeCleanOutput) {
			const chunks: ICleanChunk[] = (results?.results ?? []).map((chunk: any) => ({
				title: chunk?.metadata?.Title ?? "",
				content: chunk?.content?.text ?? "",
				relevance_percent: `${Math.round((chunk?.score ?? 0) * 100)}%`
			}));

			const clean: ICleanOutput = {
				success: chunks.length > 0,
				message: chunks.length > 0 ? `${chunks.length} articles found` : "No relevant content found",
				content: chunks
			};

			if (cleanStorageType === "context") {
				context[cleanStorageKey] = clean;
			} else {
				// @ts-ignore
				api.addToInput(cleanStorageKey, clean);
			}

			log(`wrote clean output to ${cleanStorageType}.${cleanStorageKey} — ${clean.message}`);
		}
	}
});
