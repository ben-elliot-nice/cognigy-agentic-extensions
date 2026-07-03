import { IConnectionSchema } from "@cognigy/extension-tools";

/**
 * Combined CXone authentication connection.
 *
 * clientId / clientSecret   — used as Basic Auth credentials in the Authorization
 *                             header of the token request (base64-encoded clientId:clientSecret)
 *
 * cxoneUsername / cxonePassword — sent in the token request body as the OAuth2
 *                                 password-grant username and password
 */
export const cxoneAuth: IConnectionSchema = {
	type: "cxone-auth",
	label: "CXone Auth",
	fields: [
		{ fieldName: "clientId" },
		{ fieldName: "clientSecret" },
		{ fieldName: "cxoneUsername" },
		{ fieldName: "cxonePassword" }
	]
};
