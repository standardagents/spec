# Subagents

Subagents are autonomous `dual_ai` child agents spawned from a parent thread. They are the core composition primitive for building multi-agent workflows in Standard Agents.

## 1. Overview

A subagent is:
- always a `dual_ai` agent
- invoked from a parent prompt tool relationship
- executed in its own isolated thread (messages, logs, filesystem, queue, lifecycle)
- linked to its parent via thread hierarchy and child registry state

This allows composable systems where one orchestrator delegates bounded work to specialized child agents without merging storage or execution state.

## 2. Why Compose With Subagents

Subagents let you split responsibilities cleanly:
- parent orchestrates planning, sequencing, and aggregation
- child performs focused work with its own prompts/tools
- child can run synchronously (blocking) or asynchronously (non-blocking)
- child can be disposable (non-resumable) or persistent (resumable)

A common pattern is:
- `side_a` performs production work
- `side_b` reviews/criticizes/validates before session completion

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
- `initAgentNameProperty`: maps parent tool-call args -> child display name (implementations typically persist this as `name:<value>` tag).
- `resumable`: enables persistent child instances.
- `resumable.receives_messages`: controls which child side receives parent messages.
- `resumable.maxInstances`: limits concurrent instances per configured subagent tool.

## 5. Lifecycle Tools For Resumable Subagents

For resumable child instances, runtimes provide built-in lifecycle tools:

- `subagent_create`: create/run configured resumable subagents
- `subagent_message`: send messages to existing resumable instances

Non-resumable subagents continue to behave like normal tool calls (direct invocation, no persistent addressing).

When `maxInstances` is reached, new creation attempts should return a tool error explaining the cap and suggesting messaging an existing instance.

## 6. Session Lifecycle Bindings On Child Sides

Child completion/failure/status are defined on `SideConfig`:

- `sessionStop`
- `sessionFail`
- `sessionStatus`

Each supports:
- string form: tool name
- object form: `{ name, messageProperty?, attachmentsProperty? }`

Mapped properties are the canonical payload for child -> parent communication.

## 7. Parent <-> Child Communication

### 7.1 Parent -> Child

Parent communication occurs via:
- initial invocation mapping (`initUserMessageProperty`, `initAttachmentsProperty`)
- resumable messaging (`subagent_message`)

Attachment paths must be copied from parent filesystem -> child filesystem before queuing.

### 7.2 Child -> Parent: Completion

When the child finishes via `sessionStop` (or terminal completion policy), parent receives a queued silent message:

```text
Subagent (reference: {uuid}) has returned the following result:

{result}
```

If attachments are returned, they are copied child -> parent and included as parent-local paths.

### 7.3 Child -> Parent: Failure

When `sessionFail` is called successfully, parent receives:

```text
Subagent (reference: {uuid}) has reported a failure:

{failure details}
```

Returned attachments (if any) are also copied child -> parent.

### 7.4 Child -> Parent: Status

`sessionStatus` updates the parent's child registry status text without ending child execution.

## 8. Child Registry + Parent Context

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

When children exist, parent context should include a registry system message so the orchestrator model can reason about active instances.

## 9. ThreadState Additions

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

## 10. Queue + Termination Semantics

Queued messages are durable and ordered:
- if executing: inject before next model step
- if idle: force next turn
- persisted across eviction

`terminate()` is a soft shutdown:
- sets `terminated` timestamp
- aborts in-flight execution
- rejects new execution and queued-message entry
- updates parent registry status to `terminated` when applicable

## 11. Attachment Copying Requirements

Subagent communication that crosses thread boundaries must copy filesystem references:
- parent -> child for initial/resumable messaging attachments
- child -> parent for completion/failure payload attachments

The destination thread must receive destination-local attachment paths.
