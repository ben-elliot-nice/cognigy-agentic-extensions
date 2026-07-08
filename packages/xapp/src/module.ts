import { createExtension } from "@cognigy/extension-tools";

import {
	xappSubmitHandler,
	xappInjectHandler,
	xappCombinedHandler,
	xappSubmitCase,
	xappInjectCase,
	xappNoEvent,
} from "./nodes/xappEventHandler";

export default createExtension({
	nodes: [
		xappSubmitHandler,
		xappInjectHandler,
		xappCombinedHandler,
		xappSubmitCase,
		xappInjectCase,
		xappNoEvent,
	],

	options: {
		label: "xApp",
	},
});
