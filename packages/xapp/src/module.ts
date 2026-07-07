import { createExtension } from "@cognigy/extension-tools";

import { xappEventHandler, xappEventCase, xappEventDefault } from "./nodes/xappEventHandler";

export default createExtension({
	nodes: [
		xappEventHandler,
		xappEventCase,
		xappEventDefault,
	],

	options: {
		label: "xApp",
	},
});
