import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { getSoapClient, ISoapAuthConnection } from "../lib/soapClient";

export interface IDescribeServiceParams extends INodeFunctionBaseParams {
	config: {
		connection: ISoapAuthConnection;
		storeLocation: "context" | "input";
		contextKey: string;
		inputKey: string;
	};
}

export const describeService = createNodeDescriptor({
	type: "soap-describeService",
	defaultLabel: "Describe Service",
	summary: "Parse a WSDL and return its services, ports, and operation argument shapes",
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
			defaultValue: "soapService",
			condition: { key: "storeLocation", value: "context" }
		},
		{
			key: "inputKey",
			type: "cognigyText",
			label: "Input Key to store Result",
			defaultValue: "soapService",
			condition: { key: "storeLocation", value: "input" }
		}
	],
	sections: [
		{
			key: "storageOption",
			label: "Storage Option",
			defaultCollapsed: true,
			fields: ["storeLocation", "contextKey", "inputKey"]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "storageOption" }
	],
	appearance: {
		color: "#00618a"
	},
	preview: {
		type: "text",
		key: "contextKey"
	},
	function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
		const { api } = cognigy;
		const { connection, storeLocation, contextKey, inputKey } =
			config as IDescribeServiceParams["config"];

		api.log("info", `SOAP: describing service at ${connection.wsdlUrl}`);

		const client = await getSoapClient(connection);
		const description = client.describe();

		const result = {
			wsdlUrl: connection.wsdlUrl,
			services: description
		};

		if (storeLocation === "context") {
			api.addToContext(contextKey, result, "simple");
		} else {
			// @ts-ignore
			api.addToInput(inputKey, result);
		}
	}
});
