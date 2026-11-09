# Agents

An agent is the top-level conversation orchestrator in Standard Agents. An agent has **exactly two sides**, and each side is **backed** by exactly one of three things: a human, a prompt, or a handler. There is no agent "type": everything about how an agent converses, composes, and terminates is **derived from the backings** of its two sides.

A consistent division of responsibility runs through this page and every page it links to: prompts and handlers own turns, tools provide capabilities, hooks decorate turns, effects defer work, and subagent relationships define composition.

## 1. Sides and Backings

### 1.1 The Three Backings

| Backing | Who takes this side's turns | Declared as |
|---------|-----------------------------|-------------|
| **Human** | A person, via whatever interface the runtime provides | `{ human: true }` |
| **Prompt** | A model, driven by a [prompt](/0.2.0/specification/prompts) | `{ prompt: 'name', ... }` |
| **Handler** | Deterministic code — a [handler](/0.2.0/specification/handlers) | `{ handler: 'name', ... }` |

A **handler** is a function the runtime calls to take that side's turns — not a hook, not a tool, and not an effect. See [Handlers](/0.2.0/specification/handlers).

For a **human** backing, the specification defines only the waiting state: when it is a human-backed side's turn, the session parks awaiting human input, and the turn is fulfilled by an inbound message on that side's perspective. The specification deliberately does **not** define who the person is or how their input arrives — identity, notification, and reply surfaces are runtime and interface concerns.

### 1.2 SideConfig

A side's configuration is discriminated by its backing: exactly one of `human`, `prompt`, or `handler` **MUST** be present.

**HumanSide**

| Property | Type | Description |
|----------|------|-------------|
| `human` | `true` | Required discriminator |
| `label` | `string` | Optional UI/log label |

No other properties are legal on a human side. In particular, `subagents` is a definition-time error (nothing on a human side can invoke them), and stop/session bindings are meaningless.

