import { createExtension } from "@cognigy/extension-tools";

import { createHashNode } from "./nodes/createHash";
import { encryptNode } from "./nodes/encrypt";
import { decryptNode } from "./nodes/decrypt";
import { hmacNode } from "./nodes/hmac";

export default createExtension({
	nodes: [
		createHashNode,
		encryptNode,
		decryptNode,
		hmacNode
	],

	options: {
		label: "Crypto"
	}
});
