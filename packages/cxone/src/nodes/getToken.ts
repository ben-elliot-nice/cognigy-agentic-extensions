import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { ensureCxoneAuth, ICxoneAuthCache } from "../lib/cxoneAuth";

export interface IGetTokenParams extends INodeFunctionBaseParams {
	config: {
		authConnection: {
			clientId: string;
			clientSecret: string;
			cxoneUsername: string;
			cxonePassword: string;
		};
		storageType: "context" | "input";
		storageKey: string;
	};
}

export const getToken = createNodeDescriptor({
	type: "getToken",
	defaultLabel: "Get Token",
	summary: "Authenticate with CXone and cache the token, tenant ID, and API base URL",
	tags: ["service"],
	fields: [
		{
			key: "authConnection",
			label: "CXone Auth",
			type: "connection",
			params: {
				connectionType: "cxone-auth",
				required: true
			}
		},
		{
			key: "storageType",
			label: "Store In",
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
			defaultValue: "cxoneToken",
			params: { required: true },
			description: "Key under which the auth cache object is stored. Contains: token, tenantId, apiBaseUrl, tokenEndpoint."
		}
	],
	sections: [
		{
			key: "auth",
			label: "Authentication",
			defaultCollapsed: false,
			fields: ["authConnection"]
		},
		{
			key: "storage",
			label: "Storage",
			defaultCollapsed: false,
			fields: ["storageType", "storageKey"]
		}
	],
	form: [
		{ type: "section", key: "auth" },
		{ type: "section", key: "storage" }
	],
	preview: {
		type: "text",
		key: "storageKey"
	},
	function: async ({ cognigy, config: rawConfig }: INodeFunctionBaseParams) => {
		const { api, context, input } = cognigy;
		const { authConnection, storageType, storageKey } = rawConfig as IGetTokenParams["config"];

		const store = storageType === "context" ? context : input;
		const cache: ICxoneAuthCache = (store[storageKey] as ICxoneAuthCache) || {};

		await ensureCxoneAuth(cache, authConnection, (msg) => api.log("info", `CXone: ${msg}`));

		if (storageType === "context") {
			context[storageKey] = cache;
		} else {
			// @ts-ignore
			api.addToInput(storageKey, cache);
		}
	}
});
