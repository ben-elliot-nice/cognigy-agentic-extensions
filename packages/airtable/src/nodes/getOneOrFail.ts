import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import axios from "axios";

export interface IGetOneOrFailParams extends INodeFunctionBaseParams {
	config: {
		connection: {
			accessToken: string;
		};
		baseId: string;
		tableName: string;
		searchField: string;
		searchValue: string;
		fields: string[];
		storeLocation: string;
		inputKey: string;
		contextKey: string;
	};
}

export const getOneOrFailNode = createNodeDescriptor({
	type: "airtable-getoneorfail",
	defaultLabel: "Get One Record (Or Fail)",
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
			description: "The name of the table to query",
			params: {
				required: true
			}
		},
		{
			key: "searchField",
			label: "Search Field",
			type: "cognigyText",
			description: "The field name to search in",
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
			key: "fields",
			label: "Fields to Retrieve",
			type: "textArray",
			description: "Specific fields to return (leave empty for all fields)",
			defaultValue: []
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
			defaultValue: "airtableRecord",
			condition: {
				key: "storeLocation",
				value: "input"
			}
		},
		{
			key: "contextKey",
			type: "cognigyText",
			label: "Context Key to store Result",
			defaultValue: "airtableRecord",
			condition: {
				key: "storeLocation",
				value: "context"
			}
		}
	],
	sections: [
		{
			key: "queryOptions",
			label: "Query Options",
			defaultCollapsed: true,
			fields: [
				"fields"
			]
		},
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
		{ type: "section", key: "queryOptions" },
		{ type: "section", key: "storageOption" }
	],
	appearance: {
		color: "#ffb100"
	},
	dependencies: {
		children: ["success", "notFound", "multipleFound", "error"]
	},
	function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
		const { api } = cognigy;
		const {
			connection,
			baseId,
			tableName,
			searchField,
			searchValue,
			fields,
			storeLocation,
			inputKey,
			contextKey
		} = config as IGetOneOrFailParams["config"];

		// Start logging
		api.log("info", `Get One Record - Base: ${baseId}, Table: ${tableName}, Search: {${searchField}} = "${searchValue}"`);

		try {
			const params: any = {
				filterByFormula: `{${searchField}} = "${searchValue}"`
			};

			if (fields && fields.length > 0) {
				params.fields = fields;
			}

			const response = await axios.get(
				`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
				{
					headers: {
						Authorization: `Bearer ${connection.accessToken}`,
						"Content-Type": "application/json"
					},
					params
				}
			);

			const records = response.data.records;

			api.log("debug", `Found ${records.length} matching records`);

			if (records.length === 0) {
				// No records found - go to notFound path
				api.log("info", "Routing to: notFound");

				const result = {
					found: false,
					message: `No record found with ${searchField} = "${searchValue}"`
				};

				if (storeLocation === "context") {
					api.addToContext(contextKey, result, "simple");
				} else {
					// @ts-ignore
					api.addToInput(inputKey, result);
				}

				const notFoundChild = childConfigs.find(child => child.type === "notFound");
				if (notFoundChild) api.setNextNode(notFoundChild.id);
				return;

			} else if (records.length > 1) {
				// Multiple records found - go to multipleFound path
				api.log("info", `Routing to: multipleFound (${records.length} records)`);

				const result = {
					found: true,
					multiple: true,
					count: records.length,
					message: `Multiple records found (${records.length}) with ${searchField} = "${searchValue}"`,
					records
				};

				if (storeLocation === "context") {
					api.addToContext(contextKey, result, "simple");
				} else {
					// @ts-ignore
					api.addToInput(inputKey, result);
				}

				const multipleFoundChild = childConfigs.find(child => child.type === "multipleFound");
				if (multipleFoundChild) api.setNextNode(multipleFoundChild.id);
				return;

			} else {
				// Exactly one record found - success path
				api.log("info", `Routing to: success (Record ID: ${records[0].id})`);

				const result = {
					found: true,
					multiple: false,
					record: records[0]
				};

				if (storeLocation === "context") {
					api.addToContext(contextKey, result, "simple");
				} else {
					// @ts-ignore
					api.addToInput(inputKey, result);
				}

				const successChild = childConfigs.find(child => child.type === "success");
				if (successChild) api.setNextNode(successChild.id);
				return;
			}

		} catch (error: any) {
			api.log("error", `Error searching records - Status: ${error.response?.status || "N/A"}, Message: ${error.response?.data?.error?.message || error.message}`);
			api.log("info", "Routing to: error");

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

			const errorChild = childConfigs.find(child => child.type === "error");
			if (errorChild) api.setNextNode(errorChild.id);
		}
	}
});

// Child node definitions
export const successNode = createNodeDescriptor({
	type: "success",
	parentType: "airtable-getoneorfail",
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

export const notFoundNode = createNodeDescriptor({
	type: "notFound",
	parentType: "airtable-getoneorfail",
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

export const multipleFoundNode = createNodeDescriptor({
	type: "multipleFound",
	parentType: "airtable-getoneorfail",
	defaultLabel: "Multiple Found",
	appearance: {
		color: "#9b59b6",
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

export const errorNode = createNodeDescriptor({
	type: "error",
	parentType: "airtable-getoneorfail",
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