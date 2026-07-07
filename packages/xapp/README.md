# xApp Extension

Cognigy.AI extension nodes for routing flow execution based on xApp submit and custom webhook inject events.

## Nodes

### xApp Event Handler

A parent/child switcher node that replaces the manual IF-node pattern for xApp event discrimination.

**Children:**
- **Event** (`xappEventCase`) — Matches a specific event type. Editable and creatable; add one per event you need to handle.
- **Default** (`xappEventDefault`) — Executes on non-event turns (normal user utterances).

**How it works:**

1. On each turn, the parent node inspects `input.data`.
2. If `input.data._cognigy._app.type === "submit"`, it routes to the case configured as *xApp Submit*.
3. Otherwise, it checks each inject case in order — routing to the first whose configured field name is present in `input.data`.
4. If no case matches, it routes to *Default*.

### Event Case (child)

Configure what each case matches:

| Field | Description |
|---|---|
| Event Type | `xApp Submit` — matches SDK.submit turns. `Custom Inject` — matches a webhook inject turn by field name. |
| inject.data Field Name | The top-level key to check in `input.data` (only shown for Custom Inject). |

### Default (child)

No configuration. Executes on any turn that is not matched by a case node — typically normal user utterances that should reach the AI Agent Job.
