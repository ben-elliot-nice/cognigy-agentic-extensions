import { createExtension } from "@cognigy/extension-tools";

/* nodes */
import { describeService } from "./nodes/describeService";
import { callOperation, soapSuccessNode, soapFaultNode, soapErrorNode } from "./nodes/callOperation";
import { rawXmlCall, soapRawSuccessNode, soapRawErrorNode } from "./nodes/rawXmlCall";

/* connections */
import { soapAuth } from "./connections/soapAuth";

export default createExtension({
	nodes: [
		describeService,
		callOperation,
		soapSuccessNode,
		soapFaultNode,
		soapErrorNode,
		rawXmlCall,
		soapRawSuccessNode,
		soapRawErrorNode
	],

	connections: [
		soapAuth
	],

	options: {
		label: "SOAP"
	}
});
