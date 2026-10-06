# Threads

A thread is an instance of an agent — the runtime execution context where conversations happen. Each thread has isolated storage for messages and files, maintains its own conversation history, and can be handed off between agents while preserving full context.

This page covers the core ideas: what a thread is, its identity, the `ThreadState` interface, and the small primitives that live directly on it (resource loading, tool invocation, effects, events, context, runtime context, subagent hierarchy, lifecycle). Larger surfaces have their own pages:

- [Decisions](/0.2.0/specification/decisions) — explicit question evaluation with automatic operation logs
- [Messages](/0.2.0/specification/threads/messages) — reading, injecting, queuing, updating, deleting
- [File System](/0.2.0/specification/threads/filesystem) — per-thread file storage, streaming, search
- [Code Execution](/0.2.0/specification/threads/code-execution) — isolated JS/TS sandbox via `runCode`
- [Runtime Streams](/0.2.0/specification/threads/runtime-streams) — optional live byte streams supplied by the execution host
- [Execution State](/0.2.0/specification/threads/execution-state) — step counts, turn control, cancellation
- [Thread Endpoints](/0.2.0/specification/threads/endpoints) — HTTP APIs that receive a `ThreadState`

## 1. Thread Definition

A thread is an **instance** of an agent with isolated storage for messages and files.

### 1.1 Agent Assignment

The agent assigned to a thread can change over time while preserving all history and context. This is called a **handoff**.

