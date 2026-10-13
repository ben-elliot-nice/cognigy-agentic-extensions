import { IConnectionSchema } from "@cognigy/extension-tools";

/**
 * Combined SOAP authentication connection.
 *
 * wsdlUrl                    — the WSDL document location shared by all nodes
 * username / password        — used as either HTTP Basic Auth credentials or a
 *                              WS-Security UsernameToken, depending on each node's config
 * customHeadersJson          — optional JSON object of extra SOAP headers merged into every request
 */
export const soapAuth: IConnectionSchema = {
	type: "soap-auth",
	label: "SOAP Auth",
	fields: [
		{ fieldName: "wsdlUrl" },
		{ fieldName: "username" },
		{ fieldName: "password" },
		{ fieldName: "customHeadersJson" }
	]
};
