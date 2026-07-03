import axios from "axios";

const BASE_URL = "https://cxone.niceincontact.com";

export interface ICxoneAuthCache {
	token?: string;
	tokenEndpoint?: string;
	tenantId?: string;
	apiBaseUrl?: string;
}

export interface ICxoneCredentials {
	clientId: string;
	clientSecret: string;
	cxoneUsername: string;
	cxonePassword: string;
}

function decodeJWT(token: string): any {
	const parts = token.split(".");
	if (parts.length !== 3) throw new Error("Invalid JWT format");
	return JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
}

function isTokenExpired(decoded: any): boolean {
	if (!decoded.exp) return true;
	return decoded.exp < Math.floor(Date.now() / 1000) + 60;
}

/**
 * Ensures the auth cache is populated and valid.
 * Reads existing cache, skips any steps already satisfied, writes back the updated cache.
 *
 * @param cache     Existing cache object (mutated in place)
 * @param creds     Connection credentials — required only when a new token is needed
 * @param log       Logging function
 * @returns         The updated cache (same reference)
 */
export async function ensureCxoneAuth(
	cache: ICxoneAuthCache,
	creds: ICxoneCredentials | null,
	log: (msg: string) => void
): Promise<ICxoneAuthCache> {

	// Step 1: Validate cached token
	let needNewToken = true;
	if (cache.token) {
		try {
			const decoded = decodeJWT(cache.token);
			if (!isTokenExpired(decoded)) {
				log("cached token is valid, skipping auth");
				needNewToken = false;
			} else {
				log("cached token expired, re-authenticating");
				cache.token = undefined;
			}
		} catch (err: any) {
			log(`token validation failed — ${err.message}`);
			cache.token = undefined;
		}
	}

	if (needNewToken) {
		if (!creds) {
			throw new Error("CXone: no valid cached token and no credentials provided — cannot authenticate");
		}

		// Step 2: OpenID discovery (skip if cached)
		if (!cache.tokenEndpoint) {
			log("fetching OpenID configuration");
			const openidResponse = await axios.get(`${BASE_URL}/.well-known/openid-configuration`);

			if (!openidResponse.data?.token_endpoint) {
				throw new Error("CXone: token_endpoint missing from OpenID configuration");
			}

			cache.tokenEndpoint = openidResponse.data.token_endpoint;
			log(`token endpoint — ${cache.tokenEndpoint}`);
		}

		// Step 3: Token grant
		log("requesting access token");

		const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
		const body = new URLSearchParams();
		body.append("grant_type", "password");
		body.append("username", creds.cxoneUsername);
		body.append("password", creds.cxonePassword);

		const tokenResponse = await axios.post(cache.tokenEndpoint!, body.toString(), {
			headers: {
				Authorization: `Basic ${basicAuth}`,
				"Content-Type": "application/x-www-form-urlencoded"
			}
		});

		if (!tokenResponse.data?.access_token) {
			throw new Error("CXone: access_token missing from token response");
		}

		cache.token = tokenResponse.data.access_token;
		log("access token retrieved");

		// Step 4: Extract tenant ID from JWT
		const decoded = decodeJWT(cache.token!);
		cache.tenantId = decoded.tenantId;
		log(`tenant ID — ${cache.tenantId}`);
	}

	// Step 5: API base URL discovery (skip if cached)
	if (!cache.apiBaseUrl) {
		if (!cache.tenantId) {
			throw new Error("CXone: tenant ID unavailable — cannot perform API discovery");
		}
		log("fetching API base URL from discovery service");
		const discoveryResponse = await axios.get(
			`${BASE_URL}/.well-known/cxone-configuration?tenantId=${cache.tenantId}`
		);

		if (!discoveryResponse.data?.api_endpoint) {
			throw new Error("CXone: api_endpoint missing from discovery response");
		}

		cache.apiBaseUrl = discoveryResponse.data.api_endpoint;
		log(`API base URL — ${cache.apiBaseUrl}`);
	}

	return cache;
}