| Scenario | Behavior |
|----------|----------|
| **Tool handoff** | Calling an exposed agent with a human side as a tool transfers control to that agent |
| **Manual handoff** | Queue a tool call to an agent to trigger handoff programmatically |
| **Subagent composition** | Instantiating a side-declared relationship creates an isolated child thread (no handoff) — see [Subagents](/0.2.0/specification/subagents) |

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
| `children` | `SubagentRegistryEntry[]` | Child subagent registry (readonly) |
| `terminated` | `number \| null` | Termination timestamp in microseconds, or null when active (readonly) |
| `arguments` | `Record<string, unknown>` | Arguments supplied when this thread was created or invoked. Subagent initial arguments appear here. See [Thread Arguments](#61-thread-arguments) |
| `runtimeStreams` | `RuntimeStreams \| undefined` | Optional live runtime byte streams. Feature-detect before use. See [Runtime Streams](/0.2.0/specification/threads/runtime-streams) |
| `context` | `Record<string, unknown>` | Mutable per-execution scratch storage. See [Context Storage](#62-per-execution-context) |
| `execution` | `ExecutionState \| null` | Execution state during active execution, null at rest. See [Execution State](/0.2.0/specification/threads/execution-state) |
| `_notPackableRuntimeContext` | `Record<string, unknown> \| undefined` | Runtime-specific context (non-portable). See [Runtime Context](#10-runtime-context-non-portable) |

#### 1.2.2 Methods

The methods directory below is grouped by topic. Topics with their own page link out; the rest are documented on this page.

**Messages** — [Messages →](/0.2.0/specification/threads/messages)

| Method | Returns | Description |
|--------|---------|-------------|
| `getMessages(options?)` | `Promise<MessagesResult>` | Get messages with pagination |
| `getMessage(messageId)` | `Promise<Message \| null>` | Get single message by ID |
| `injectMessage(input)` | `Promise<Message>` | Inject a new message |
| `queueMessage(input)` | `Promise<void>` | Queue a message for delivery on next step |
| `updateMessage(messageId, updates)` | `Promise<Message>` | Update existing message |
| `deleteMessage(messageId)` | `Promise<boolean>` | Delete a message |

**File System** — [File System →](/0.2.0/specification/threads/filesystem)

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

**Code Execution** — [Code Execution →](/0.2.0/specification/threads/code-execution)

| Method | Returns | Description |
|--------|---------|-------------|
| `runCode(source, options?)` | `CodeExecution` | Execute JS/TS source in an isolated sandbox; returns a thenable handle with `terminate()` |

**Subagent Hierarchy** — see [§9 Subagent Hierarchy](#9-subagent-hierarchy-communication-and-termination)

| Method | Returns | Description |
|--------|---------|-------------|
| `getChildThread(referenceId)` | `Promise<ThreadState \| null>` | Resolve child thread by subagent reference |
| `getParentThread()` | `Promise<ThreadState \| null>` | Resolve parent thread for this thread |
| `notifyParent(content)` | `Promise<void>` | Queue a silent message to this thread's parent |
| `setStatus(status)` | `Promise<void>` | Update this thread's status in the parent registry when present |
| `stopSession(options?)` | `Promise<void>` | Terminally stop the active agent session — never the thread itself; optional `notifyParent` and `status` trigger those parent side effects |

**Resource Loading** — see [§2 Resource Loading](#2-resource-loading)

| Method | Returns | Description |
|--------|---------|-------------|
| `loadModel(name)` | `Promise<T>` | Load model definition |
| `loadPrompt(name)` | `Promise<T>` | Load prompt definition |
| `loadAgent(name)` | `Promise<T>` | Load agent definition |
| `getPromptNames()` | `string[]` | List available prompts |
| `getAgentNames()` | `string[]` | List available agents |
| `getModelNames()` | `string[]` | List available models |
| `env(propertyName)` | `Promise<string>` | Resolve environment variable using thread/agent/prompt/user/instance precedence |
| `instanceEnv?(propertyName)` | `Promise<string \| undefined>` | Optionally resolve only the runtime-instance value for security-sensitive trust anchors |
| `envType(propertyName)` | `Promise<'text' \| 'secret'>` | Resolve display/redaction classification for an environment value |
| `setEnv(propertyName, value, options?)` | `Promise<void>` | Set a thread environment variable, optionally choosing `text` or `secret`, and propagate to active descendants |

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

**Durable Key-Value Store** — see [§7 Durable Key-Value Store](#7-durable-key-value-store)

| Method | Returns | Description |
|--------|---------|-------------|
| `getValue(key)` | `Promise<T \| null>` | Read a value from the thread's durable key-value store |
| `setValue(key, value)` | `Promise<void>` | Write a JSON-serializable value; `null`/`undefined` deletes the key |

**Run status & application logs** — see [Execution State §4](/0.2.0/specification/threads/execution-state#4-run-status) and [§7.5 Application Logs](#75-application-logs)

| Method | Returns | Description |
|--------|---------|-------------|
| `status()` | `Promise<ThreadStatus>` | Authoritative run status: `idle`, `running`, or `failed`, with `since` and the last stop `reason` |
| `log(entry)` | `Promise<void>` | Record an application log entry; never creates a message or starts execution |

**Decision inference** — [Decisions →](/0.2.0/specification/decisions)

| Method | Returns | Description |
|--------|---------|-------------|
| `decide(options)` | `Promise<DecisionResult<Q>>` | Evaluate explicit context and typed questions; automatically log the operation without adding messages |

**User identity**

| Method | Returns | Description |
|--------|---------|-------------|
| `user()` | `Promise<ThreadUser \| null>` | Profile of the thread's user (identity fields only — id, username, role, roles, permissions, email, display_name, avatar_url; never credentials). `roles` optionally contains opaque application roles from the trusted identity authority; see [Users](/0.2.0/specification/users#application-roles). `null` for user-less threads. |

**Skills** — see [§7.4 Agent Skills](#74-agent-skills)

| Method | Returns | Description |
|--------|---------|-------------|
| `skills.list(options?)` | `Promise<SkillMetadata[]>` | Installed skills (enabled only unless `includeDisabled`) |
| `skills.get(name)` | `Promise<{ metadata, skillMd } \| null>` | A skill's metadata + SKILL.md source |
| `skills.readFile(name, path)` | `Promise<string \| null>` | One bundled file's text |
| `skills.install(files)` | `Promise<SkillMetadata>` | Install/replace a skill; requires mutation authorization |
| `skills.setEnabled(name, enabled)` | `Promise<boolean>` | Enable/disable a skill; requires mutation authorization |
| `skills.remove(name)` | `Promise<boolean>` | Uninstall a skill; requires mutation authorization |

**Lifecycle** — see [§8 Lifecycle](#8-lifecycle)

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
if (!state.instanceEnv) throw new Error('Instance env is required');
const trustedServiceUrl = await state.instanceEnv('TRUSTED_SERVICE_URL');
if (!trustedServiceUrl) throw new Error('Trusted service URL is required');
await state.setEnv('TOPDOWN_APPROVAL_GATE', 'open');
await state.setEnv('PUBLIC_LABEL', 'QA', { type: 'text' });
await state.setEnv('API_TOKEN', 'secret-token', { type: 'secret' });
```

`env(propertyName)` resolves in this order:
1. Thread environment variables
2. Agent definition defaults (`agent.env`)
3. Prompt definition defaults (`prompt.env`)
4. User-account environment variables
5. Runtime instance environment variables

The optional `instanceEnv(propertyName)` capability reads exclusively from the
runtime instance. It must not consider thread, agent, prompt, or user values.
It returns `undefined` when the key is not configured and rejects when the
runtime cannot read its instance environment.
Use it when a value establishes a trust boundary, such as a service endpoint
and the credential sent to that endpoint. Consumers that require this boundary
must feature-detect the method and fail closed if the capability is unavailable
or the required instance value is missing.

`envType(propertyName)` returns the display/redaction classification for a resolved environment value. Unknown or non-thread sources default to `secret`. Values marked `secret` should be redacted from tool output and logs; values marked `text` may be displayed.

`setEnv(propertyName, value, options?)` writes to thread storage and propagates recursively to active descendants. Pass `{ type: 'text' }` or `{ type: 'secret' }` to choose the display/redaction classification. Omitting `type` preserves any existing classification for that key, or defaults a new key to `secret`. During propagation, descendants must filter out inherited values for variable names marked `scoped` in that descendant's agent graph. Terminated descendants are skipped.

Thread, user, and instance environment values should be encrypted at rest when the runtime supports encrypted storage.

For subagent creation, runtimes may require missing scoped variables to be provided through a pending request flow before boot can continue. See [Subagents §5.2](/0.2.0/specification/subagents#52-scoped-variable-bootstrap).

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

Effect definition syntax is specified in [Effects](/0.2.0/specification/effects). Packed effects may use qualified names (`{packageId}/{effectName}`) to avoid collisions.

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

## 6. Thread Arguments and Context Storage

### 6.1 Thread Arguments

`arguments` is the read-only argument object supplied when the thread was
created or invoked.

For subagent threads, runtimes **MUST** restore the creation-time
`subagent_create.arguments` object into `ThreadState.arguments` on every run and
when exposing the child through endpoints, hooks, effects, or other
`ThreadState` access. Both child sides see the same argument object:

```typescript
const initialArgs = state.arguments;
const shirtSize = state.arguments.shirt_size;
```

Runtimes should keep the durable copy with child thread metadata/properties.
They should also expose top-level argument keys to prompt variable interpolation,
for whichever child side is currently rendering, including included prompts,
without requiring callers to put those values in `state.context`.

### 6.2 Per-Execution Context

The `context` property is mutable execution-scoped scratch storage for values
that should be shared while the current agent run is being assembled and
executed. It is used for:

- sharing derived values between tools, hooks, effects, and runtime lifecycle code during one execution
- runtime-internal coordination data that should not become a thread argument

For example:

```typescript
state.context.userData = { id: 123, name: 'Alice' };

// Retrieve in another tool call
const user = state.context.userData;
```

Runtimes may seed `context` at execution start with runtime coordination data.
User code may mutate it during execution, and later
participants in that same execution see those mutations.

Invocation or creation arguments belong in [`arguments`](#61-thread-arguments),
not in `context`.

### 6.3 Context Limitations

| Aspect | Behavior |
|--------|----------|
| **Scope** | Single execution only |
| **Persistence** | Mutations are lost after execution ends |
| **Type** | `Record<string, unknown>` |
| **Size** | No enforced limit |

For persistent storage across executions, use the [durable key-value store](#7-durable-key-value-store), the [file system](/0.2.0/specification/threads/filesystem), or external storage.

## 7. Durable Key-Value Store

`getValue` and `setValue` provide a simple durable key-value store scoped to the thread. Values persist across executions, tool calls, hook invocations, and endpoint requests for the lifetime of the thread.

It is one of two ways to store persistent data on a thread, alongside the [file system](/0.2.0/specification/threads/filesystem).

### 7.1 Reading and Writing Values

```typescript
const count = (await state.getValue<number>('invocation_count')) ?? 0;
await state.setValue('invocation_count', count + 1);

await state.setValue('preferences', { theme: 'dark', locale: 'en-US' });
const prefs = await state.getValue<{ theme: string; locale: string }>('preferences');
```

### 7.2 Semantics

| Aspect | Behavior |
|--------|----------|
| **Scope** | Per-thread; not shared with parent, child, or sibling threads |
| **Persistence** | Durable across executions for the lifetime of the thread |
| **Value type** | Any JSON-serializable value (objects, arrays, strings, numbers, booleans, `null`) |
| **Missing keys** | `getValue` returns `null` |
| **Deletion** | `setValue(key, null)` or `setValue(key, undefined)` deletes the key |
| **Subagents** | Values are **not** automatically copied to spawned child threads |

### 7.3 Comparison With Other Storage

| Surface | Scope | Persistence | Intended Use |
|---------|-------|-------------|--------------|
| `arguments` | Thread invocation | Durable when backed by thread metadata/properties | Creation/invocation arguments exposed to thread code and prompt interpolation |
| `context` | Single execution | Ephemeral | Mutable scratch state shared during one execution |
| `getValue` / `setValue` | Thread | Durable | Small structured state scoped to the thread |
| `env` / `envType` / `setEnv` | Thread → user → instance → agent → prompt | Durable (encrypted at rest when supported) | Configuration and secrets with layered resolution and display/redaction metadata |
| File system | Thread | Durable | Large or binary payloads |

Runtime semantics and conformance requirements for the durable key-value store live in [Runtime §15](/0.2.0/infrastructure/runtime#15-durable-key-value-store).

### 7.4 Agent Skills

`state.skills` exposes the calling thread owner's Agent Skills library plus any administrator-reviewed skills explicitly shared by the runtime. Skills follow the [Agent Skills](https://agentskills.io) standard: a folder whose root `SKILL.md` opens with YAML frontmatter carrying a required `name` (lowercase kebab-case, ≤64 chars) and `description` (≤1024 chars), optionally accompanied by scripts, references, and assets.

Requirements:

- Skills are stored server-side and scoped to the calling principal. A principal's private skills **MUST NOT** be visible to another principal. Runtimes **MAY** add an explicitly shared, administrator-reviewed library and **MUST NOT** require client-side storage for skill content.
- When an owner-scoped skill and a shared skill have the same name, the owner-scoped skill **MUST** take precedence for that owner.
- A skill's identity **MUST** come from its `SKILL.md` frontmatter — never from a caller-supplied name — and installs **MUST** validate the frontmatter against the standard.
- Runtimes **MUST** authorize mutations and confine them to the calling principal's scope. Multi-tenant runtimes **MUST NOT** allow ordinary tenant agent code to install, replace, enable, disable, or remove shared skills; an administrative or equivalently trusted principal is required for shared-library changes.
- Runtimes **SHOULD** surface skills to agents with progressive disclosure: only `name` + `description` ride in ambient context; the `SKILL.md` body (and bundled files) load on demand when the agent judges the skill applicable.
- Disabled skills stay installed but **MUST** be hidden from ambient agent context.

```typescript
const available = await state.skills.list();
const skill = await state.skills.get('pdf-processing');
const script = await state.skills.readFile('pdf-processing', 'scripts/extract.py');
await state.skills.install([{ path: 'SKILL.md', content: '---\nname: commit-style\ndescription: ...\n---\n...' }]);
```

### 7.5 Application Logs

`log()` records an application log entry on the thread, next to the runtime's
own execution logs (model requests, tool and handler executions).

```typescript
interface ThreadLogEntry {
  name: string;                                    // short event name, e.g. 'cache.miss'
  message?: string;                                // human-readable detail
  level?: 'debug' | 'info' | 'warn' | 'error';
  status?: 'success' | 'error' | 'skipped';
  request?: unknown;
  response?: unknown;
  error?: string;
  duration_ms?: number;
  cost?: number;                                   // USD, included in thread totals
  trigger?: { kind: string; id?: string; summary?: string };
  data?: Record<string, unknown>;                  // JSON-serializable detail
}

await state.log({ name: 'cache.miss', level: 'debug', data: { key } });
```

- `log()` **MUST NOT** create a message and **MUST NOT** start, wake, or otherwise affect execution or the [run status](/0.2.0/specification/threads/execution-state#4-run-status).
- `log()` is available wherever `ThreadState` is: tools, hooks, effects, handlers, and endpoints.
- Logs **MUST** persist before the first message exists. Such entries have no message association and remain available through thread log readers and cost totals; runtimes must not create a message merely to anchor a log.
- Runtimes **MUST** bound entries and **MUST** truncate oversized fields with a visible marker rather than reject the entry: `name` to 120 characters, `message` to 4 KiB, and the JSON encoding of `data` to 16 KiB. Operation `request` and `response` JSON are each bounded to 64 KiB, and `error` to 4 KiB; unencodable values receive a marker. Size alone **MUST NOT** make `log()` throw.
- Runtimes **SHOULD** deliver entries to live log subscribers and include them wherever they expose thread logs.

`state.decide()` uses this operation log surface automatically for decision
request, response, duration, status, usage, known cost, and errors. A decision
reads only the context supplied by the caller and never inserts an answer into
message history. Use the normal message APIs explicitly when that is desired.
See [Decisions](/0.2.0/specification/decisions) for the complete contract.

## 8. Lifecycle

`terminate()` is a soft shutdown:

- Marks the thread inactive and sets `terminated`
- Aborts in-flight execution
- Rejects future `queueMessage()` and execution attempts
- Parent registries should reflect `'terminated'` status

```typescript
await state.terminate();
```

## 9. Subagent Hierarchy, Communication, and Termination

Subagent-aware runtimes expose parent/child thread relationships through `ThreadState`:

```typescript
const child = await state.getChildThread(referenceId);
const parent = await state.getParentThread();
```

`children` entries track child instance references and status/projection metadata:

```typescript
interface SubagentRegistryEntry {
  reference: string;
  relationship: string;   // the relationship name (`as`) that spawned this instance
  name: string;           // the child agent definition name
  title?: string;
  description: string;
  blocking?: boolean;
  threadName?: string;
  initialArguments?: Record<string, unknown>;
  spawnGroupId?: string;
  createdAt?: number;
  status: string;
  parentCommunication?: 'implicit' | 'explicit';
}
```

Every child instance is a persistent thread: session end (stop, fail, error, or turn-cap) transitions `status` and **never terminates the thread** — only explicit termination does. See [Subagents §4](/0.2.0/specification/subagents#4-instance-lifecycle).

`initialArguments` stores the structured values supplied at child creation. The registry copy is parent-visible metadata; the durable child-side source should live with the child thread's own metadata/properties and be exposed to both child sides as `ThreadState.arguments` and prompt interpolation variables.

See [Subagents](/0.2.0/specification/subagents) for the full lifecycle, communication modes, and cross-thread semantics.

### 9.1 Cross-Thread Attachment Copying

When communication crosses thread boundaries, filesystem references must be copied:
- parent → child for invocation/messaging attachments
- child → parent for completion/failure payload attachments

Returned attachment paths must be valid in the receiving thread filesystem.

### 9.2 Lifecycle Status Messages

Runtimes may persist synthesized status messages (for example, system messages tagged with `metadata.status_kind`) to make cross-thread lifecycle events observable in message feeds.

### 9.3 Parent Messaging

Children can push information up the hierarchy without waiting for completion:

```typescript
await state.notifyParent('halfway through the batch');
await state.setStatus('running');
await state.stopSession({
  result: 'waiting for input',
  notifyParent: 'Please answer the clarification question',
  status: 'waiting for clarification',
});
```

`stopSession()` is distinct from `state.execution.stop()`: it marks the active agent session as terminal for lifecycle/subagent purposes. It **MUST NOT** terminate the thread — the thread remains addressable and a later message starts a new session with history intact. By default it only stops the session; `notifyParent` and `status` are optional side effects.

If a child has no parent thread, `notifyParent()` does not queue anything externally; `setStatus()` similarly becomes a no-op when there is no parent registry entry. Clients can still render the originating tool call or log entry as outbound parent communication.

## 10. Runtime Context (Non-Portable)

The `_notPackableRuntimeContext` property allows runtime implementations to inject platform-specific context.

| Property | Type | Description |
|----------|------|-------------|
| `_notPackableRuntimeContext` | `Record<string, unknown> \| undefined` | Runtime-specific context injected by the implementation |

### 10.1 Portability

Tools that access `_notPackableRuntimeContext` cannot be packed, shared, or published to tool registries.

### 10.2 Example: Accessing a Host-Provided Binding

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

## 11. Conformance Requirements

### 11.1 Thread Lifecycle

1. **Creation**: Thread created with metadata
2. **Execution**: Agent processes messages
3. **At Rest**: Thread accessible via endpoints
4. **Resumption**: New execution on next message

### 11.2 Platform Independence

`ThreadState` is an abstract interface. Implementations **MUST NOT** expose:
- Storage implementation details
- Platform-specific bindings
- Internal state management

### 11.3 Error Handling

Methods that return promises **SHOULD** throw on:
- Resource not found (loadModel, loadPrompt, loadAgent)
- Invalid parameters
- Storage errors

Methods **SHOULD NOT** throw on:
- Empty results (return empty arrays/null instead)
- Missing optional data

## 12. TypeScript Reference

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
  readonly arguments: Record<string, unknown>;

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
  instanceEnv?(propertyName: string): Promise<string | undefined>;
  envType(propertyName: string): Promise<'text' | 'secret'>;
  setEnv(
    propertyName: string,
    value: string,
    options?: { type?: 'text' | 'secret' }
  ): Promise<void>;
  notifyParent(content: string): Promise<void>;
  setStatus(status: string): Promise<void>;
  stopSession(options?: {
    result?: string;
    notifyParent?: string;
    status?: string;
  }): Promise<void>;

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
  // Durable Key-Value Store
  // ─────────────────────────────────────────────────────────────────────────
  getValue<T = unknown>(key: string): Promise<T | null>;
  setValue(key: string, value: unknown): Promise<void>;
  status(): Promise<ThreadStatus>;
  log(entry: ThreadLogEntry): Promise<void>;
  decide<const Q extends DecisionQuestions>(options: DecideOptions<Q>): Promise<DecisionResult<Q>>;

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
