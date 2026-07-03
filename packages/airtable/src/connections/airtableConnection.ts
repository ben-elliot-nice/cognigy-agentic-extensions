import { IConnectionSchema } from "@cognigy/extension-tools";

export const airtableConnection: IConnectionSchema = {
	type: "airtable-token",
	label: "Airtable Personal Access Token Connection",
	fields: [
		{
			fieldName: "accessToken"
		}
	]
};