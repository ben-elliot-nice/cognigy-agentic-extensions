import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from "axios";

export interface IUpsertRecordParams extends INodeFunctionBaseParams {
	config: {
		connection: {
			accessToken: string;
		};
		baseId: string;
		tableName: string;
		searchField: string;
		searchValue: string;
		createIfNotFound: boolean;
		fields: any;
		storeLocation: string;
		inputKey: string;
		contextKey: string;
	};
}

export const upsertRecordNode = createNodeDescriptor({
	type: "airtable-upsert-record",
	defaultLabel: "Upsert Record",
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
			description: "The name of the table to upsert into",
			params: {
				required: true
			}
		},
		{
			key: "searchField",
			label: "Search Field",
			type: "cognigyText",
			description: "The field name to search by (e.g., Email, ID, Name)",
			params: {
				required: true
			}
		},
		{
			key: "searchValue",
			label: "Search Value",
			type: "cognigyText",
			description: "The value to search for",
			params: {
				required: true
			}
		},
		{
			key: "createIfNotFound",
			label: "Create if Not Found",
			type: "toggle",
			description: "If enabled, creates a new record when not found. If disabled, returns Not Found error.",
			defaultValue: true
		},
		{
			key: "fields",
			label: "Fields to Update/Insert",
			type: "json",
			description: "JSON object containing field names and values to update or insert",
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
			defaultValue: "airtableUpsertResult",
			condition: {
				key: "storeLocation",
				value: "input"
			}
		},
		{
			key: "contextKey",
			type: "cognigyText",
			label: "Context Key to store Result",
			defaultValue: "airtableUpsertResult",
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
		{ type: "field", key: "searchField" },
		{ type: "field", key: "searchValue" },
		{ type: "field", key: "createIfNotFound" },
		{ type: "field", key: "fields" },
		{ type: "section", key: "storageOption" }
	],
	appearance: {
		color: "#ffb100"
	},
	dependencies: {
		children: ["upsertSuccess", "upsertNotFound", "upsertError"]
	},
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api } = cognigy;
		const {
			connection,
			baseId,
			tableName,
			searchField,
			searchValue,
			createIfNotFound,
			fields,
			storeLocation,
			inputKey,
			contextKey
		} = config as IUpsertRecordParams["config"];

		// Start logging
		api.log("info", `Upsert Record - Base: ${baseId}, Table: ${tableName}, Search: {${searchField}} = "${searchValue}", Create if not found: ${createIfNotFound}`);

		try {
			// Step 1: Search for the record
			const searchParams = {
				filterByFormula: `{${searchField}} = "${searchValue}"`
			};

			const searchResponse = await axios.get(
				`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
				{
					headers: {
						Authorization: `Bearer ${connection.accessToken}`,
						"Content-Type": "application/json"
					},
					params: searchParams
				}
			);

			const records = searchResponse.data.records;

			api.log("debug", `Found ${records.length} matching records`);

			// Step 2: Determine action based on search results
			if (records.length === 0) {
				// Record not found
				if (createIfNotFound) {
					// Create new record
					api.log("info", "Creating new record");
					const createResponse = await axios.post(
						`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
						{
							fields
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
						created: true,
						record: createResponse.data
					};

					api.log("info", `Record created - ID: ${createResponse.data.id}`);

					if (storeLocation === "context") {
						api.addToContext(contextKey, result, "simple");
					} else {
						// @ts-ignore
						api.addToInput(inputKey, result);
					}

					const successChild = childConfigs.find(child => child.type === "upsertSuccess");
					if (successChild) api.setNextNode(successChild.id);
				} else {
					// createIfNotFound is false, return not found
					api.log("info", "Record not found and createIfNotFound is false");
					const notFoundResult = {
						success: false,
						notFound: true,
						message: `Record not found with ${searchField} = "${searchValue}"`,
						searchField,
						searchValue
					};

					if (storeLocation === "context") {
						api.addToContext(contextKey, notFoundResult, "simple");
					} else {
						// @ts-ignore
						api.addToInput(inputKey, notFoundResult);
					}

					const notFoundChild = childConfigs.find(child => child.type === "upsertNotFound");
					if (notFoundChild) api.setNextNode(notFoundChild.id);
				}
			} else if (records.length === 1) {
				// Record found - update it
				const recordId = records[0].id;

				api.log("info", `Updating existing record - ID: ${recordId}`);

				const updateResponse = await axios.patch(
					`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`,
					{
						fields
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
					updated: true,
					record: updateResponse.data
				};

				api.log("info", `Record updated - ID: ${updateResponse.data.id}`);

				if (storeLocation === "context") {
					api.addToContext(contextKey, result, "simple");
				} else {
					// @ts-ignore
					api.addToInput(inputKey, result);
				}

				const successChild = childConfigs.find(child => child.type === "upsertSuccess");
				if (successChild) api.setNextNode(successChild.id);
			} else {
				// Multiple records found
				api.log("error", `Error: Multiple records found (${records.length}), cannot upsert`);
				const errorResult = {
					success: false,
					error: true,
					message: `Multiple records found (${records.length}) with ${searchField} = "${searchValue}". Cannot upsert.`,
					count: records.length,
					searchField,
					searchValue
				};

				if (storeLocation === "context") {
					api.addToContext(contextKey, errorResult, "simple");
				} else {
					// @ts-ignore
					api.addToInput(inputKey, errorResult);
				}

				const errorChild = childConfigs.find(child => child.type === "upsertError");
				if (errorChild) api.setNextNode(errorChild.id);
			}

		} catch (error: any) {
			api.log("error", `Error during upsert - Status: ${error.response?.status || "N/A"}, Message: ${error.response?.data?.error?.message || error.message}`);

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

			const errorChild = childConfigs.find(child => child.type === "upsertError");
			if (errorChild) api.setNextNode(errorChild.id);
		}
	}
});

// Child node definitions
export const upsertSuccessNode = createNodeDescriptor({
	type: "upsertSuccess",
	parentType: "airtable-upsert-record",
	defaultLabel: "Success",
	appearance: {
		color: "#2ecc71",
		textColor: "white",
		variant: "mini"
	},
	constraints: {
		editable: false,
		deletable: true,
		collapsable: true,
		creatable: true,
		movable: false,
		placement: {
			predecessor: {
				whitelist: []
			}
		}
	}
});

export const upsertNotFoundNode = createNodeDescriptor({
	type: "upsertNotFound",
	parentType: "airtable-upsert-record",
	defaultLabel: "Not Found",
	appearance: {
		color: "#f39c12",
		textColor: "white",
		variant: "mini"
	},
	constraints: {
		editable: false,
		deletable: true,
		collapsable: true,
		creatable: true,
		movable: false,
		placement: {
			predecessor: {
				whitelist: []
			}
		}
	}
});

export const upsertErrorNode = createNodeDescriptor({
	type: "upsertError",
	parentType: "airtable-upsert-record",
	defaultLabel: "Error",
	appearance: {
		color: "#e74c3c",
		textColor: "white",
		variant: "mini"
	},
	constraints: {
		editable: false,
		deletable: true,
		collapsable: true,
		creatable: true,
		movable: false,
		placement: {
			predecessor: {
				whitelist: []
			}
		}
	}
});
