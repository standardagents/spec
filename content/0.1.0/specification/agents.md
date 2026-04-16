# Agents

An agent is the top-level conversation orchestrator in Standard Agents. Agents define:

- conversation type (`ai_human` or `dual_ai`)
- side prompts and stop behavior
- session lifecycle tool bindings
- optional tool exposure for handoff or subagent usage

A **subagent** is not a separate concept — it is a `dual_ai` agent invoked by a parent thread as a tool (see [§7 Subagents](#7-subagents)).

## 1. AgentDefinition

### 1.1 Required

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique agent identifier |
| `sideA` | `SideConfig` | Side A configuration |

### 1.2 Optional

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | `'ai_human' \| 'dual_ai'` | `'ai_human'` | Conversation mode |
| `sideB` | `SideConfig` | - | Required for `dual_ai` |
| `maxSessionTurns` | `number` | - | Session turn safety cap |
| `title` | `string` | - | Human-readable label (legacy) |
| `description` | `string` | - | Agent summary |
| `icon` | `string` | - | Display icon |
| `exposeAsTool` | `boolean` | `false` | Expose callable entrypoint |
| `toolDescription` | `string` | - | Callable description |
| `env` | `Record<string, string>` | - | Agent-level default variable values |
| `hooks` | `string[]` | - | Fallback hook IDs |

`AgentDefinition` also accepts optional packaging metadata — `packageName`, `version`, `author`, `license` — consumed only when the agent is packed for distribution. See [Packaging](/0.1.0/distribution/packaging).

## 2. Agent Types

### 2.1 `ai_human`

- Side A is AI.
- Side B is human (no Side B config required).
- Typical usage: user-facing assistants.

### 2.2 `dual_ai`

- Both sides are AI.
- Each side sees itself as `assistant`, other side as `user`.
- `maxSessionTurns` should be set for bounded execution.
- `dual_ai` agents can be used as autonomous subagents ([§7](#7-subagents)).

## 3. SideConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `prompt` | `string` | Required | Prompt name for this side |
| `label` | `string` | - | UI/log label |
| `stopOnResponse` | `boolean` | `true` | Stop side turn on text response without tool calls |
| `stopTool` | `string` | - | Stop side turn when this tool is called |
| `stopToolResponseProperty` | `string` | - | Extracted property for stop tool outcomes |
| `maxSteps` | `number` | - | Per-side step safety limit |
| `sessionStop` | `SessionToolBinding` | - | End session successfully |
| `sessionFail` | `SessionToolBinding` | - | End session with failure |
| `sessionStatus` | `SessionToolBinding` | - | Publish status updates |

## 4. SessionToolBinding

Session lifecycle bindings can be string or object form:

```typescript
type SessionToolBinding =
  | string
  | {
      name: string;
      messageProperty?: string;
      attachmentsProperty?: string;
    };
```

- `name`: tool that controls lifecycle action
- `messageProperty`: which arg field becomes lifecycle message text
- `attachmentsProperty`: which arg field contains attachment path(s)

For subagents, mapped stop/fail payloads are the canonical child → parent result/failure payload.

## 5. Stop Semantics

Runtime stop evaluation order:

1. session-level terminal bindings (`sessionStop` / `sessionFail`)
2. side-level stop bindings (`stopTool`)
3. response stop (`stopOnResponse`)
4. safety limits (`maxSteps`, `maxSessionTurns`)

## 6. Tool Exposure

When `exposeAsTool: true`, how the callable behaves depends on agent type:

| Agent type | Callable semantics |
|------------|--------------------|
| `ai_human` | Handoff: the tool-call transfers control to the target agent on the same thread, preserving history. |
| `dual_ai` | Subagent: the tool-call spawns a new child thread governed by [§7 Subagents](#7-subagents). |

## 7. Subagents

Subagents are autonomous `dual_ai` child agents spawned from a parent thread. They are the composition primitive for multi-agent workflows.

### 7.1 What a Subagent Is

- Always a `dual_ai` agent.
- Invoked from a parent prompt's tool list.
- Executed in its own isolated [thread](/0.1.0/specification/threads) (messages, filesystem, queue, lifecycle).
- Linked to its parent via thread hierarchy and child registry state.

This lets orchestrators delegate bounded work to specialized children without merging storage or execution state.

### 7.2 Why Compose

- Parent orchestrates planning, sequencing, and aggregation.
- Child performs focused work with its own prompts/tools.
- Child can run synchronously (blocking) or asynchronously (non-blocking).
- Child can be disposable (non-resumable) or persistent (resumable).

A common pattern: `side_a` produces, `side_b` reviews/validates before completion.

### 7.3 Invocation Modes

|                | Blocking                                  | Non-blocking                                |
|----------------|-------------------------------------------|---------------------------------------------|
| Non-resumable  | Parent waits; child ends after result     | Parent continues; child returns result later |
| Resumable      | Parent waits per invocation; child persists | Parent can message anytime; child persists |

### 7.4 Configuration

Subagents are configured in `definePrompt({ tools: [...] })` via `SubagentToolConfig`. The type and per-field semantics are documented in [Tools §5](/0.1.0/specification/tools#5-subagent-tool-configuration).

The key knobs:

- `blocking` — parent waits for child result.
- `immediate` — execute as soon as the prompt becomes active, before the first model step. Object form allows per-instance `nameEnv` / `descriptionEnv` hints and `scopedEnv` transfer.
- `optional` — environment flag gating whether this branch is enabled.
- `resumable` — persistent child instances addressable via lifecycle tools.
- `resumable.parentCommunication` — `implicit` (default) auto-queues completion/failure to the parent; `explicit` leaves escalation to tools/hooks.

### 7.5 Optional Branches

When `optional` is set, the branch is enabled only when the named environment variable resolves to one of `true`, `1`, or `yes` (case-insensitive). Disabled branches are not available for creation or runtime invocation.

### 7.6 Immediate Execution

When `immediate` is enabled, runtimes execute the subagent tool immediately when its prompt becomes active:

- thread creation bootstrap
- handoff to a new active prompt

Immediate execution is recursive: if an immediate subagent boots and its active prompt has immediate tools, those execute as soon as the child thread activates.

In the object form:

- runtimes **MAY** use `nameEnv` and `descriptionEnv` as model-visible hints when deriving initial child arguments via a bootstrap pass.
- runtimes **MUST** treat `scopedEnv` as runtime-only transfer data.
- runtimes **MUST NOT** expose `scopedEnv` values to the model unless the same env is explicitly declared as `nameEnv` or `descriptionEnv`.

### 7.7 Resumable Lifecycle Tools

For resumable instances, runtimes expose built-in lifecycle tools:

- `subagent_create`
- `subagent_message`

Non-resumable subagents behave like direct tool calls (no persistent addressing).

When `maxInstances` is reached, new creation attempts **SHOULD** return a tool error explaining the cap and suggesting messaging an existing instance.

### 7.8 Scoped Variable Bootstrap

If `subagent_create` is called but required scoped variables for that child graph are missing, runtimes **SHOULD** return a structured error (e.g. `subagent_env_required`) and expose a temporary bootstrap endpoint:

- `GET /threads/{parent_thread_id}/variables/{request_id}`
- `POST /threads/{parent_thread_id}/variables/{request_id}`

Expected behavior:

- `GET` returns required/missing variable names.
- `POST` stores the provided values and immediately boots the deferred subagent using the original creation payload.

### 7.9 Session Lifecycle Bindings on Child Sides

Child completion, failure, and status are defined on each side's `SideConfig`:

- `sessionStop`
- `sessionFail`
- `sessionStatus`

Each supports the string and object forms from [§4](#4-sessiontoolbinding). Mapped properties are the canonical payload for child → parent communication.

### 7.10 Parent ↔ Child Communication

#### Parent → Child

Parent communication occurs via:

- initial invocation mapping (`initUserMessageProperty`, `initAttachmentsProperty`)
- resumable messaging (`subagent_message`)

Attachment paths **MUST** be copied from the parent filesystem to the child filesystem before queuing ([§7.12](#712-attachment-copying)).

#### Child → Parent: Completion

When the child finishes via `sessionStop` and `parentCommunication` is `implicit`, the parent receives a queued silent message:

```text
Subagent (reference: {uuid}) has returned the following result:

{result}
```

Returned attachments (if any) are copied child → parent and included as parent-local paths.

#### Child → Parent: Failure

When `sessionFail` is called and `parentCommunication` is `implicit`, the parent receives:

```text
Subagent (reference: {uuid}) has reported a failure:

{failure details}
```

Returned attachments are copied child → parent.

#### Child → Parent: Status

`sessionStatus` updates the parent's child registry status text without ending child execution.

#### Child → Parent: Explicit Escalation

When `resumable.parentCommunication` is `explicit`, runtimes **MUST NOT** auto-queue completion/failure to the parent. Tools or hooks escalate explicitly:

- `state.notifyParent(content)`
- `state.setStatus(status)`

See [Threads](/0.1.0/specification/threads#8-subagent-hierarchy-communication-and-termination) for the host-side surface.

### 7.11 Child Registry

Resumable instances are tracked in `ThreadState.children`:

```typescript
interface SubagentRegistryEntry {
  reference: string;
  name: string;
  title?: string;
  description: string;
  resumable?: boolean;
  blocking?: boolean;
  threadName?: string;
  spawnGroupId?: string;
  createdAt?: number;
  status: string;
  parentCommunication?: 'implicit' | 'explicit';
}
```

When children exist, parent context **SHOULD** include a registry system message so the orchestrator can reason about active instances.

### 7.12 Attachment Copying

Subagent communication that crosses thread boundaries **MUST** copy filesystem references:

- parent → child for initial and resumable messaging attachments
- child → parent for completion and failure payload attachments

The destination thread **MUST** receive destination-local attachment paths.

### 7.13 Queue and Termination

These are properties of the underlying thread, not of subagents specifically. See [Threads](/0.1.0/specification/threads) for the full queue and termination semantics:

- queued messages are durable and ordered; injected before the next model step when executing, otherwise forcing the next turn.
- `terminate()` is a soft shutdown that aborts in-flight execution, rejects new execution/queued-message entry, and updates parent registry status to `terminated` when applicable.

## 8. Example

```typescript
defineAgent({
  name: 'asset_subagent',
  type: 'dual_ai',
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
