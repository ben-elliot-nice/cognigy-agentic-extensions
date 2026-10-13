import * as soap from "soap";

export interface ISoapAuthConnection {
	wsdlUrl: string;
	username?: string;
	password?: string;
	customHeadersJson?: string;
}

/**
 * Module-level cache of parsed SOAP clients, keyed by WSDL URL + username.
 * A soap.Client is not JSON-serializable, so it can't live in flow context/input —
 * it's memoized here for the lifetime of the extension's runtime process instead.
 */
const clientCache = new Map<string, Promise<soap.Client>>();

function cacheKey(auth: ISoapAuthConnection): string {
	return `${auth.wsdlUrl}::${auth.username || ""}`;
}

export async function getSoapClient(auth: ISoapAuthConnection): Promise<soap.Client> {
	const key = cacheKey(auth);

	if (!clientCache.has(key)) {
		clientCache.set(key, createSoapClient(auth));
	}

	try {
		return await clientCache.get(key)!;
	} catch (error) {
		// Don't poison the cache with a failed WSDL fetch — allow retry on next call
		clientCache.delete(key);
		throw error;
	}
}

async function createSoapClient(auth: ISoapAuthConnection): Promise<soap.Client> {
	const client = await soap.createClientAsync(auth.wsdlUrl);

	if (auth.username && auth.password) {
		client.setSecurity(new soap.WSSecurity(auth.username, auth.password, {
			passwordType: "PasswordText",
			hasNonce: true,
			hasTimeStamp: true
		}));
	}

	if (auth.customHeadersJson) {
		let customHeaders: Record<string, unknown>;
		try {
			customHeaders = JSON.parse(auth.customHeadersJson);
		} catch {
			throw new Error("customHeadersJson is not valid JSON");
		}

		for (const [name, value] of Object.entries(customHeaders)) {
			client.addSoapHeader({ [name]: value });
		}
	}

	return client;
}

export interface ISoapFault {
	faultcode?: string;
	faultstring?: string;
	detail?: unknown;
}

/**
 * The soap library rejects operation calls with a SOAP Fault by throwing an
 * error whose `root.Envelope.Body.Fault` (or `.body` raw XML) holds the fault —
 * distinguish that from a transport/network failure so nodes can branch accordingly.
 */
export function extractSoapFault(error: any): ISoapFault | null {
	const fault = error?.root?.Envelope?.Body?.Fault;
	if (!fault) {
		return null;
	}

	return {
		faultcode: fault.faultcode,
		faultstring: fault.faultstring,
		detail: fault.detail
	};
}
