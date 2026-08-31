# Subagents

A **subagent** is any agent composed as a child of another agent. The child runs in its own isolated [thread](/0.2.0/specification/threads) — messages, filesystem, queue, lifecycle — linked to the parent through the thread hierarchy and the parent's child registry.

Any agent may be composed as a child; composing one with a human side [puts a person's step inside the composition](/0.2.0/specification/agents#7-human-in-the-loop-composition). A subagent relationship is part of the agent's structure: it is declared on the agent side that owns it, never inside a prompt's `tools` array.

## 1. SubagentRelationship

Relationships are declared in the `subagents` array of a prompt- or handler-backed [side](/0.2.0/specification/agents#12-sideconfig):

```typescript
interface SubagentRelationship {
  agent: string;                // which agent definition to instantiate
  as?: string;                  // relationship name; defaults to `agent`
  description?: string;         // model-facing override; falls back to the child's toolDescription
  maxInstances?: number;        // unset = unbounded
  immediate?: boolean | {       // spawn at THREAD CREATION
    nameEnv?: string;
    descriptionEnv?: string;
    scopedEnv?: string[];
  };
  blocking?: boolean;           // subagent_create awaits session close and returns its result
  parentCommunication?: 'implicit' | 'explicit';
  scopedEnv?: string[];
  initUserMessageProperty?: string;
  initAttachmentsProperty?: string;
  initAgentNameProperty?: string;
  optional?: string;            // env flag gating this branch
  hidden?: boolean;             // spawnable by code, invisible to models
}
```

| Property | Description |
|----------|-------------|
| `agent` | The agent definition to instantiate. Any agent is eligible; `exposeAsTool: true` marks it as designed for composition and supplies the default `toolDescription`. |
| `as` | The **relationship name** — the tool-surface name, registry identity, and reference name. Defaults to `agent`. Two relationships may target the same `agent` under different `as` names, each with independent config ([§2.3](#23-aliases)). |
| `description` | Model-facing description override for this relationship. |
| `maxInstances` | Cap on simultaneous instances. When reached, creation attempts **SHOULD** return a tool error explaining the cap and suggesting messaging an existing instance. |
| `immediate` | Spawn at **thread creation**, before any side takes a turn ([§3.2](#32-immediate-spawning)). |
| `blocking` | `subagent_create` waits for the child session to close and returns its result ([§3.3](#33-blocking-and-create-or-continue)). |
| `parentCommunication` | `implicit` (default) auto-queues child completion/failure to the parent; `explicit` leaves escalation to tools, hooks, and handlers ([§6.4](#64-child--parent-explicit-escalation)). |
| `scopedEnv` | Environment values copied into the child thread; runtime-only transfer data. |
| `initUserMessageProperty` / `initAttachmentsProperty` / `initAgentNameProperty` | Map creation arguments into the child's initial user message, attachments, and display name. |
| `optional` | The branch is enabled only when the named environment flag resolves to `true`, `1`, or `yes` (case-insensitive). Disabled branches are unavailable for creation and runtime invocation. |
| `hidden` | The relationship stays declared — code paths can still spawn the child — but it is excluded from every LLM request's tool surface. For infrastructure children the model must never invoke. |

## 2. Ownership Rules

### 2.1 The Owning Side

A relationship **belongs to the side that declares it**. Ownership determines where child traffic lands: `notifyParent` content, implicit completion/failure messages, and status-bearing queue traffic from instances of the relationship are delivered on the **owning side's perspective** — queued in the role that prompts the owning side's next turn (`user` for a side-A-owned relationship, `assistant` for a side-B-owned relationship, per the [perspective mapping](/0.2.0/specification/threads/messages#4-queueing-messages)).


### 2.2 Single Owner

A relationship name (`as`, defaulted or explicit) may appear on **at most one side** of an agent. Declaring the same name on both sides is a definition-time error. The sibling side has no model-facing path to those children; code paths via `ThreadState` remain available to it. Cross-side grants (one side auditing the other side's children through granted tools) are deliberately deferred — a door recorded closed, to be reopened with a real use case.

### 2.3 Aliases

Two relationships may target the same `agent` under different `as` names — for example, two calendar teams with different `scopedEnv`:

```typescript
sideA: {
  prompt: 'coordinator',
  subagents: [
    { agent: 'calendar_agent', as: 'work_calendar',     scopedEnv: ['WORK_CAL_ID'] },
    { agent: 'calendar_agent', as: 'personal_calendar', scopedEnv: ['PERSONAL_CAL_ID'] },
  ],
},
```

Everything model-facing — tool schemas, registries, lifecycle references — uses the relationship name. The `agent` argument of `subagent_create` / `subagent_message` enumerates **relationship names, not agent names**.

### 2.4 Reserved Names

Relationship names share the tool namespace. A relationship name that collides with another tool name is a definition-time error, and the injected lifecycle tool names — `subagents`, `subagent_create`, `subagent_message` — are explicitly **reserved**: a colliding `as` **MUST** be rejected with a dedicated validation code.

### 2.5 Visibility

- **Prompt-backed owning side**: the side's prompt automatically receives the lifecycle tools ([§5](#5-lifecycle-tools)) for the side's non-hidden relationships. Prompts do **not** declare relationships in `tools` — a `tools` entry attempting to configure a subagent relationship is a definition-time error.
- **Handler-backed owning side**: handlers need no tool grant; they reach children through `ThreadState` directly. The declaration's job for a handler side is existence, configuration, and lifecycle.
- **Human-backed side**: may not own relationships (definition-time error) — nothing there can invoke them.

## 3. Spawning

### 3.1 Creation Paths

Instances are created by:

- the injected `subagent_create` lifecycle tool (prompt-backed sides),
- runtime code (`invokeTool` / `queueTool` on the lifecycle surface, or dedicated runtime APIs) from tools, hooks, and handlers,
- `immediate` configuration at thread creation.

### 3.2 Immediate Spawning

`immediate` relationships spawn at **thread creation**, before any side takes a turn — immediate children exist even when the first inbound message arrives instantly, and when the owning side is a handler with no prompt to activate. Immediate spawning is recursive: if an immediate child's own sides declare immediate relationships, those spawn as the child thread activates.

In the object form:

- runtimes **MAY** use `nameEnv` and `descriptionEnv` as model-visible hints when deriving initial child arguments via a bootstrap pass.
- runtimes **MUST** treat `scopedEnv` as runtime-only transfer data.
- runtimes **MUST NOT** expose `scopedEnv` values to the model unless the same env name is explicitly designated by `nameEnv` or `descriptionEnv`.

### 3.3 Blocking and Create-or-Continue

`blocking: true` makes `subagent_create` await the child session's close and return its result payload.

When `blocking: true` is combined with `maxInstances: 1` and an instance already exists, `subagent_create` **MUST** behave as **create-or-continue**: message the existing instance and await *that* session's close, rather than erroring on the cap. This is what callers invariably mean by "run the child again."

> **Warning:** A [handler](/0.2.0/specification/handlers#4-delivery-semantics) that awaits a blocking child holds its thread's one-at-a-time delivery slot for the whole child session. Prefer non-blocking spawning from handlers.

## 4. Instance Lifecycle

### 4.1 Persistence Is Universal

**Every child instance is a persistent thread.** There are no disposable instances and no opt-in persistence wrapper — there is one lifecycle:

- **Session end never terminates a thread.** When a child session ends — stop, fail, error, or turn-cap — the registry status transitions (`running` → `idle` / `failed`), the thread remains addressable, and a later message starts a **new session with history intact**. Runtimes **MUST NOT** destroy or orphan child threads on any session-finalization path.
- **Only explicit termination destroys an instance**: `state.terminate()`, operator action, or a parent teardown policy.
- `blocking` is purely a *waiting style* — whether the creating call awaits the session — and is orthogonal to persistence.

What a runtime does with old or idle threads — archival, eviction, listing policy — is **out of scope for this specification**; retention is entirely the runtime's business.

### 4.2 Registry

Instances are tracked in the parent's `ThreadState.children`:

```typescript
interface SubagentRegistryEntry {
  reference: string;                  // stable instance reference (UUID)
  relationship: string;               // the relationship name (`as`)
  name: string;                       // the child agent definition name
  title?: string;
  description: string;
  blocking?: boolean;
  threadName?: string;
  initialArguments?: Record<string, unknown>;
  spawnGroupId?: string;
  createdAt?: number;
  status: string;                     // e.g. running | idle | failed | awaiting_human | terminated
  parentCommunication?: 'implicit' | 'explicit';
}
```

`relationship` is the composition identity (which declared relationship spawned this instance); `name` is the implementing agent. Aliased relationships targeting the same agent are distinguished by `relationship`.

Child visibility is pull-based: runtimes inject the `subagents` query tool ([§5](#5-lifecycle-tools)) and **MUST NOT** additionally inject an ambient registry system message — a registry block that mutates between requests invalidates provider prefix caches and reads as out-of-dialogue state. Completions arrive as messages.

### 4.3 Human-in-the-Loop Children

A child whose current turn belongs to a human-backed side parks with registry status `awaiting_human`. The session resumes when human input arrives on that side's perspective; the specification defines only this waiting state, not who supplies the input or through which interface ([Agents §7](/0.2.0/specification/agents#7-human-in-the-loop-composition)).

## 5. Lifecycle Tools

For a prompt-backed side with non-hidden relationships, runtimes inject three built-in tools scoped to that side's declarations:

- **`subagents`** — the pull-based visibility surface. Takes no arguments; returns the registry snapshot for the side's relationships — reference, relationship name, agent name, status, working-status text, initial arguments, creation time. Injected tool descriptions **SHOULD** direct the model to call `subagents` before `subagent_create` so existing instances are reused rather than duplicated.
- **`subagent_create`** — creates (or continues, [§3.3](#33-blocking-and-create-or-continue)) an instance. Its `agent` argument **MUST** enumerate the side's enabled relationship *names*. It **MUST** require a non-empty `name` argument for the spawned instance; runtimes **SHOULD** persist this as a human-readable child thread display name.
- **`subagent_message`** — queues a message to an existing instance by reference.

All lifecycle references use relationship names, never an internal agent identifier that differs from them. Runtimes **MUST** reject lifecycle invocations that target undeclared or disabled relationships without creating a child.

`subagent_create` **SHOULD** expose a structured `arguments` object whose schema is dictated by the receiving child ([§5.1](#51-persistent-invocation-arguments)).

### 5.1 Persistent Invocation Arguments

The invocation arguments a subagent accepts are dictated solely by the *receiving* agent, through the `requiredSchema` of its side A prompt. (Parent traffic enters the child in the side B perspective, `role: 'user'`, so side A acts on it, exactly as for an external caller — see [§6.1](#61-parent--child).) Required schema fields are mandatory; optional fields are suggested.

Unlike a plain tool call, these arguments are **not** ephemeral:

- runtimes **MUST** validate them against the schema and persist the validated arguments for the life of the child thread.
- runtimes **MUST** hydrate them into `ThreadState.arguments` and prompt variable interpolation for **both** child sides on every activation — the initial invocation and every later resume — so spawn-time context (a stylist child that needs sizes and preferences, say) is available for as long as the thread lives.
- if required arguments are missing, runtimes **MUST** reject creation with a structured `subagent_arguments_required` error rather than spawning the child.

### 5.2 Scoped Variable Bootstrap

If `subagent_create` cannot proceed because required scoped variables for the child graph are missing, runtimes **SHOULD** return a structured error (e.g. `subagent_env_required`) with a request ID and expose a temporary bootstrap endpoint:

- `GET /threads/{parent_thread_id}/variables/{request_id}` — returns required/missing variable names.
- `POST /threads/{parent_thread_id}/variables/{request_id}` — stores the provided values and immediately boots the deferred child using the original creation payload.

## 6. Parent ↔ Child Communication

### 6.1 Parent → Child

- initial invocation mapping (`initUserMessageProperty`, `initAttachmentsProperty`)
- ongoing messaging (`subagent_message`, or `queueMessage` on the child's `ThreadState` from code)

Parent traffic enters the child in the **side B perspective** (`role: 'user'`): the child's side A acts on it, exactly as it would for an external caller. Routing is structural in both directions — parent→child entry is uniform, and child→parent delivery is determined by the relationship's owning side ([§2.1](#21-the-owning-side)).

Attachment paths **MUST** be copied from the parent filesystem to the child filesystem before queuing ([§7](#7-attachment-copying)).

### 6.2 Child → Parent: Completion and Failure

When the child session ends via `sessionStop` and the effective `parentCommunication` is `implicit`, the parent receives a queued silent message **on the owning side's perspective**:

```text
Subagent (reference: {uuid}) has returned the following result:

{result}
```

`sessionFail` similarly delivers a failure message. Returned attachments (if any) are copied child → parent and included as parent-local paths. Session end transitions registry status — it never terminates the child thread ([§4.1](#41-persistence-is-universal)).

### 6.3 Child → Parent: Status

`sessionStatus` (and `state.setStatus()`) updates the parent's registry status text without ending child execution.

### 6.4 Child → Parent: Explicit Escalation

When the effective `parentCommunication` is `explicit`, runtimes **MUST NOT** auto-queue completion/failure to the parent. Because the auto-queued completion is what triggers a parent turn, `explicit` means a child's finish does not wake the parent at all. Tools, hooks, and handlers escalate deliberately:

- `state.notifyParent(content)`
- `state.setStatus(status)`
- `state.stopSession({ result, notifyParent, status })`

Such children deliver results through another channel — the parent's key-value store, for example — which the parent picks up on its next natural turn.

### 6.5 Provenance Metadata

Runtimes **SHOULD** set standard, OPTIONAL provenance metadata on cross-thread traffic (see [Messages §1.1](/0.2.0/specification/threads/messages#11-provenance-metadata-conventions)):

- `metadata.subagent_id` — the child instance reference a message relates to.
- `metadata.forwarded_from` — the origin thread/message of forwarded content.

These conventions replace ad-hoc bracket-tag prefixes in userland relay code. They are conventions, not requirements.

## 7. Attachment Copying

Subagent communication that crosses thread boundaries **MUST** copy filesystem references:

- parent → child for initial and ongoing messaging attachments
- child → parent for completion and failure payload attachments

The destination thread **MUST** receive destination-local attachment paths.

## 8. Queue and Termination

These are properties of the underlying thread, not of subagents specifically. See [Threads](/0.2.0/specification/threads):

- queued messages are durable and ordered; injected before the next step when executing, otherwise forcing the next turn.
- `terminate()` is the *only* soft-destruction path: it aborts in-flight execution, rejects new execution and queued-message entry, and updates parent registry status to `terminated`.

## 9. Example

A coordinator owning an aliased pair of calendar teams and a blocking research child:

```typescript
defineAgent({
  name: 'assistant_agent',
  sideA: {
    prompt: 'coordinator',
    subagents: [
      { agent: 'calendar_agent', as: 'work_calendar',     scopedEnv: ['WORK_CAL_ID'] },
      { agent: 'calendar_agent', as: 'personal_calendar', scopedEnv: ['PERSONAL_CAL_ID'] },
      { agent: 'research_agent', blocking: true, maxInstances: 1 },
      { agent: 'approval_gate' },   // human-in-the-loop child — parks awaiting_human
    ],
  },
  sideB: { human: true },
});
```

The coordinator's prompt automatically receives `subagents`, `subagent_create`, and `subagent_message`, with `subagent_create.agent` enumerating `'work_calendar' | 'personal_calendar' | 'research_agent' | 'approval_gate'`.
