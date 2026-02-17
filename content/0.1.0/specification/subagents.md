# Subagents

Subagents are autonomous `dual_ai` agents that run in their own thread and report results back to a parent thread.

## 1. What A Subagent Is

- A subagent is always a `dual_ai` agent invoked from a prompt's `tools` array.
- It executes in an isolated thread with its own messages, logs, and filesystem.
- Parent and child are linked in the thread registry.

Implementations commonly use:
- `side_a` for work execution (tools and production steps)
- `side_b` for reflection and quality checks

## 2. Invocation Modes

| | Blocking | Non-blocking |
|---|---|---|
| Non-resumable | Parent waits for completion | Parent continues immediately, result arrives later |
| Resumable | Parent waits per invocation, child stays alive | Parent can message child anytime, result arrives later |

## 3. Subagent Tool Configuration

Subagents are configured in `definePrompt({ tools: [...] })` using `SubagentToolConfig`:

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

Rules:
- `name` must reference a callable `dual_ai` agent.
- `blocking: false` returns immediately.
- `initUserMessageProperty` maps one tool argument field into the child's initial queued message content.
- `initAttachmentsProperty` maps one tool argument field (string path or path array) into initial child attachments.
- `initAgentNameProperty` maps one tool argument field into the spawned child thread display name. Implementations SHOULD persist this as a `name:<value>` thread tag for UI display.
- `resumable` enables persistent child instances and parent re-messaging.
- When `maxInstances` is reached, creation is blocked; implementations may route to existing instances.

## 4. Registry + Built-in Messaging Tool

Resumable children are tracked in the parent `children` registry:

```typescript
interface SubagentRegistryEntry {
  reference: string;
  name: string;
  description: string;
  status: string; // running | idle | terminated | custom
}
```

When registry entries exist, the parent context includes:
- A system message listing active child references and statuses
- Built-in `subagent_message` tool:

```typescript
{
  name: 'subagent_message',
  description: 'Send a message to a resumable subagent instance.',
  args: {
    referenceId: string;
    message: string;
    attachments: string[];
  }
}
```

When prompt-configured resumable subagents exist, the parent context also includes
built-in `subagent_create`:

```typescript
{
  name: 'subagent_create',
  description: 'Create and run a configured resumable subagent.',
  args: {
    agent: string;        // enum of allowed resumable subagent names
    message: string;
    attachments: string[];
    name?: string;        // optional human-friendly instance name
  }
}
```

`receives_messages` controls child-side routing:
- `'side_a'` -> queued as role `'user'`
- `'side_b'` -> queued as role `'assistant'`

## 5. Child -> Parent Communication

### 5.1 Completion Result

When a child completes, parent receives a queued silent message:

```
Subagent (reference: {uuid}) has returned the following result:

{result content}
```

Attachments are copied from child filesystem to parent filesystem with rewritten local paths.

### 5.2 Status Updates

`SideConfig.statusTool` lets a child publish progress to the parent registry:

```typescript
interface SideConfig {
  statusTool?: Callable;
}
```

Default statuses:
- `running` when child starts or receives a message
- `idle` when completion result is delivered
- `terminated` when thread is terminated

Custom status text from `statusTool` is allowed (for example, `"Processing file 3/7"`).

### 5.3 Terminal Failure Result

`SideConfig.failSessionTool` lets a child explicitly fail and stop its session:

```typescript
interface SideConfig {
  failSessionTool?: Callable;
}
```

When called successfully:
- The child thread stops immediately with an error outcome
- Parent receives a queued silent message:

```
Subagent (reference: {uuid}) has reported a failure:

{failure details}
```

- Any returned attachments are copied child -> parent using normal attachment-copy semantics

## 6. Thread API Additions

Subagent and queueing support is exposed in `ThreadState`:

```typescript
interface ThreadState {
  readonly children: SubagentRegistryEntry[];
  readonly terminated: number | null;
  queueMessage(message: QueueMessageInput): Promise<void>;
  getChildThread(referenceId: string): Promise<ThreadState | null>;
  getParentThread(): Promise<ThreadState | null>;
  terminate(): Promise<void>;
}
```

Queued message shape:

```typescript
interface QueueMessageInput {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Array<ToolAttachment | AttachmentRef>;
  silent?: boolean;
  metadata?: Record<string, unknown>;
}
```

## 7. Queued Message Semantics

- If thread is executing, messages are queued and injected before the next model call.
- If thread is idle, queueing forces a new turn.
- Messages are processed in order.
- Queue must be durable across worker/DO eviction.

## 8. Termination

`terminate()` is a soft shutdown:
- mark thread terminated with a timestamp
- abort in-flight work
- reject future execution and queued messages
- reflect `'terminated'` in parent registry when applicable

Non-resumable children are typically auto-terminated after delivering results.
