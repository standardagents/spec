# Threads

A thread is an instance of an agent — the runtime execution context where conversations happen. Each thread has isolated storage for messages and files, maintains its own conversation history, and can be handed off between agents while preserving full context.

This page covers the core ideas: what a thread is, its identity, the `ThreadState` interface, and the small primitives that live directly on it (resource loading, tool invocation, effects, events, context, runtime context, subagent hierarchy, lifecycle). Larger surfaces have their own pages:

- [Messages](/0.1.0/specification/threads/messages) — reading, injecting, queuing, updating, deleting
- [File System](/0.1.0/specification/threads/filesystem) — per-thread file storage, streaming, search
- [Code Execution](/0.1.0/specification/threads/code-execution) — isolated JS/TS sandbox via `runCode`
- [Execution State](/0.1.0/specification/threads/execution-state) — step counts, turn control, cancellation
- [Thread Endpoints](/0.1.0/specification/threads/endpoints) — HTTP APIs that receive a `ThreadState`

## 1. Thread Definition

A thread is an **instance** of an agent with isolated storage for messages and files.

### 1.1 Agent Assignment

The agent assigned to a thread can change over time while preserving all history and context. This is called a **handoff**.

| Scenario | Behavior |
|----------|----------|
| **Tool handoff** | Calling an `ai_human` agent as a tool transfers control to that agent |
| **Manual handoff** | Queue a tool call to an agent to trigger handoff programmatically |
| **dual_ai execution** | Creates its own isolated thread instance (no handoff) |

Handoffs enable workflows where specialized agents handle different parts of a conversation — a triage agent routes to support, support escalates to billing — all within the same thread with full context preserved.

### 1.2 ThreadState Interface

`ThreadState` is the unified interface for all thread operations. It provides a consistent API for interacting with threads regardless of context — whether from tools during execution, hooks, or HTTP endpoints.

#### 1.2.1 Properties

