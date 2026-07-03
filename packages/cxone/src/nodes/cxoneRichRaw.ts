import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";

/**
 * CXone Rich Raw Node
 *
 * Allows power users to send raw CXone-compatible rich content JSON directly.
 * Automatically detects channel type and routes to appropriate output path.
 *
 * - CXone channel: Sends rich content via default output path
 * - Other channels: Routes to "Not CXone" output path for transparent pass-through
 */

export interface ICxoneRichRawParams extends INodeFunctionBaseParams {
	config: {
		jsonSchema: any;
	};
}

export const cxoneRichRaw = createNodeDescriptor({
	type: "cxoneRichRaw",
	defaultLabel: "CXone Rich Raw",

	fields: [
		{
			key: "jsonSchema",
			label: "CXone Message JSON",
			type: "json",
			description: "Raw CXone message schema (paste from documentation)",
			defaultValue: {
				"type": "TEXT",
				"fallbackText": "Text sent if rich message not available",
				"payload": {
					"text": "Your message here",
					"mimeType": "text/plain"
				}
			}
		}
	],

	dependencies: {
		children: ["cxoneRichRawDefault", "cxoneRichRawNotCxone"]
	},

	function: async ({ cognigy, config, childConfigs }: ICxoneRichRawParams) => {
		const { api, input } = cognigy;
		const { jsonSchema } = config;

		// Detect if current channel is CXone
		const isCXone = input.endpointType === "niceCXOne";

		if (isCXone) {
			// Build CXone output structure
			const outputData = {
				"type": "custom",
				"_cognigy": {
					"_niceCXOne": {
						"json": {
							"text": "",
							"uiComponent": {
								"dfoMessage": {
									"messageContent": jsonSchema
								}
							}
						}
					}
				}
			};

			// Send rich content to CXone
			api.output(null, outputData);

			// Route to default output path
			const defaultChild = childConfigs.find(child => child.type === "cxoneRichRawDefault");
			if (!defaultChild) {
				throw new Error("Unable to find 'cxoneRichRawDefault' child. Seems it's not attached.");
			}
			api.setNextNode(defaultChild.id);

		} else {
			// Route to "Not CXone" output path (transparent pass-through)
			const notCxoneChild = childConfigs.find(child => child.type === "cxoneRichRawNotCxone");
			if (!notCxoneChild) {
				throw new Error("Unable to find 'cxoneRichRawNotCxone' child. Seems it's not attached.");
			}
			api.setNextNode(notCxoneChild.id);
		}
	}
});

/* Child node definitions for output paths */

export const cxoneRichRawDefault = createNodeDescriptor({
	type: "cxoneRichRawDefault",
	parentType: "cxoneRichRaw",
	defaultLabel: "Default",

	appearance: {
		color: '#2ecc71',
		textColor: 'white',
		variant: 'mini'
	},

	constraints: {
		editable: false,
		deletable: true,
		collapsable: true,
		creatable: true,
		movable: false,
		placement: {
			predecessor: {
				whitelist: []
			}
		}
	}
});

export const cxoneRichRawNotCxone = createNodeDescriptor({
	type: "cxoneRichRawNotCxone",
	parentType: "cxoneRichRaw",
	defaultLabel: "Not CXone",

	appearance: {
		color: '#e74c3c',
		textColor: 'white',
		variant: 'mini'
	},

	constraints: {
		editable: false,
		deletable: true,
		collapsable: true,
		creatable: true,
		movable: false,
		placement: {
			predecessor: {
				whitelist: []
			}
		}
	}
});
