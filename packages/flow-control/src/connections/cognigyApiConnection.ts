import { IConnectionSchema } from "@cognigy/extension-tools";

export const cognigyApiConnection: IConnectionSchema = {
	type: "cognigy-api",
	label: "Cognigy API",
	fields: [
		{
			fieldName: "apiUrl"
		},
		{
			fieldName: "apiKey"
		},
		{
			fieldName: "projectId"
		}
	]
};