**PromptSide**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `prompt` | `string` | Required | Prompt name for this side |
| `label` | `string` | - | UI/log label |
| `subagents` | `SubagentRelationship[]` | - | Side-owned child relationships. See [Subagents](/0.2.0/specification/subagents) |
| `stopOnResponse` | `boolean` | `true` | Stop side turn on text response without tool calls |
| `stopTool` | `string` | - | Stop side turn when this tool is called |
| `stopToolResponseProperty` | `string` | - | Extracted property for stop tool outcomes |
| `maxSteps` | `number` | - | Per-side step safety limit |
| `sessionStop` | `SessionToolBinding` | - | End session successfully (object form only, see [§3](#3-sessiontoolbinding)) |
| `sessionFail` | `SessionToolBinding` | - | End session with failure |
| `sessionStatus` | `SessionToolBinding` | - | Publish status updates |

**HandlerSide**

| Property | Type | Description |
|----------|------|-------------|
| `handler` | `string` | Required — handler name for this side |
| `label` | `string` | Optional UI/log label |
| `subagents` | `SubagentRelationship[]` | Side-owned child relationships. See [Subagents](/0.2.0/specification/subagents) |

Handler sides have no `maxSteps`, `stopOnResponse`, or session bindings: a handler turn is a single invocation, and handlers end sessions through `ThreadState` APIs (`state.stopSession()`) rather than declarative bindings.

### 1.3 Derivations

The following rules are derived from the sides' backings and are never declared separately:

- **Chat surface** — the primary conversational interface renders wherever a `human` backing is. A human on side A is legal.
- **Perspective** — role mapping is the single source of perspective truth: `role: 'user'` is the side B perspective, `role: 'assistant'` is the side A perspective — for queueing, injection, and rendering alike. See [Messages](/0.2.0/specification/threads/messages#4-queueing-messages).
- **Subagent eligibility** — *any* agent may be composed as a subagent. Composing a child with a human side puts a person's step inside the composition: the child session pauses until that person responds ([§7](#7-human-in-the-loop-composition)).
- **Termination discipline** — `maxSessionTurns` is *optional on every agent shape*. Exchange counting is uniform across backings: a handler turn counts like a prompt turn when a cap is set. Two prompt-backed sides can ping-pong indefinitely, and a handler that replies to every inbound message can livelock against a prompt side just as hard — the cap is a voluntary safety valve available everywhere, and prompt and handler authors own their termination discipline.

## 2. AgentDefinition

### 2.1 Required

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique agent identifier |
| `sideA` | `SideConfig` | Side A configuration |
| `sideB` | `SideConfig` | Side B configuration |

Both sides are explicit. There is no implicit "missing side B is a human" default — if a person takes side B's turns, write `sideB: { human: true }`.

### 2.2 Optional

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxSessionTurns` | `number` | - | Session exchange safety cap ([§1.3](#13-derivations)) |
| `title` | `string` | - | Human-readable label |
| `description` | `string` | - | Agent summary |
| `icon` | `string` | - | Display icon |
| `primary` | `boolean` | `true` | Whether the agent is a user-facing entry point. Clients omit non-primary agents from agent pickers. A non-primary agent remains addressable |
| `exposeAsTool` | `boolean` | `false` | Expose callable entrypoint ([§5](#5-tool-exposure)) |
| `toolDescription` | `string` | - | Callable description |
| `env` | `Record<string, string>` | - | Agent-level default variable values |
| `hooks` | `string[]` | - | Fallback hook IDs |
| `parentHooks` | `ParentHookRequirement[]` | - | Required hooks automatically contributed to a direct parent composition ([§6](#6-required-parent-hooks)) |

`AgentDefinition` also accepts optional packaging metadata — `packageName`, `version`, `author`, `license` — consumed only when the agent is packed for distribution. See [Packaging](/0.2.0/distribution/packaging).

## 3. SessionToolBinding

Session lifecycle bindings use the object form:

```typescript
interface SessionToolBinding {
  name: string;
  messageProperty?: string;
  attachmentsProperty?: string;
}
```

- `name`: tool that controls the lifecycle action
- `messageProperty`: which arg field becomes lifecycle message text
- `attachmentsProperty`: which arg field contains attachment path(s)

For composed children, mapped stop/fail payloads are the canonical child → parent result/failure payload.

## 4. Stop Semantics

Runtime stop evaluation order for prompt-backed sides:

1. session-level terminal bindings (`sessionStop` / `sessionFail`)
2. side-level stop bindings (`stopTool`)
3. response stop (`stopOnResponse`)
4. safety limits (`maxSteps`, `maxSessionTurns`)

A handler-backed side's turn ends when its handler invocation returns ([Handlers §3](/0.2.0/specification/handlers#3-execution-model)). A human-backed side's turn ends when the human's inbound message is persisted.

## 5. Tool Exposure

When `exposeAsTool: true`, an agent referenced directly in a prompt's `tools` array is a **handoff**: the tool call transfers control of the *same thread* to the target agent, preserving history. Handoff requires the target agent to have a human side matching the thread's conversational surface.

Composition into a **child thread** is not a prompt-tools concern: it is declared as a `SubagentRelationship` on the composing side. See [Subagents](/0.2.0/specification/subagents). `exposeAsTool` + `toolDescription` are the composability contract — `toolDescription` is the default model-facing description when the agent is composed, and any agent may be composed.

## 6. Required Parent Hooks

An exposed agent MAY declare thread-scoped hooks that are required for the composed relationship to work correctly:

```typescript
interface ParentHookRequirement {
  hook: string;
  reason: string;
  stage?: 'before_parent' | 'after_parent';
}

defineAgent({
  name: 'gmail_agent',
  exposeAsTool: true,
  parentHooks: [{
    hook: 'gmail_context',
    reason: 'Makes newly synchronized Gmail context visible to the coordinator.',
    stage: 'before_parent',
  }],
  // ...
});
```

Downloading or installing a package is inert. Declaring a `SubagentRelationship` targeting the agent (or adding it to an enabled parent prompt as a handoff) is what composes it, and composing it **MUST** activate every `parentHooks` requirement automatically. A second accept-list is not required: composition UIs **MUST** disclose the hook ID, reason, and stage before the relationship is added or enabled.

The following rules are normative:

- Any agent with `exposeAsTool: true` MAY declare `parentHooks` — any agent is composable, so any exposed agent may carry composition requirements.
- Requirements apply only to direct parent relationships; they do not propagate transitively through the child graph.
- `optional` relationships contribute hooks only while their flag is enabled. `hidden: true` affects model visibility, not composition, so hidden enabled relationships still contribute their required hooks.
- Each requirement names a thread-scoped hook in the child's own package namespace. User-scoped hooks cannot be required on a parent.
- The hook receives the parent's `ThreadState` and remains active for the lifetime of the enabled relationship. It applies during every prompt on either side of the parent.
- Missing, invalid, or unloadable required hooks **MUST** fail composition closed. Runtimes must not silently run a partially installed child.
- Duplicate hook IDs within one child's `parentHooks` declaration are invalid.

Required parent hooks are part of the child's public behavioral contract, not an installer side effect. Optional child features that would change this contract require a separately configured child definition; absence from a required list does not mean "best effort." Ordering and provenance are defined in [Hooks §1.3](/0.2.0/specification/hooks#13-hook-scoping).

## 7. Human-in-the-Loop Composition

Because any agent may be composed as a child, composing an agent with a human side puts a person's step inside an otherwise automated composition. When execution reaches the human-backed side's turn, the child session pauses: the child's registry status becomes `awaiting_human`, and the session resumes when a human's inbound message arrives on that side's perspective.

This is a deliberate capability, not an accident of the model. The canonical use is an **approval gate**:

```typescript
// agents/agents/approval_gate.ts — a child that asks a person before proceeding
export default defineAgent({
  name: 'approval_gate',
  exposeAsTool: true,
  toolDescription: 'Request human approval for a proposed action. Returns the decision.',
  sideA: {
    prompt: 'approval_presenter',   // renders the request, records the outcome
    sessionStop: { name: 'record_decision', messageProperty: 'decision' },
  },
  sideB: { human: true },           // the approver
});
```

An orchestrator declares this child on one of its sides (see [Subagents](/0.2.0/specification/subagents)), spawns it with the proposed action, and the child parks in `awaiting_human` until the approver responds. The runtime does not define who sees the parked session or through which interface they answer — only the waiting state and its fulfillment.

Definition-time note: `subagents` on the *human* side of any agent remains an error — the human side of an approval gate cannot own children.

## 8. Definition-Time Errors

Implementations **MUST** reject the following at definition time:

1. Both sides human — **reserved**. The mediated human↔human thread is coherent and the restriction may lift in a later version, but 0.2.0 runtimes MUST reject it.
2. `subagents` declared on a human-backed side.
3. A side with zero backings, or more than one of `human` / `prompt` / `handler`.
4. A handler side referencing an undefined handler; a prompt side referencing an undefined prompt.
5. A relationship name (`as`) appearing on both sides of one agent, colliding with another tool name, or colliding with a reserved lifecycle tool name — see [Subagents §2](/0.2.0/specification/subagents#2-ownership-rules).
6. Session bindings (`sessionStop` / `sessionFail` / `sessionStatus`), `maxSteps`, or stop bindings on a non-prompt side.
7. A session binding that is not in object form ([§3](#3-sessiontoolbinding)).

Validation issues **SHOULD** be reported as a structured list (`code`, `severity`, `message`, `path`) so tooling can surface every problem in one pass.

## 9. Examples

### 9.1 Assistant (human × prompt)

The everyday user-facing assistant — a person on side B, a model on side A:

```typescript
defineAgent({
  name: 'assistant',
  sideA: { prompt: 'assistant' },
  sideB: { human: true },
});
```

### 9.2 Worker / Reviewer (prompt × prompt)

Two models converse; each side sees itself as `assistant` and the other as `user`. `maxSessionTurns` is optional but strongly recommended here — nothing external stops two models:

```typescript
defineAgent({
  name: 'asset_subagent',
  maxSessionTurns: 40,
  exposeAsTool: true,
  toolDescription: 'Generate and QA top-down game assets.',
  sideA: {
    label: 'Worker',
    prompt: 'asset_worker',
    stopOnResponse: true,
    sessionFail: {
      name: 'fail_asset',
      messageProperty: 'reason',
      attachmentsProperty: 'attachments',
    },
  },
  sideB: {
    label: 'Reviewer',
    prompt: 'asset_reviewer',
    stopOnResponse: false,
    sessionStop: {
      name: 'approve_asset',
      messageProperty: 'summary',
      attachmentsProperty: 'attachments',
    },
    sessionStatus: {
      name: 'update_asset_status',
      messageProperty: 'status',
    },
  },
});
```

### 9.3 Relay (handler × human)

A deterministic, model-less surface: a person talks to a handler that forwards traffic to a composed child and relays answers back. Zero LLM calls happen on this thread. The full pattern is worked through in [Handlers §9](/0.2.0/specification/handlers#9-worked-example-the-relay):

```typescript
defineAgent({
  name: 'relay_agent',
  sideA: {
    handler: 'relay_pipe',
    subagents: [{ agent: 'assistant_agent', maxInstances: 1 }],
  },
  sideB: { human: true },
});
```

## 10. TypeScript Reference

```typescript
type SideConfig = HumanSide | PromptSide | HandlerSide;

interface HumanSide {
  human: true;
  label?: string;
}

interface PromptSide {
  prompt: string;                     // StandardAgentSpec.Prompts
  label?: string;
  subagents?: SubagentRelationship[]; // see /0.2.0/specification/subagents
  stopOnResponse?: boolean;
  stopTool?: string;
  stopToolResponseProperty?: string;
  maxSteps?: number;
  sessionStop?: SessionToolBinding;
  sessionFail?: SessionToolBinding;
  sessionStatus?: SessionToolBinding;
}

interface HandlerSide {
  handler: string;                    // StandardAgentSpec.Handlers
  label?: string;
  subagents?: SubagentRelationship[];
}

interface SessionToolBinding {
  name: string;
  messageProperty?: string;
  attachmentsProperty?: string;
}

interface ParentHookRequirement {
  hook: string;
  reason: string;
  stage?: 'before_parent' | 'after_parent';
}

interface AgentDefinition<N extends string = string> {
  name: N;
  sideA: SideConfig;
  sideB: SideConfig;
  maxSessionTurns?: number;
  title?: string;
  description?: string;
  icon?: string;
  primary?: boolean;
  exposeAsTool?: boolean;
  toolDescription?: string;
  env?: Record<string, string>;
  hooks?: string[];
  parentHooks?: ParentHookRequirement[];
  // Packaging metadata: packageName, version, author, license
}

function defineAgent<N extends string>(
  options: AgentDefinition<N>
): AgentDefinition<N>;
```
