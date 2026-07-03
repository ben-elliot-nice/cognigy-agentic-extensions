import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from "axios";

export interface IGetTableSchemaParams extends INodeFunctionBaseParams {
	config: {
		connection: {
			accessToken: string;
		};
		baseId: string;
		tableId: string;
		storeLocation: string;
		inputKey: string;
		contextKey: string;
	};
}

export const getTableSchemaNode = createNodeDescriptor({
	type: "airtable-get-table-schema",
	defaultLabel: "Get Table Schema",
	preview: {
		key: "baseId",
		type: "text"
	},
	fields: [
		{
			key: "connection",
			label: "Airtable Connection",
			type: "connection",
			params: {
				connectionType: "airtable-token",
				required: true
			}
		},
		{
			key: "baseId",
			label: "Base ID",
			type: "cognigyText",
			description: "The Airtable base ID (found in the URL: app...)",
			params: {
				required: true
			}
		},
		{
			key: "tableId",
			label: "Table ID",
			type: "cognigyText",
			description: "The Airtable table ID (e.g., tbl...)",
			params: {
				required: true
			}
		},
		{
			key: "storeLocation",
			type: "select",
			label: "Where to store the result",
			params: {
				options: [
					{
						label: "Input",
						value: "input"
					},
					{
						label: "Context",
						value: "context"
					}
				],
				required: true
			},
			defaultValue: "context"
		},
		{
			key: "inputKey",
			type: "cognigyText",
			label: "Input Key to store Result",
			defaultValue: "airtableSchema",
			condition: {
				key: "storeLocation",
				value: "input"
			}
		},
		{
			key: "contextKey",
			type: "cognigyText",
			label: "Context Key to store Result",
			defaultValue: "airtableSchema",
			condition: {
				key: "storeLocation",
				value: "context"
			}
		}
	],
	sections: [
		{
			key: "storageOption",
			label: "Storage Option",
			defaultCollapsed: true,
			fields: [
				"storeLocation",
				"inputKey",
				"contextKey"
			]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "field", key: "baseId" },
		{ type: "field", key: "tableId" },
		{ type: "section", key: "storageOption" }
	],
	appearance: {
		color: "#ffb100"
	},
	function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
		const { api } = cognigy;
		const {
			connection,
			baseId,
			tableId,
			storeLocation,
			inputKey,
			contextKey
		} = config as IGetTableSchemaParams["config"];

		// Start logging
		api.log("info", `Get Table Schema - Base: ${baseId}, Table ID: ${tableId}`);

		try {
			const response = await axios.get(
				`https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
				{
					headers: {
						Authorization: `Bearer ${connection.accessToken}`,
						"Content-Type": "application/json"
					}
				}
			);

			// Filter by table ID
			const tables = response.data.tables.filter((t: any) => t.id === tableId);

			if (tables.length === 0) {
				api.log("error", `Table with ID "${tableId}" not found in base ${baseId}`);
				const notFoundResult = {
					error: true,
					message: `Table with ID "${tableId}" not found`,
					status: 404
				};

				if (storeLocation === "context") {
					api.addToContext(contextKey, notFoundResult, "simple");
				} else {
					// @ts-ignore
					api.addToInput(inputKey, notFoundResult);
				}
				return;
			}

			api.log("info", `Retrieved schema for table "${tables[0].name}" with ${tables[0].fields?.length || 0} fields`);

			// Build result with useful information
			const result = {
				table: {
					id: tables[0].id,
					name: tables[0].name,
					description: tables[0].description || null,
					fieldCount: tables[0].fields?.length || 0,
					fields: tables[0].fields?.map((field: any) => ({
						id: field.id,
						name: field.name,
						type: field.type,
						description: field.description || null,
						options: field.options || null
					})) || []
				}
			};

			// Log field details
			tables[0].fields?.forEach((field: any) => {
				api.log("debug", `  - ${field.name} (${field.type})`);
			});

			if (storeLocation === "context") {
				api.addToContext(contextKey, result, "simple");
			} else {
				// @ts-ignore
				api.addToInput(inputKey, result);
			}

		} catch (error: any) {
			api.log("error", `Error retrieving table schema - Status: ${error.response?.status || "N/A"}, Message: ${error.response?.data?.error?.message || error.message}`);

			const errorMessage = error.response?.data?.error?.message || error.message || "Unknown error occurred";
			const errorResult = {
				error: true,
				message: errorMessage,
				status: error.response?.status
			};

			if (storeLocation === "context") {
				api.addToContext(contextKey, errorResult, "simple");
			} else {
				// @ts-ignore
				api.addToInput(inputKey, errorResult);
			}
		}
	}
});
