# cognigy-agentic-extensions

A monorepo of custom [Cognigy.AI](https://www.cognigy.com/) extensions built for agentic workflows. Each package is a self-contained extension that can be uploaded to a Cognigy.AI environment and used in Flow authoring.

## Packages

| Package | Label | Description |
|---|---|---|
| [`packages/airtable`](packages/airtable) | Airtable | Read, insert, and upsert records in Airtable bases |
| [`packages/crypto`](packages/crypto) | Crypto | Hashing, HMAC, and symmetric encryption/decryption |
| [`packages/cxone`](packages/cxone) | CXone | Interact with the NICE CXone platform APIs |
| [`packages/flow-control`](packages/flow-control) | Flow Control | Cross-flow function calls with payload routing |

---

### Airtable

Connects via a personal access token. Provides nodes for common CRUD operations against Airtable bases.

| Node | What it does |
|---|---|
| Get All | Fetch all records from a table, with optional filter-by-formula |
| Get One Or Fail | Fetch a single record matching a formula; branches on success / not-found / multiple-found / error |
| Insert Record | Create a new record |
| Upsert Record | Update a record if it exists, create it if not; branches on success / not-found / error |
| Get Table Schema | Retrieve the field schema for a table |

---

### Crypto

No external dependencies — uses Node's built-in `crypto` module. Useful for signing payloads, hashing PII before logging, or encrypting sensitive values in context.

| Node | What it does |
|---|---|
| Create Hash | Hash a string with MD5, SHA-1, SHA-256, or SHA-512 |
| HMAC | Generate an HMAC signature with a secret key |
| Encrypt | AES-256-CBC encrypt a string |
| Decrypt | AES-256-CBC decrypt a string |

---

### CXone

Connects to the NICE CXone platform using OAuth client credentials. Authentication is handled by a dedicated **Get Token** node that caches credentials in `context` or `input`; all other nodes read from that cache.

| Node | What it does |
|---|---|
| Get Token | Authenticate with CXone using client credentials; writes token + API base URL + tenant ID to a configurable cache key |
| Get Chunks | Query the CXone Knowledge Hub retrieval service; returns raw API response and/or a clean `{ title, content, relevance_percent }` array |
| Send Signal | Send a CXone Signal API call to an active interaction, with up to 9 optional parameters (p1–p9) |
| Start Script | Launch a CXone Studio script by skill ID and script path, with optional pipe-delimited parameters |
| CXone Rich (Raw) | Output a raw CXone-format rich message |

---

### Flow Control

Enables Cognigy flows to call other flows as typed functions — passing a named payload and routing the result back to a configurable output path.

| Node | What it does |
|---|---|
| Function Call | Selects a target flow and entry-point node via API-backed dropdowns, writes `functionCall` metadata to `input`, then executes the target flow via `api.executeFlow` |

The called flow receives `input.functionCall.functionName`, `input.functionCall.payload`, and `input.functionCall.output` (storage type + path), allowing it to act as a reusable function and write its result back to the caller's context.

---

## Development

### Prerequisites

- Node 20 (`mise use node@20` or match the CI version)
- Dependencies: `npm ci`

### Scripts

```bash
# Build all packages
npm run build

# Transpile (compile TS → JS without bundling)
npm run transpile

# Lint all packages
npm run lint

# Target a single package
npm run build:cxone
npm run build:airtable
npm run build:crypto
npm run build:flow-control
```

### CI

GitHub Actions runs transpile + lint for all four packages in a matrix on every push and pull request to `main`. Build artifacts (`.tar.gz`) are uploaded per-package when present.

### Adding a package

1. Create `packages/<name>/` following the structure of an existing package.
2. Add `"build:<name>"` to the root `package.json` scripts.
3. Add `<name>` to the `matrix.package` list in `.github/workflows/build.yml`.