| Property | Type | Description |
|----------|------|-------------|
| `threadId` | `string` | Unique thread identifier (readonly) |
| `agentId` | `string` | Owning agent name (readonly) |
| `userId` | `string \| null` | Associated user (readonly) |
| `createdAt` | `number` | Creation timestamp in microseconds (readonly) |
| `children` | `SubagentRegistryEntry[]` | Resumable child subagent registry (readonly) |
| `terminated` | `number \| null` | Termination timestamp in microseconds, or null when active (readonly) |
| `context` | `Record<string, unknown>` | Per-execution key-value storage. See [Context Storage](#6-context-storage) |
| `execution` | `ExecutionState \| null` | Execution state during active execution, null at rest. See [Execution State](/0.1.0/specification/threads/execution-state) |
| `_notPackableRuntimeContext` | `Record<string, unknown> \| undefined` | Runtime-specific context (non-portable). See [Runtime Context](#9-runtime-context-non-portable) |

#### 1.2.2 Methods

The methods directory below is grouped by topic. Topics with their own page link out; the rest are documented on this page.

**Messages** — [Messages →](/0.1.0/specification/threads/messages)

| Method | Returns | Description |
|--------|---------|-------------|
| `getMessages(options?)` | `Promise<MessagesResult>` | Get messages with pagination |
| `getMessage(messageId)` | `Promise<Message \| null>` | Get single message by ID |
| `injectMessage(input)` | `Promise<Message>` | Inject a new message |
| `queueMessage(input)` | `Promise<void>` | Queue a message for delivery on next step |
| `updateMessage(messageId, updates)` | `Promise<Message>` | Update existing message |
| `deleteMessage(messageId)` | `Promise<boolean>` | Delete a message |

**File System** — [File System →](/0.1.0/specification/threads/filesystem)

| Method | Returns | Description |
|--------|---------|-------------|
| `writeFile(path, data, mimeType, options?)` | `Promise<FileRecord>` | Write file |
| `readFile(path)` | `Promise<ArrayBuffer \| null>` | Read file content |
| `readFileStream(path, options?)` | `Promise<AsyncIterable<FileChunk> \| null>` | Stream large files |
| `statFile(path)` | `Promise<FileRecord \| null>` | Get file metadata |
| `readdirFile(path)` | `Promise<ReaddirResult>` | List directory |
| `unlinkFile(path)` | `Promise<void>` | Delete file |
| `mkdirFile(path)` | `Promise<FileRecord>` | Create directory |
| `rmdirFile(path)` | `Promise<void>` | Remove directory |
| `getFileStats()` | `Promise<FileStats>` | Get filesystem stats |
| `grepFiles(pattern)` | `Promise<GrepResult[]>` | Search file contents |
| `findFiles(pattern)` | `Promise<FindResult>` | Find files by glob |
| `getFileThumbnail(path)` | `Promise<ArrayBuffer \| null>` | Get image thumbnail |

**Code Execution** — [Code Execution →](/0.1.0/specification/threads/code-execution)

| Method | Returns | Description |
|--------|---------|-------------|
| `runCode(source, options?)` | `CodeExecution` | Execute JS/TS source in an isolated sandbox; returns a thenable handle with `terminate()` |

**Subagent Hierarchy** — see [§8 Subagent Hierarchy](#8-subagent-hierarchy-communication-and-termination)

| Method | Returns | Description |
|--------|---------|-------------|
| `getChildThread(referenceId)` | `Promise<ThreadState \| null>` | Resolve child thread by subagent reference |
| `getParentThread()` | `Promise<ThreadState \| null>` | Resolve parent thread for this thread |
| `notifyParent(content)` | `Promise<void>` | Queue a silent message to this thread's parent |
| `setStatus(status)` | `Promise<void>` | Update this thread's status in the parent registry |

**Resource Loading** — see [§2 Resource Loading](#2-resource-loading)

| Method | Returns | Description |
|--------|---------|-------------|
| `loadModel(name)` | `Promise<T>` | Load model definition |
| `loadPrompt(name)` | `Promise<T>` | Load prompt definition |
| `loadAgent(name)` | `Promise<T>` | Load agent definition |
| `getPromptNames()` | `string[]` | List available prompts |
| `getAgentNames()` | `string[]` | List available agents |
| `getModelNames()` | `string[]` | List available models |
| `env(propertyName)` | `Promise<string>` | Resolve environment variable using thread/user/instance/agent/prompt precedence |
| `setEnv(propertyName, value)` | `Promise<void>` | Set a thread environment variable and propagate to active descendants |

**Tool Invocation** — see [§3 Tool Invocation](#3-tool-invocation)

| Method | Returns | Description |
|--------|---------|-------------|
| `queueTool(toolName, args)` | `void` | Queue tool for async execution |
| `invokeTool(toolName, args)` | `Promise<ToolResult>` | Invoke tool and wait for result |

**Effect Scheduling** — see [§4 Effect Scheduling](#4-effect-scheduling)

| Method | Returns | Description |
|--------|---------|-------------|
| `scheduleEffect(name, args, delay?)` | `Promise<string>` | Schedule effect, returns effect ID |
| `getScheduledEffects(name?)` | `Promise<ScheduledEffect[]>` | Get pending effects |
| `removeScheduledEffect(id)` | `Promise<boolean>` | Cancel scheduled effect |

**Events** — see [§5 Events](#5-events)

| Method | Returns | Description |
|--------|---------|-------------|
| `emit(event, data)` | `void` | Emit event to connected clients |

**Lifecycle** — see [§7 Lifecycle](#7-lifecycle)

| Method | Returns | Description |
|--------|---------|-------------|
| `terminate()` | `Promise<void>` | Soft-terminate the thread |

### 1.3 Access Contexts

`ThreadState` is provided in different contexts:

| Context | Execution State | Use Case |
|---------|-----------------|----------|
| Tools | Present | During agent execution |
| Hooks | Present | Lifecycle interception |
| Endpoints | Null | HTTP API access |

## 2. Resource Loading

### 2.1 Loading Definitions

`ThreadState` provides access to registered definitions:

```typescript
const model = await state.loadModel('gpt-4o');
const prompt = await state.loadPrompt('support-prompt');
const agent = await state.loadAgent('customer-support');
```

### 2.2 Listing Resources

```typescript
const prompts = state.getPromptNames();
const agents = state.getAgentNames();
const models = state.getModelNames();
```

### 2.3 Environment Variable Resolution

```typescript
const apiKey = await state.env('GOOGLE_API_KEY');
await state.setEnv('TOPDOWN_APPROVAL_GATE', 'open');
```

`env(propertyName)` resolves in this order:
1. Thread environment variables
2. User-account environment variables
3. Runtime instance environment variables
4. Agent definition defaults (`agent.env`)
5. Prompt definition defaults (`prompt.env`)

`setEnv(propertyName, value)` writes to thread storage and propagates recursively to active descendants. During propagation, descendants must filter out inherited values for variable names marked `scoped` in that descendant's agent graph. Terminated descendants are skipped.

Thread, user, and instance environment values should be encrypted at rest when the runtime supports encrypted storage.

For resumable subagent creation, runtimes may require missing scoped variables to be provided through a pending request flow before boot can continue. See [Agents §7.8](/0.1.0/specification/agents#78-scoped-variable-bootstrap).

## 3. Tool Invocation

### 3.1 Queuing Tools

Queue a tool for asynchronous execution:

```typescript
state.queueTool('send_email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Message content',
});
```

If the thread is currently executing, the tool is added to the queue. Otherwise, a new execution is started.

### 3.2 Direct Invocation

Invoke a tool and wait for the result:

```typescript
const result = await state.invokeTool('get_weather', {
  location: 'San Francisco',
});

if (result.status === 'success') {
  console.log(result.result);
}
```

## 4. Effect Scheduling

Effects are scheduled operations that run outside the normal tool execution context. Unlike tools which execute immediately during conversation, effects:
- Run **independently** of the conversation flow
- Can be **scheduled with delays**
- Execute with their own **ThreadState** context
- Are ideal for **side effects** that don't need immediate results

Effect definition syntax is specified in [Effects](/0.1.0/specification/effects). Packed effects may use qualified names (`{packageId}/{effectName}`) to avoid collisions.

### 4.1 Scheduling Effects

```typescript
const effectId = await state.scheduleEffect(
  'send_reminder_email',
  { to: 'user@example.com', subject: 'Reminder' },
  30 * 60 * 1000  // delay in milliseconds
);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Effect name (file in `agents/effects/`) |
| `args` | `Record<string, unknown>` | Arguments passed to effect handler |
| `delay` | `number` | Delay in milliseconds (default: 0 for immediate) |

Returns a unique effect ID (UUID) that can be used to cancel the effect.

### 4.2 ScheduledEffect Record

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique effect ID (UUID) |
| `name` | `string` | Effect name |
| `args` | `Record<string, unknown>` | Arguments to be passed |
| `scheduledAt` | `number` | Scheduled execution time (microseconds) |
| `createdAt` | `number` | When effect was scheduled (microseconds) |

### 4.3 Managing Scheduled Effects

```typescript
const effects = await state.getScheduledEffects();
const reminders = await state.getScheduledEffects('send_reminder_email');

const removed = await state.removeScheduledEffect(effectId);
if (removed) {
  console.log('Effect cancelled');
}
```

## 5. Events

### 5.1 Emitting Events

Send custom events to connected clients:

```typescript
state.emit('progress', {
  step: 3,
  total: 10,
  message: 'Processing data...',
});
```

Events are delivered via WebSocket to any connected clients.

### 5.2 Event Guidelines

- Event names **SHOULD** be lowercase with underscores
- Event data **MUST** be JSON-serializable
- Events **SHOULD NOT** contain sensitive information

## 6. Context Storage

### 6.1 Per-Execution Context

The `context` property provides temporary storage:

```typescript
state.context.userData = { id: 123, name: 'Alice' };

// Retrieve in another tool call
const user = state.context.userData;
```

### 6.2 Context Limitations

| Aspect | Behavior |
|--------|----------|
| **Scope** | Single execution only |
| **Persistence** | Lost after execution ends |
| **Type** | `Record<string, unknown>` |
| **Size** | No enforced limit |

For persistent storage across executions, use the [file system](/0.1.0/specification/threads/filesystem) or external storage.

## 7. Lifecycle

`terminate()` is a soft shutdown:

- Marks the thread inactive and sets `terminated`
- Aborts in-flight execution
- Rejects future `queueMessage()` and execution attempts
- Parent registries should reflect `'terminated'` status

```typescript
await state.terminate();
```

## 8. Subagent Hierarchy, Communication, and Termination

Subagent-aware runtimes expose parent/child thread relationships through `ThreadState`:

```typescript
const child = await state.getChildThread(referenceId);
const parent = await state.getParentThread();
```

`children` entries track resumable child references and status/projection metadata:

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

See [Agents §7](/0.1.0/specification/agents#7-subagents) for the full lifecycle, communication modes, and cross-thread semantics.

### 8.1 Cross-Thread Attachment Copying

When communication crosses thread boundaries, filesystem references must be copied:
- parent → child for invocation/messaging attachments
- child → parent for completion/failure payload attachments

Returned attachment paths must be valid in the receiving thread filesystem.

### 8.2 Lifecycle Status Messages

Runtimes may persist synthesized status messages (for example, system messages tagged with `metadata.status_kind`) to make cross-thread lifecycle events observable in message feeds.

### 8.3 Parent Messaging

Children can push information up the hierarchy without waiting for completion:

```typescript
await state.notifyParent('halfway through the batch');
await state.setStatus('running');
```

## 9. Runtime Context (Non-Portable)

The `_notPackableRuntimeContext` property allows runtime implementations to inject platform-specific context.

| Property | Type | Description |
|----------|------|-------------|
| `_notPackableRuntimeContext` | `Record<string, unknown> \| undefined` | Runtime-specific context injected by the implementation |

### 9.1 Portability

Tools that access `_notPackableRuntimeContext` cannot be packed, shared, or published to tool registries.

### 9.2 Example: Accessing a Host-Provided Binding

```typescript
import { defineTool } from '@standardagents/builder';
import { z } from 'zod';

export default defineTool({
  description: 'Query internal database',
  args: z.object({ userId: z.string() }),
  execute: async (state, args) => {
    const env = state._notPackableRuntimeContext?.env as HostEnv | undefined;

    if (!env?.DATABASE) {
      return { status: 'error', error: 'Database not available' };
    }

    const result = await env.DATABASE
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(args.userId)
      .first();

    return { status: 'success', result: JSON.stringify(result) };
  },
});
```

> **Tip:** The shape of `_notPackableRuntimeContext` is runtime-defined. Typical implementations expose either a handle to host bindings (databases, key-value stores, object storage) under `env`, or a process/environment handle for server-style runtimes. Consult your runtime's documentation for the specific contract.

## 10. Conformance Requirements

### 10.1 Thread Lifecycle

1. **Creation**: Thread created with metadata
2. **Execution**: Agent processes messages
3. **At Rest**: Thread accessible via endpoints
4. **Resumption**: New execution on next message

### 10.2 Platform Independence

`ThreadState` is an abstract interface. Implementations **MUST NOT** expose:
- Storage implementation details
- Platform-specific bindings
- Internal state management

### 10.3 Error Handling

Methods that return promises **SHOULD** throw on:
- Resource not found (loadModel, loadPrompt, loadAgent)
- Invalid parameters
- Storage errors

Methods **SHOULD NOT** throw on:
- Empty results (return empty arrays/null instead)
- Missing optional data

## 11. TypeScript Reference

```typescript
/**
 * Thread state interface - the unified API for thread interactions.
 * Available to tools, hooks, and endpoints.
 */
interface ThreadState {
  // ─────────────────────────────────────────────────────────────────────────
  // Identity (readonly)
  // ─────────────────────────────────────────────────────────────────────────
  readonly threadId: string;
  readonly agentId: string;
  readonly userId: string | null;
  readonly createdAt: number;
  readonly children: SubagentRegistryEntry[];
  readonly terminated: number | null;

  // ─────────────────────────────────────────────────────────────────────────
  // Messages — see /threads/messages
  // ─────────────────────────────────────────────────────────────────────────
  getMessages(options?: GetMessagesOptions): Promise<MessagesResult>;
  getMessage(messageId: string): Promise<Message | null>;
  injectMessage(input: InjectMessageInput): Promise<Message>;
  queueMessage(input: QueueMessageInput): Promise<void>;
  updateMessage(messageId: string, updates: MessageUpdates): Promise<Message>;
  deleteMessage(messageId: string): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // Resource Loading
  // ─────────────────────────────────────────────────────────────────────────
  loadModel<T = unknown>(name: string): Promise<T>;
  loadPrompt<T = unknown>(name: string): Promise<T>;
  loadAgent<T = unknown>(name: string): Promise<T>;
  getChildThread(referenceId: string): Promise<ThreadState | null>;
  getParentThread(): Promise<ThreadState | null>;
  getPromptNames(): string[];
  getAgentNames(): string[];
  getModelNames(): string[];
  env(propertyName: string): Promise<string>;
  setEnv(propertyName: string, value: string): Promise<void>;
  notifyParent(content: string): Promise<void>;
  setStatus(status: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Tool Invocation
  // ─────────────────────────────────────────────────────────────────────────
  queueTool(toolName: string, args: Record<string, unknown>): void;
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult>;

  // ─────────────────────────────────────────────────────────────────────────
  // Effect Scheduling
  // ─────────────────────────────────────────────────────────────────────────
  scheduleEffect(name: string, args: Record<string, unknown>, delay?: number): Promise<string>;
  getScheduledEffects(name?: string): Promise<ScheduledEffect[]>;
  removeScheduledEffect(id: string): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // Events
  // ─────────────────────────────────────────────────────────────────────────
  emit(event: string, data: unknown): void;

  // ─────────────────────────────────────────────────────────────────────────
  // Context Storage
  // ─────────────────────────────────────────────────────────────────────────
  context: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────────────
  // File System — see /threads/filesystem
  // ─────────────────────────────────────────────────────────────────────────
  writeFile(path: string, data: ArrayBuffer | string, mimeType: string, options?: WriteFileOptions): Promise<FileRecord>;
  readFile(path: string): Promise<ArrayBuffer | null>;
  readFileStream(path: string, options?: ReadFileStreamOptions): Promise<AsyncIterable<FileChunk> | null>;
  statFile(path: string): Promise<FileRecord | null>;
  readdirFile(path: string): Promise<ReaddirResult>;
  unlinkFile(path: string): Promise<void>;
  mkdirFile(path: string): Promise<FileRecord>;
  rmdirFile(path: string): Promise<void>;
  getFileStats(): Promise<FileStats>;
  grepFiles(pattern: string): Promise<GrepResult[]>;
  findFiles(pattern: string): Promise<FindResult>;
  getFileThumbnail(path: string): Promise<ArrayBuffer | null>;

  // ─────────────────────────────────────────────────────────────────────────
  // Code Execution — see /threads/code-execution
  // ─────────────────────────────────────────────────────────────────────────
  runCode(source: string, options?: CodeExecutionOptions): CodeExecution;

  // ─────────────────────────────────────────────────────────────────────────
  // Execution State — see /threads/execution-state
  // ─────────────────────────────────────────────────────────────────────────
  execution: ExecutionState | null;
  terminate(): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Runtime Context (Non-Portable)
  // ─────────────────────────────────────────────────────────────────────────
  readonly _notPackableRuntimeContext?: Record<string, unknown>;
}

/**
 * A scheduled effect pending execution.
 */
interface ScheduledEffect {
  id: string;
  name: string;
  args: Record<string, unknown>;
  scheduledAt: number;  // microseconds
  createdAt: number;    // microseconds
}
```
