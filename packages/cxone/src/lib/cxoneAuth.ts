import axios from "axios";
import { createHash } from "crypto";

export const REQUEST_TIMEOUT_MS = 15000;
const MAX_BODY_CHARS = 2000;
const ERROR_INPUT_KEY = "cxoneError";

const ENVIRONMENTS: Record<string, string> = {
	default: "https://cxone.niceincontact.com",
	gov: "https://cxone-gov.niceincontact.com"
};

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
	/** "default" (cxone.niceincontact.com) or "gov" (cxone-gov.niceincontact.com). Blank = default. */
	environment?: string;
}

/** Standardised, secret-free description of a failed CXone call. */
export interface ICxoneErrorDetails {
	node: string;
	step: string;
	message: string;
	status?: number;
	statusText?: string;
	code?: string;
	/** Truncated response body from CXone, if any. */
	response?: any;
}

export type CxoneError = Error & { cxone: ICxoneErrorDetails };

function cxoneError(step: string, message: string, extra: Partial<ICxoneErrorDetails> = {}): CxoneError {
	const err = new Error(message) as CxoneError;
	err.cxone = { node: "", step, message, ...extra };
	return err;
}

function truncate(body: any): any {
	if (body === undefined || body === null) return undefined;
	const text = typeof body === "string" ? body : JSON.stringify(body);
	return text.length > MAX_BODY_CHARS ? `${text.substring(0, MAX_BODY_CHARS)}…[truncated]` : body;
}

/**
 * Converts any thrown value into a CxoneError without retaining the axios error
 * object (which carries request headers, including Authorization).
 */
