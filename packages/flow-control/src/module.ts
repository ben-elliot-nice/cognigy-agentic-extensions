import { createExtension } from "@cognigy/extension-tools";

/* nodes */
import { functionCallNode } from "./nodes/functionCallNode";

/* connections */
import { cognigyApiConnection } from "./connections/cognigyApiConnection";

export default createExtension({
	nodes: [
		functionCallNode
	],

	connections: [
		cognigyApiConnection
	],

	options: {
		label: "Flow Control"
	}
});
