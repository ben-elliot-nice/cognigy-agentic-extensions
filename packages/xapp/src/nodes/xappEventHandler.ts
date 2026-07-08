import { createNodeDescriptor, type INodeFunctionBaseParams } from "@cognigy/extension-tools";

const SUBMIT_COLOR = "#0070f3";
const INJECT_COLOR = "#7c3aed";
const NO_EVENT_COLOR = "#6b7280";

function routeToNoEvent(childConfigs: INodeFunctionBaseParams["childConfigs"], api: any): void {
	const noEvent = childConfigs.find((c) => c.type === "xappNoEvent");
	if (noEvent) api.setNextNode(noEvent.id);
}

// ─── Parent: xApp Submit only ────────────────────────────────────────────────

export const xappSubmitHandler = createNodeDescriptor({
	type: "xappSubmitHandler",
	defaultLabel: "xApp Submit Handler",
	summary: "Routes flow on xApp SDK.submit events; passes non-event turns to No Event",
	tags: ["logic"],

	appearance: {
		color: SUBMIT_COLOR,
		textColor: "white",
		variant: "regular",
	},

	preview: {
		type: "text",
		key: "type",
	},

	dependencies: {
		children: ["xappSubmitCase", "xappNoEvent"],
	},

	function: async ({ cognigy, childConfigs }: INodeFunctionBaseParams) => {
		const { api, input } = cognigy;
		const data = (input as any).data;

		if (data?._cognigy?._app?.type === "submit") {
			const match = childConfigs.find((c) => c.type === "xappSubmitCase");
			if (match) { api.setNextNode(match.id); return; }
		}

		routeToNoEvent(childConfigs, api);
	},
});

// ─── Parent: Inject only ─────────────────────────────────────────────────────

export const xappInjectHandler = createNodeDescriptor({
	type: "xappInjectHandler",
	defaultLabel: "Inject Handler",
	summary: "Routes flow on webhook inject events; passes non-event turns to No Event",
	tags: ["logic"],

	appearance: {
		color: INJECT_COLOR,
		textColor: "white",
		variant: "regular",
	},

	preview: {
		type: "text",
		key: "type",
	},

	dependencies: {
		children: ["xappInjectCase", "xappNoEvent"],
	},

	function: async ({ cognigy, childConfigs }: INodeFunctionBaseParams) => {
		const { api, input } = cognigy;
		const data = (input as any).data as Record<string, unknown> | undefined;

		if (data) {
			for (const child of childConfigs) {
				if (child.type === "xappInjectCase") {
					const field = child.config.injectField as string | undefined;
					if (field && data[field] !== undefined) {
						api.setNextNode(child.id);
						return;
					}
				}
			}
		}

		routeToNoEvent(childConfigs, api);
	},
});

// ─── Parent: xApp Submit + Inject ────────────────────────────────────────────

export const xappCombinedHandler = createNodeDescriptor({
	type: "xappCombinedHandler",
	defaultLabel: "xApp Submit + Inject Handler",
	summary: "Routes flow on xApp submit or webhook inject events; passes non-event turns to No Event",
	tags: ["logic"],

	appearance: {
		color: SUBMIT_COLOR,
		textColor: "white",
		variant: "regular",
	},

	preview: {
		type: "text",
		key: "type",
	},

	dependencies: {
		children: ["xappSubmitCase", "xappInjectCase", "xappNoEvent"],
	},

	function: async ({ cognigy, childConfigs }: INodeFunctionBaseParams) => {
		const { api, input } = cognigy;
		const data = (input as any).data as Record<string, unknown> | undefined;

		if ((data as any)?._cognigy?._app?.type === "submit") {
			const match = childConfigs.find((c) => c.type === "xappSubmitCase");
			if (match) { api.setNextNode(match.id); return; }
		}

		if (data) {
			for (const child of childConfigs) {
				if (child.type === "xappInjectCase") {
					const field = child.config.injectField as string | undefined;
					if (field && data[field] !== undefined) {
						api.setNextNode(child.id);
						return;
					}
				}
			}
		}

		routeToNoEvent(childConfigs, api);
	},
});

// ─── Child: xApp Submit case ─────────────────────────────────────────────────

export const xappSubmitCase = createNodeDescriptor({
	type: "xappSubmitCase",
	parentType: "xappSubmitHandler",
	defaultLabel: "xApp Submit",
	summary: "Executes when input.data._cognigy._app.type === 'submit'",

	appearance: {
		color: SUBMIT_COLOR,
		textColor: "white",
		variant: "mini",
	},

	constraints: {
		editable: false,
		deletable: false,
		creatable: false,
		movable: false,
		placement: {
			predecessor: { whitelist: [] },
		},
	},
});

// ─── Child: Inject case ───────────────────────────────────────────────────────

export const xappInjectCase = createNodeDescriptor({
	type: "xappInjectCase",
	parentType: "xappInjectHandler",
	defaultLabel: "Inject",
	summary: "Executes when a named field is present in input.data",

	appearance: {
		color: INJECT_COLOR,
		textColor: "white",
		variant: "mini",
	},

	constraints: {
		editable: true,
		deletable: true,
		creatable: true,
		movable: true,
		placement: {
			predecessor: { whitelist: [] },
		},
	},

	fields: [
		{
			key: "injectField",
			label: "input.data Field Name",
			type: "cognigyText",
			defaultValue: "",
			params: {
				required: true,
				placeholder: "e.g. paymentResult",
			},
		},
	],

	form: [
		{ type: "field", key: "injectField" },
	],
});

// ─── Child: No Event ──────────────────────────────────────────────────────────

export const xappNoEvent = createNodeDescriptor({
	type: "xappNoEvent",
	parentType: "xappSubmitHandler",
	defaultLabel: "No Event",
	summary: "Executes when the turn contains no xApp or inject event — normal user utterance",

	appearance: {
		color: NO_EVENT_COLOR,
		textColor: "white",
		variant: "mini",
	},

	constraints: {
		editable: false,
		deletable: false,
		creatable: false,
		movable: false,
		placement: {
			predecessor: { whitelist: [] },
		},
	},
});