function toCxoneError(err: any, step: string): CxoneError {
	if (err && err.cxone) return err as CxoneError;

	const status: number | undefined = err?.response?.status;
	let message: string;
	if (status) {
		message = `${step} failed: HTTP ${status}${err.response.statusText ? ` ${err.response.statusText}` : ""}`;
	} else if (err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT") {
		message = `${step} failed: timed out after ${REQUEST_TIMEOUT_MS}ms`;
	} else {
		message = `${step} failed: ${err?.message ?? "unknown error"}`;
	}

	return cxoneError(step, message, {
		status,
		statusText: err?.response?.statusText,
		code: err?.code,
		response: truncate(err?.response?.data)
	});
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

function resolveBaseUrl(creds: ICxoneCredentials): string {
	const env = (creds.environment || "default").trim().toLowerCase();
	const url = ENVIRONMENTS[env];
	if (!url) {
		throw cxoneError(
			"configuration",
			`Unknown CXone environment "${creds.environment}" — use one of: ${Object.keys(ENVIRONMENTS).join(", ")}`
		);
	}
	return url;
}

/**
 * Storage key for the managed auth cache. Derived from the environment, client ID and
 * username, so one flow can talk to several CXone environments without collisions.
 * Limitation: two connections with identical environment, client ID and username share a cache.
 */
export function authCacheKey(creds: ICxoneCredentials): string {
	const id = `${resolveBaseUrl(creds)}|${creds.clientId}|${creds.cxoneUsername}`;
	return `cxoneAuth_${createHash("sha256").update(id).digest("hex").substring(0, 16)}`;
}

/**
 * Ensures the auth cache is populated and valid.
 * Skips any steps already satisfied; mutates and returns the cache.
 */
export async function ensureCxoneAuth(
	cache: ICxoneAuthCache,
	creds: ICxoneCredentials,
	log: (msg: string) => void
): Promise<ICxoneAuthCache> {
	const baseUrl = resolveBaseUrl(creds);

	// Step 1: Validate cached token
	let needNewToken = true;
	if (cache.token) {
		try {
			if (!isTokenExpired(decodeJWT(cache.token))) {
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
		// Step 2: OpenID discovery (skip if cached)
		if (!cache.tokenEndpoint) {
			log("fetching OpenID configuration");
			let openidData: any;
			try {
				openidData = (await axios.get(`${baseUrl}/.well-known/openid-configuration`, { timeout: REQUEST_TIMEOUT_MS })).data;
			} catch (err: any) {
				throw toCxoneError(err, "OpenID discovery");
			}

			if (!openidData?.token_endpoint) {
				throw cxoneError("OpenID discovery", "OpenID discovery failed: token_endpoint missing from response");
			}
			cache.tokenEndpoint = openidData.token_endpoint;
			log(`token endpoint — ${cache.tokenEndpoint}`);
		}

		// Step 3: Token grant
		log("requesting access token");

		const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
		const body = new URLSearchParams();
		body.append("grant_type", "password");
		body.append("username", creds.cxoneUsername);
		body.append("password", creds.cxonePassword);

		let tokenData: any;
		try {
			tokenData = (await axios.post(cache.tokenEndpoint!, body.toString(), {
				timeout: REQUEST_TIMEOUT_MS,
				headers: {
					Authorization: `Basic ${basicAuth}`,
					"Content-Type": "application/x-www-form-urlencoded"
				}
			})).data;
		} catch (err: any) {
			throw toCxoneError(err, "Token request");
		}

		if (!tokenData?.access_token) {
			throw cxoneError("Token request", "Token request failed: access_token missing from response");
		}

		cache.token = tokenData.access_token;
		log("access token retrieved");

		// Step 4: Extract tenant ID from JWT
		try {
			cache.tenantId = decodeJWT(cache.token!).tenantId;
		} catch (err: any) {
			throw cxoneError("Token request", `Token request failed: could not decode access token — ${err.message}`);
		}
		log(`tenant ID — ${cache.tenantId}`);
	}

	// Step 5: API base URL discovery (skip if cached)
	if (!cache.apiBaseUrl) {
		if (!cache.tenantId) {
			throw cxoneError("API discovery", "API discovery failed: tenant ID unavailable");
		}
		log("fetching API base URL from discovery service");
		let discoveryData: any;
		try {
			discoveryData = (await axios.get(`${baseUrl}/.well-known/cxone-configuration`, {
				params: { tenantId: cache.tenantId },
				timeout: REQUEST_TIMEOUT_MS
			})).data;
		} catch (err: any) {
			throw toCxoneError(err, "API discovery");
		}

		if (!discoveryData?.api_endpoint) {
			throw cxoneError("API discovery", "API discovery failed: api_endpoint missing from response");
		}
		cache.apiBaseUrl = discoveryData.api_endpoint;
		log(`API base URL — ${cache.apiBaseUrl}`);
	}

	return cache;
}

/** Writes a standardised error to the input object and the Cognigy log. Returns the error for throwing. */
export function reportCxoneError(cognigy: any, node: string, err: any): CxoneError {
	const e = toCxoneError(err, "request");
	e.cxone.node = e.cxone.node || node;
	e.message = `CXone ${node}: ${e.cxone.message}`;

	cognigy.api.log("error", e.message);
	// @ts-ignore
	cognigy.api.addToInput(ERROR_INPUT_KEY, e.cxone);
	return e;
}

export interface ICxoneCallOptions<T> {
	cognigy: any;
	/** Node label used in logs and error messages, e.g. "Send Signal". */
	node: string;
	creds: ICxoneCredentials;
	/** Throws on invalid config. Runs before any network call. */
	validate?: () => void;
	/** Performs the API call using the authenticated cache. */
	request: (cache: ICxoneAuthCache) => Promise<{ data: T }>;
}

/**
 * Authenticates if needed (cached per environment/client/user in context), performs the request,
 * refreshes and retries once on a 401, and reports failures in a standard, secret-free shape:
 * written to input.cxoneError, logged, and thrown as a plain Error.
 */
export async function callCxone<T>(opts: ICxoneCallOptions<T>): Promise<T> {
	const { cognigy, node, creds, validate, request } = opts;
	const log = (msg: string) => cognigy.api.log("info", `CXone ${node}: ${msg}`);

	try {
		if (validate) {
			try {
				validate();
			} catch (err: any) {
				throw cxoneError("validation", err.message);
			}
		}

		const key = authCacheKey(creds);
		const cache: ICxoneAuthCache = (cognigy.context[key] as ICxoneAuthCache) || {};

		await ensureCxoneAuth(cache, creds, log);
		cognigy.context[key] = cache;

		try {
			return (await request(cache)).data;
		} catch (err: any) {
			if (err?.response?.status !== 401) throw toCxoneError(err, "API request");

			log("received 401, refreshing token and retrying once");
			cache.token = undefined;
			await ensureCxoneAuth(cache, creds, log);
			cognigy.context[key] = cache;

			try {
				return (await request(cache)).data;
			} catch (retryErr: any) {
				throw toCxoneError(retryErr, "API request");
			}
		}
	} catch (err: any) {
		throw reportCxoneError(cognigy, node, err);
	}
}

/** Authenticates (using and updating the managed cache) and returns the cache. For Get Token. */
export async function authenticate(cognigy: any, node: string, creds: ICxoneCredentials): Promise<ICxoneAuthCache> {
	try {
		const key = authCacheKey(creds);
		const cache: ICxoneAuthCache = (cognigy.context[key] as ICxoneAuthCache) || {};
		await ensureCxoneAuth(cache, creds, (msg) => cognigy.api.log("info", `CXone ${node}: ${msg}`));
		cognigy.context[key] = cache;
		return cache;
	} catch (err: any) {
		throw reportCxoneError(cognigy, node, err);
	}
}

/** Numeric IDs (contact, skill) are rejected rather than escaped if they contain anything else. */
export function assertNumericId(value: string, label: string): void {
	if (!/^\d+$/.test(String(value ?? "").trim())) {
		throw new Error(`${label} must be numeric, got "${String(value).substring(0, 40)}"`);
	}
}
