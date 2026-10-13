import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { extractSoapFault, getSoapClient, ISoapAuthConnection } from "../lib/soapClient";

export interface ICallOperationParams extends INodeFunctionBaseParams {
	config: {
		connection: ISoapAuthConnection;
		operation: string;
		args: Record<string, unknown>;
		storeLocation: "context" | "input";
		contextKey: string;
		inputKey: string;
	};
}

export const callOperation = createNodeDescriptor({
	type: "soap-callOperation",
	defaultLabel: "Call Operation",
	summary: "Invoke a SOAP operation by name with JSON arguments",
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
			key: "operation",
			label: "Operation Name",
			type: "cognigyText",
			description: "The SOAP operation to invoke, exactly as returned by Describe Service (e.g. GetUserDetails)",
			params: { required: true }
		},
		{
			key: "args",
			label: "Arguments",
			type: "json",
			description: "JSON object of arguments matching the operation's expected input shape",
			defaultValue: {},
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
			defaultValue: "soapResult",
			condition: { key: "storeLocation", value: "context" }
		},
		{
			key: "inputKey",
			type: "cognigyText",
			label: "Input Key to store Result",
			defaultValue: "soapResult",
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
		{ type: "field", key: "operation" },
		{ type: "field", key: "args" },
		{ type: "section", key: "storageOption" }
	],
	appearance: {
		color: "#00618a"
	},
	dependencies: {
		children: ["soap-success", "soap-fault", "soap-error"]
	},
	preview: {
		type: "text",
		key: "operation"
	},
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api } = cognigy;
		const { connection, operation, args, storeLocation, contextKey, inputKey } =
			config as ICallOperationParams["config"];

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

		api.log("info", `SOAP: calling operation "${operation}" at ${connection.wsdlUrl}`);

		try {
			const client = await getSoapClient(connection);
			const method = client[`${operation}Async`];

			if (typeof method !== "function") {
				store({ error: true, message: `Operation "${operation}" was not found on the described service` });
				routeTo("soap-error");
				return;
			}

			const [result, rawResponse] = await method.call(client, args);

			api.log("info", `SOAP: routing to soap-success for operation "${operation}"`);
			store({ result, rawResponse });
			routeTo("soap-success");

		} catch (error: any) {
			const fault = extractSoapFault(error);

			if (fault) {
				api.log("info", `SOAP: routing to soap-fault for operation "${operation}" (${fault.faultstring})`);
				store({ fault });
				routeTo("soap-fault");
				return;
			}

			api.log("error", `SOAP: error calling operation "${operation}" - ${error.message}`);
			store({ error: true, message: error.message });
			routeTo("soap-error");
		}
	}
});

export const soapSuccessNode = createNodeDescriptor({
	type: "soap-success",
	parentType: "soap-callOperation",
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

export const soapFaultNode = createNodeDescriptor({
	type: "soap-fault",
	parentType: "soap-callOperation",
	defaultLabel: "SOAP Fault",
	appearance: { color: "#f39c12", textColor: "white", variant: "mini" },
	constraints: {
		editable: false,
		deletable: true,
		collapsable: true,
		creatable: true,
		movable: false,
		placement: { predecessor: { whitelist: [] } }
	}
});

export const soapErrorNode = createNodeDescriptor({
	type: "soap-error",
	parentType: "soap-callOperation",
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
