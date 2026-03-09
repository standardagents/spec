# Subagents

Subagents are autonomous `dual_ai` child agents spawned from a parent thread. They are the core composition primitive for multi-agent workflows in Standard Agents.

## 1. Overview

A subagent is:
- always a `dual_ai` agent
- invoked from a parent prompt tool relationship
- executed in its own isolated thread (messages, logs, filesystem, queue, lifecycle)
- linked to its parent via thread hierarchy and child registry state

This allows orchestrators to delegate bounded work to specialized children without merging storage or execution state.

## 2. Why Compose With Subagents

Subagents let systems separate responsibilities:
- parent orchestrates planning, sequencing, and aggregation
- child performs focused work with its own prompts/tools
- child can run synchronously (blocking) or asynchronously (non-blocking)
- child can be disposable (non-resumable) or persistent (resumable)

A common pattern is:
- `side_a` does production work
- `side_b` reviews/criticizes/validates before completion

## 3. Invocation Modes

| | Blocking | Non-blocking |
|---|---|---|
| Non-resumable | Parent waits; child ends after result | Parent continues; child returns result later |
| Resumable | Parent waits per invocation; child persists | Parent can message anytime; child persists |

## 4. Prompt-Level Configuration

Subagents are configured in `definePrompt({ tools: [...] })` via `SubagentToolConfig`:

```typescript
interface SubagentToolConfig {
  name: StandardAgentSpec.Callables;
  blocking?: boolean; // default: true
  initUserMessageProperty?: string;
  initAttachmentsProperty?: string;
  initAgentNameProperty?: string;
  immediate?: boolean | {
    nameEnv?: string;
    descriptionEnv?: string;
    scopedEnv?: string[];
  };
  optional?: string;
  resumable?: false | {
    receives_messages: 'side_a' | 'side_b';
    maxInstances?: number;
  };
}
```

### 4.1 Field Semantics

- `name`: callable `dual_ai` agent.
- `blocking`: if `false`, return immediately and complete asynchronously.
- `initUserMessageProperty`: maps parent tool-call args -> initial child message content.
- `initAttachmentsProperty`: maps parent tool-call args -> initial child attachment paths.
- `initAgentNameProperty`: maps parent tool-call args -> child display name (often persisted as `name:<value>` tag).
- `immediate`: run this subagent tool as soon as the prompt becomes active (before the first model step).
- `immediate.nameEnv`: safe per-instance env used as the name hint for bootstrap.
- `immediate.descriptionEnv`: safe per-instance env used as the description hint for bootstrap.
- `immediate.scopedEnv`: per-instance envs copied into the child thread.
- `optional`: environment flag name controlling whether this subagent branch is enabled.
- `resumable`: enables persistent child instances.
- `resumable.receives_messages`: controls which child side receives parent messages.
- `resumable.maxInstances`: limits concurrent instances per configured subagent tool.

## 5. Optional + Immediate Behavior

### 5.1 Optional Branches

When `optional` is set, the branch is enabled only when the named environment variable resolves to one of:
- `true`
- `1`
- `yes`

(case-insensitive)

Disabled optional branches are not available for creation/runtime invocation.

### 5.2 Immediate Execution

When `immediate` is enabled, runtimes execute the tool immediately when the prompt becomes active:
- thread creation bootstrap
- handoff to a new active prompt

This is recursive: if an immediate subagent is booted and its active prompt has immediate tools, those tools execute as soon as that child thread activates.

When `immediate` is the object form:
- runtimes may use `nameEnv` and `descriptionEnv` as the only model-visible hints for deriving initial child arguments
- runtimes must treat `scopedEnv` as runtime-only transfer data
- runtimes must not expose `scopedEnv` values to the model unless the same env is explicitly declared as `nameEnv` or `descriptionEnv`

## 6. Lifecycle Tools For Resumable Subagents

For resumable instances, runtimes provide built-in lifecycle tools:
- `subagent_create`
- `subagent_message`

Non-resumable subagents continue to behave like direct tool calls (no persistent addressing).

When `maxInstances` is reached, new creation attempts should return a tool error explaining the cap and suggesting messaging an existing instance.

## 7. Scoped Variable Bootstrap Flow

If `subagent_create` is called but required scoped variables for that child graph are missing, runtimes should return a structured, actionable error (for example `subagent_env_required`) and expose a temporary bootstrap endpoint:

- `GET /threads/{parent_thread_id}/variables/{request_id}`
- `POST /threads/{parent_thread_id}/variables/{request_id}`

Expected behavior:
- `GET` returns required/missing variable names.
- `POST` stores provided values and immediately boots the deferred subagent using the original creation payload.

## 8. Session Lifecycle Bindings On Child Sides

Child completion/failure/status are defined on `SideConfig`:
- `sessionStop`
- `sessionFail`
- `sessionStatus`

Each supports:
- string form: tool name
- object form: `{ name, messageProperty?, attachmentsProperty? }`

Mapped properties are the canonical payload for child -> parent communication.

## 9. Parent <-> Child Communication

### 9.1 Parent -> Child

Parent communication occurs via:
- initial invocation mapping (`initUserMessageProperty`, `initAttachmentsProperty`)
- resumable messaging (`subagent_message`)

Attachment paths must be copied from parent filesystem -> child filesystem before queuing.

### 9.2 Child -> Parent: Completion

When the child finishes via `sessionStop` (or terminal completion policy), parent receives a queued silent message:

```text
Subagent (reference: {uuid}) has returned the following result:

{result}
```

If attachments are returned, they are copied child -> parent and included as parent-local paths.

### 9.3 Child -> Parent: Failure

When `sessionFail` is called successfully, parent receives:

```text
Subagent (reference: {uuid}) has reported a failure:

{failure details}
```

Returned attachments (if any) are also copied child -> parent.

### 9.4 Child -> Parent: Status

`sessionStatus` updates the parent's child registry status text without ending child execution.

## 10. Child Registry + Parent Context

Resumable instances are tracked in `ThreadState.children`.

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
}
```

When children exist, parent context should include a registry system message so the orchestrator can reason about active instances.

## 11. ThreadState Additions

Subagent-aware runtimes expose:

```typescript
interface ThreadState {
  readonly children: SubagentRegistryEntry[];
  readonly terminated: number | null;

  getChildThread(referenceId: string): Promise<ThreadState | null>;
  getParentThread(): Promise<ThreadState | null>;

  queueMessage(input: QueueMessageInput): Promise<void>;
  terminate(): Promise<void>;
}
```

## 12. Queue + Termination Semantics

Queued messages are durable and ordered:
- if executing: inject before next model step
- if idle: force next turn
- persisted across eviction

`terminate()` is a soft shutdown:
- sets `terminated` timestamp
- aborts in-flight execution
- rejects new execution and queued-message entry
- updates parent registry status to `terminated` when applicable

## 13. Attachment Copying Requirements

Subagent communication that crosses thread boundaries must copy filesystem references:
- parent -> child for initial/resumable messaging attachments
- child -> parent for completion/failure payload attachments

The destination thread must receive destination-local attachment paths.
