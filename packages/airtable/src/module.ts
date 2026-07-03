import { createExtension } from "@cognigy/extension-tools";

/* nodes */
import { getAllNode } from "./nodes/getAll";
import { getOneOrFailNode, successNode, notFoundNode, multipleFoundNode, errorNode } from "./nodes/getOneOrFail";
import { insertRecordNode } from "./nodes/insertRecord";
import { upsertRecordNode, upsertSuccessNode, upsertNotFoundNode, upsertErrorNode } from "./nodes/upsertRecord";
import { getTableSchemaNode } from "./nodes/getTableSchema";

/* connections */
import { airtableConnection } from "./connections/airtableConnection";

export default createExtension({
	nodes: [
		getAllNode,
		getOneOrFailNode,
		insertRecordNode,
		upsertRecordNode,
		getTableSchemaNode,
		successNode,
		notFoundNode,
		multipleFoundNode,
		errorNode,
		upsertSuccessNode,
		upsertNotFoundNode,
		upsertErrorNode
	],

	connections: [
		airtableConnection
	],

	options: {
		label: "Airtable"
	}
});
