import { createNodeDescriptor, type INodeFunctionBaseParams } from "@cognigy/extension-tools";

export const xappEventHandler = createNodeDescriptor({
	type: "xappEventHandler",
	defaultLabel: "xApp Event Handler",
	summary: "Routes flow execution based on xApp submit or custom inject event type",
	tags: ["logic"],

	appearance: {
		color: "#0070f3",
		textColor: "white",
		variant: "regular",
	},

	dependencies: {
		// Both children are auto-created when this node is placed
		children: ["xappEventCase", "xappEventDefault"],
	},

	function: async ({ cognigy, childConfigs }: INodeFunctionBaseParams) => {
		const { api, input } = cognigy;
		const data = (input as any).data as Record<string, unknown> | undefined;

		// Check for xApp SDK.submit — always at _cognigy._app.type === "submit"
		const isXappSubmit =
			(data as any)?._cognigy?._app?.type === "submit";

		if (isXappSubmit) {
			const match = childConfigs.find(
				(c) => c.type === "xappEventCase" && c.config.eventType === "xapp-submit",
			);
			if (match) {
				api.setNextNode(match.id);
				return;
			}
		}

		// Check for custom inject events — each case declares which top-level input.data field it owns
		if (!isXappSubmit && data) {
			for (const child of childConfigs) {
				if (child.type === "xappEventCase" && child.config.eventType === "inject") {
					const field = child.config.injectField as string | undefined;
					if (field && data[field] !== undefined) {
						api.setNextNode(child.id);
						return;
					}
				}
			}
		}

		// No event matched — route to default (normal utterance turn)
		const defaultChild = childConfigs.find((c) => c.type === "xappEventDefault");
		if (defaultChild) api.setNextNode(defaultChild.id);
	},
});

export const xappEventCase = createNodeDescriptor({
	type: "xappEventCase",
	parentType: "xappEventHandler",
	defaultLabel: "Event",
	summary: "Matches a specific xApp submit or inject event",

	appearance: {
		color: "#0070f3",
		textColor: "white",
		variant: "mini",
	},

	constraints: {
		editable: true,
		deletable: true,
		creatable: true,
		movable: true,
		placement: {
			predecessor: {
				whitelist: [],
			},
		},
	},

	fields: [
		{
			key: "eventType",
			label: "Event Type",
			type: "select",
			defaultValue: "xapp-submit",
			params: {
				required: true,
				options: [
					{ label: "xApp Submit (SDK.submit)", value: "xapp-submit" },
					{ label: "Custom Inject (webhook / Sessions API)", value: "inject" },
				],
			},
		},
		{
			key: "injectField",
			label: "inject.data Field Name",
			type: "cognigyText",
			defaultValue: "",
			condition: {
				key: "eventType",
				value: "inject",
			},
			params: {
				required: true,
				placeholder: "e.g. paymentResult",
			},
		},
	],

	form: [
		{ type: "field", key: "eventType" },
		{ type: "field", key: "injectField" },
	],
});

export const xappEventDefault = createNodeDescriptor({
	type: "xappEventDefault",
	parentType: "xappEventHandler",
	defaultLabel: "Default",
	summary: "Executes when the turn is not an xApp or inject event",

	appearance: {
		color: "#6b7280",
		textColor: "white",
		variant: "mini",
	},

	constraints: {
		editable: false,
		deletable: false,
		creatable: false,
		movable: false,
		placement: {
			predecessor: {
				whitelist: [],
			},
		},
	},
});
