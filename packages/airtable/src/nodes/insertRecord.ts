import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from "axios";

export interface IInsertRecordParams extends INodeFunctionBaseParams {
	config: {
		connection: {
			accessToken: string;
		};
		baseId: string;
		tableName: string;
		recordFields: any;
		storeLocation: string;
		inputKey: string;
		contextKey: string;
	};
}

export const insertRecordNode = createNodeDescriptor({
	type: "airtable-insert-record",
	defaultLabel: "Insert Record",
	preview: {
		key: "tableName",
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
			key: "tableName",
			label: "Table Name",
			type: "cognigyText",
			description: "The name of the table to insert into",
			params: {
				required: true
			}
		},
		{
			key: "recordFields",
			label: "Record Fields",
			type: "json",
			description: "JSON object containing the field names and values for the new record",
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
			defaultValue: "airtableInsertResult",
			condition: {
				key: "storeLocation",
				value: "input"
			}
		},
		{
			key: "contextKey",
			type: "cognigyText",
			label: "Context Key to store Result",
			defaultValue: "airtableInsertResult",
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
		{ type: "field", key: "tableName" },
		{ type: "field", key: "recordFields" },
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
			tableName,
			recordFields,
			storeLocation,
			inputKey,
			contextKey
		} = config as IInsertRecordParams["config"];

		// Start logging
		api.log("info", `Insert Record - Base: ${baseId}, Table: ${tableName}`);

		const fieldCount = recordFields ? Object.keys(recordFields).length : 0;
		api.log("debug", `Inserting record with ${fieldCount} fields`);

		try {
			const response = await axios.post(
				`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
				{
					fields: recordFields
				},
				{
					headers: {
						Authorization: `Bearer ${connection.accessToken}`,
						"Content-Type": "application/json"
					}
				}
			);

			const result = {
				success: true,
				record: response.data,
				id: response.data.id,
				createdTime: response.data.createdTime
			};

			api.log("info", `Record created - ID: ${response.data.id}`);

			if (storeLocation === "context") {
				api.addToContext(contextKey, result, "simple");
			} else {
				// @ts-ignore
				api.addToInput(inputKey, result);
			}

		} catch (error: any) {
			api.log("error", `Error inserting record - Status: ${error.response?.status || "N/A"}, Message: ${error.response?.data?.error?.message || error.message}`);

			const errorMessage = error.response?.data?.error?.message || error.message || "Unknown error occurred";
			const errorResult = {
				success: false,
				error: true,
				message: errorMessage,
				status: error.response?.status,
				type: error.response?.data?.error?.type
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
