import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from "axios";

export interface IRawXmlCallParams extends INodeFunctionBaseParams {
	config: {
		connection: {
			wsdlUrl: string;
			username?: string;
			password?: string;
			customHeadersJson?: string;
		};
		endpointUrl: string;
		soapAction: string;
		envelope: string;
		soapVersion: "1.1" | "1.2";
		storeLocation: "context" | "input";
		contextKey: string;
		inputKey: string;
	};
}

export const rawXmlCall = createNodeDescriptor({
	type: "soap-rawXmlCall",
	defaultLabel: "Raw XML Call",
	summary: "POST a hand-built SOAP envelope directly — bypasses WSDL-derived argument mapping",
	tags: ["service"],
	fields: [
		{
			key: "connection",
			label: "SOAP Connection",
			type: "connection",
			params: {
				connectionType: "soap-auth",
				required: true
			}
		},
		{
			key: "endpointUrl",
			label: "Endpoint URL",
			type: "cognigyText",
			description: "The SOAP service endpoint to POST to (overrides the connection's WSDL URL)",
			params: { required: true }
		},
		{
			key: "soapAction",
			label: "SOAPAction",
			type: "cognigyText",
			description: "Value for the SOAPAction header (leave empty if the service doesn't require one)"
		},
		{
			key: "soapVersion",
			label: "SOAP Version",
			type: "select",
			defaultValue: "1.1",
			params: {
				options: [
					{ label: "1.1", value: "1.1" },
					{ label: "1.2", value: "1.2" }
				],
				required: true
			}
		},
		{
			key: "envelope",
			label: "SOAP Envelope (XML)",
			type: "cognigyText",
			description: "The full <soap:Envelope>...</soap:Envelope> request body",
			params: { required: true }
		},
		{
			key: "storeLocation",
			type: "select",
			label: "Where to store the result",
			params: {
				options: [
					{ label: "Input", value: "input" },
					{ label: "Context", value: "context" }
				],
				required: true
			},
			defaultValue: "context"
		},
		{
			key: "contextKey",
			type: "cognigyText",
			label: "Context Key to store Result",
			defaultValue: "soapRawResult",
			condition: { key: "storeLocation", value: "context" }
		},
		{
			key: "inputKey",
			type: "cognigyText",
			label: "Input Key to store Result",
			defaultValue: "soapRawResult",
			condition: { key: "storeLocation", value: "input" }
		}
	],
	sections: [
		{
			key: "requestOptions",
			label: "Request Options",
			defaultCollapsed: false,
			fields: ["soapAction", "soapVersion", "envelope"]
		},
		{
			key: "storageOption",
			label: "Storage Option",
			defaultCollapsed: true,
			fields: ["storeLocation", "contextKey", "inputKey"]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "field", key: "endpointUrl" },
		{ type: "section", key: "requestOptions" },
		{ type: "section", key: "storageOption" }
	],
	appearance: {
		color: "#546e7a"
	},
	dependencies: {
		children: ["soap-raw-success", "soap-raw-error"]
	},
	preview: {
		type: "text",
		key: "endpointUrl"
	},
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api } = cognigy;
		const {
			connection,
			endpointUrl,
			soapAction,
			envelope,
			soapVersion,
			storeLocation,
			contextKey,
			inputKey
		} = config as IRawXmlCallParams["config"];

		const store = (value: unknown) => {
			if (storeLocation === "context") {
				api.addToContext(contextKey, value, "simple");
			} else {
				// @ts-ignore
				api.addToInput(inputKey, value);
			}
		};

		const routeTo = (childType: string) => {
			const child = childConfigs.find(c => c.type === childType);
			if (child) api.setNextNode(child.id);
		};

		const body = envelope;

		const contentType = soapVersion === "1.2"
			? `application/soap+xml; charset=utf-8${soapAction ? `; action="${soapAction}"` : ""}`
			: "text/xml; charset=utf-8";

		const headers: Record<string, string> = { "Content-Type": contentType };

		if (soapVersion === "1.1" && soapAction) {
			headers.SOAPAction = `"${soapAction}"`;
		}

		if (connection.username && connection.password) {
			const basicAuth = Buffer.from(`${connection.username}:${connection.password}`).toString("base64");
			headers.Authorization = `Basic ${basicAuth}`;
		}

		if (connection.customHeadersJson) {
			try {
				Object.assign(headers, JSON.parse(connection.customHeadersJson));
			} catch {
				api.log("error", "SOAP: connection customHeadersJson is not valid JSON — ignoring");
			}
		}

		api.log("info", `SOAP: raw XML POST to ${endpointUrl}`);

		try {
			const response = await axios.post(endpointUrl, body, { headers });

			api.log("info", "SOAP: routing to soap-raw-success");
			store({ status: response.status, body: response.data });
			routeTo("soap-raw-success");

		} catch (error: any) {
			api.log("error", `SOAP: raw XML call failed - ${error.message}`);
			store({
				error: true,
				status: error.response?.status,
				body: error.response?.data,
				message: error.message
			});
			routeTo("soap-raw-error");
		}
	}
});

export const soapRawSuccessNode = createNodeDescriptor({
	type: "soap-raw-success",
	parentType: "soap-rawXmlCall",
	defaultLabel: "Success",
	appearance: { color: "#2ecc71", textColor: "white", variant: "mini" },
	constraints: {
		editable: false,
		deletable: true,
		collapsable: true,
		creatable: true,
		movable: false,
		placement: { predecessor: { whitelist: [] } }
	}
});

export const soapRawErrorNode = createNodeDescriptor({
	type: "soap-raw-error",
	parentType: "soap-rawXmlCall",
	defaultLabel: "Error",
	appearance: { color: "#e74c3c", textColor: "white", variant: "mini" },
	constraints: {
		editable: false,
		deletable: true,
		collapsable: true,
		creatable: true,
		movable: false,
		placement: { predecessor: { whitelist: [] } }
	}
});
