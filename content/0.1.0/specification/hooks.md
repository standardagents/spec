# Hooks

A hook is an interception point in the agent execution lifecycle. Hooks enable logging, validation, transformation, and side effects at specific moments during execution — without modifying core agent logic.

Hook handlers receive a [`ThreadState`](/0.1.0/specification/threads). Hooks that run during active execution also receive [`state.execution`](/0.1.0/specification/threads/execution-state) with step counts, active dual-side, and abort signal context.

## 1. Hook Definition

This section defines hook types, required fields, and scoping behavior.

### 1.1 Available Hooks

The specification defines the following hooks:

| Hook | Trigger Point | Purpose |
|------|---------------|---------|
| `after_thread_created` | After thread creation, before execution | Initialize thread state |
| `after_subagent_created` | On parent after child thread creation | Track or initialize child relationships |
| `after_system_message` | After system message render, before the history snapshot | Transform the request system message |
| `filter_messages` | Once per model-context assembly, on a stable history snapshot | Filter or transform persisted history for the provider request |
| `prefilter_llm_history` | After provider-message transformation, before dispatch | Final adjustments to the provider request |
| `before_create_message` | Before message insert | Transform message before storage |
| `after_create_message` | After message insert | Side effects after storage |
| `before_update_message` | Before message update | Transform update data |
| `after_update_message` | After message update | Side effects after update |
| `before_store_tool_result` | Before tool result storage | Transform tool results |
| `tool_call_started` | When a tool call starts streaming | Observe tool calls before they execute |
| `after_tool_call_success` | After successful tool call | Post-process success results |
| `after_tool_call_failure` | After failed tool call | Handle/recover from errors |
| `tool_call_done` | After tool execution (success or failure) | Observe every completed tool call |

### 1.2 Hook Definition

Each hook implementation **MUST** be created using `defineHook()` with three properties:

| Property | Type | Description |
|----------|------|-------------|
| `hook` | `HookName` | The hook type from §1.1 |
| `id` | `string` | Unique identifier for this hook (snake_case) |
| `execute` | `Function` | The hook implementation (typed per hook type) |

```typescript
import { defineHook } from '@standardagents/spec';

export default defineHook({
  hook: 'filter_messages',
  id: 'limit_to_20_messages',
  execute: async (state, messages) => {
    return messages.slice(-20);
  },
});
```

**Requirements:**

- The `hook` property **MUST** reference one of the hook types in §1.1.
- The `id` property **MUST** be unique across all hooks and follow `snake_case` format.
- Multiple hooks of the same type **MAY** exist, each with a distinct `id`.
- Hook implementations **SHOULD** be idempotent.
- Runtimes **SHOULD** enforce a timeout on hook execution.
- Hooks **SHOULD NOT** perform blocking operations that could exceed that timeout.
- Hooks **MUST NOT** expose sensitive data in logs or error messages.

### 1.3 Hook Scoping

Hooks are **scoped** to prompts and agents rather than running globally. This allows different prompts to use different hooks.

**Resolution priority:**

1. **Prompt-level hooks** — If the active prompt declares a `hooks` array, only those hooks run
2. **Agent-level hooks** — If the prompt has no `hooks` property, the agent's `hooks` array is used
3. **No hooks** — If neither prompt nor agent declares hooks, no hooks run

At-rest operations have no active prompt. They resolve lifecycle hooks from the
thread's agent-level `hooks` array.

```typescript
// Prompt with explicit hooks
definePrompt({
  name: 'support_prompt',
  // ...
  hooks: ['limit_to_20_messages', 'log_tool_calls'],
});

// Agent with fallback hooks
defineAgent({
  name: 'support_agent',
  // ...
  hooks: ['log_tool_calls'],  // Used when prompt doesn't specify hooks
});
```

See the [Prompts](/0.1.0/specification/prompts) and [Agents](/0.1.0/specification/agents) specifications for details on declaring hooks.

## 2. Hook Context

### 2.1 ThreadState Parameter

All hooks receive a `ThreadState` instance as their first parameter. See the [Threads](/0.1.0/specification/threads) specification for the complete interface.

Key properties available during hook execution:

| Property | Type | Description |
|----------|------|-------------|
| `threadId` | `string` | Unique thread identifier |
| `agentId` | `string` | Agent that owns this thread |
| `userId` | `string \| null` | Associated user |
| `execution` | `ExecutionState` | Always present in hooks |

### 2.2 Execution State

Since hooks run during agent execution, `state.execution` is always available:

| Property | Type | Description |
|----------|------|-------------|
| `flowId` | `string` | Current execution flow identifier |
| `currentSide` | `'a' \| 'b'` | Current execution side |
| `stepCount` | `number` | Current step count (LLM cycles) |
| `stopped` | `boolean` | Whether execution has stopped |
| `abortSignal` | `AbortSignal` | Cancellation signal |

### 2.3 Using ThreadState in Hooks

```typescript
defineHook({
  hook: 'filter_messages',
  id: 'thread_aware_filter',
  execute: async (state, messages) => {
    // Access thread identity
    console.log(`Thread: ${state.threadId}`);

    // Access execution state
    console.log(`Step: ${state.execution.stepCount}`);

    // Load resources
    const agent = await state.loadAgent(state.agentId);

    return messages;
  },
});
```

## 3. Request Context Hooks

These hooks build the request context: the temporary copy of history assembled for one model request. They do not replace live execution history. See [Runtime §4](/0.1.0/infrastructure/runtime#4-context-assembly).

### 3.1 after_system_message

Called after the system prompt is interpolated and before the runtime takes the history snapshot.

**Signature:**
```typescript
(state: ThreadState, systemMessage: string) => string | Promise<string | null | undefined> | null | undefined
```

**Behavior:**
- Implementations **MUST** invoke this hook after system-prompt interpolation and before the history snapshot.
- A returned string **MUST** replace the rendered system message for the current request.
- `null` or `undefined` **MUST** leave the current system message unchanged.
- A message injected here is persisted before the snapshot. It **MUST** be eligible for the current assembly and **MUST** pass through `filter_messages`.

### 3.2 filter_messages

Called once per model-context assembly on a stable snapshot of eligible persisted history.

**Signature:**
```typescript
(state: ThreadState, messages: HookMessage[]) => Promise<HookMessage[]>
```

**Behavior:**
- Implementations **MUST** take a stable snapshot of eligible persisted history and invoke this hook exactly once on that snapshot.
- The snapshot **MUST** include silent messages.
- The returned array **MUST** become the persisted-history input for provider-message transformation.
- Synthetic or transformed messages returned here **MUST** remain confined to the request context. They **MUST NOT** replace [`execution.messageHistory`](/0.1.0/specification/threads/execution-state#22-live-execution-history).
- A message injected from this hook **MUST NOT** restart context assembly. It becomes eligible for the following context assembly.

**Use cases:**
- Limit conversation history to N most recent messages
- Filter out system-only messages
- Remove messages matching certain patterns
- Inject synthetic messages into the request context

**Example:**
```typescript
defineHook({
  hook: 'filter_messages',
  id: 'limit_recent_messages',
  execute: async (state, messages) => {
    // Only include last 20 messages
    return messages.slice(-20);
  },
});
```

### 3.3 prefilter_llm_history

Called after messages are transformed into LLM chat format, before the request is sent.

**Signature:**
```typescript
(state: ThreadState, messages: LLMMessage[]) => Promise<LLMMessage[]>
```

**Behavior:**
- Implementations **MUST** invoke this hook after provider-message transformation and before dispatch.
- The returned array **MUST** be the provider request history.
- Changes here **MUST** remain confined to the current request. They **MUST NOT** replace live execution history.
- A message injected from this hook **MUST NOT** restart context assembly. It becomes eligible for the following context assembly.

**Use cases:**
- Add dynamic instructions to context
- Modify message content before LLM sees it
- Inject reminders or constraints

Hooks that modify message content **MUST** validate inputs against an expected schema to prevent prompt-injection attacks.

**Example:**
```typescript
defineHook({
  hook: 'prefilter_llm_history',
  id: 'add_concise_reminder',
  execute: async (state, messages) => {
    // Add reminder to keep responses concise
    const last = messages[messages.length - 1];
    if (last?.role === 'user' && typeof last.content === 'string') {
      last.content += '\n\n(Remember to be concise)';
    }
    return messages;
  },
});
```

### 3.4 Stored history and the request context

Live execution history and the request context are separate views.

| View | Source | Includes silent messages | Mutated by |
|------|--------|--------------------------|------------|
| `execution.messageHistory` | Persisted execution records | Yes | Successful `injectMessage()` calls during the active execution |
| Request context | One snapshot per assembly | Yes, until a hook removes them | `filter_messages`, then `prefilter_llm_history` |

**Requirements:**

- For each model-context assembly, the runtime **MUST** snapshot eligible persisted history and invoke `filter_messages` exactly once on that snapshot.
- The runtime **MUST** then transform the filtered result into provider messages and invoke `prefilter_llm_history` before dispatch.
- Messages injected after the snapshot begins **MUST** become eligible for the following context assembly.
- `injectMessage()` **MUST NOT** recursively restart `filter_messages` or `prefilter_llm_history`.
- [`injectMessage()`](/0.1.0/specification/threads/messages#3-injecting-messages) still applies `before_create_message` and `after_create_message` when a request-context hook persists a message.

## 4. Message Lifecycle Hooks

### 4.1 before_create_message

Called before a message is inserted into storage. Return modified data to transform the message.

**Signature:**
```typescript
(state: ThreadState, message: Record<string, unknown>) => Promise<Record<string, unknown>>
```

**Behavior:**
- Implementations **MUST** call this hook before inserting any message, including every `injectMessage()` path
- The returned object **MUST** be used for insertion
- Failures **SHOULD** prevent message creation

### 4.2 after_create_message

Called after a message is successfully inserted. Cannot modify the message.

**Signature:**
```typescript
(state: ThreadState, message: Record<string, unknown>) => Promise<void>
```

**Behavior:**
- Implementations **MUST** call this hook after successful insertion, including every `injectMessage()` path
- Failures **SHOULD NOT** affect the created message
- Use for logging, analytics, or triggering external systems

### 4.3 before_update_message

Called before a message update is applied. Return modified update data.

**Signature:**
```typescript
(state: ThreadState, messageId: string, updates: Record<string, unknown>) => Promise<Record<string, unknown>>
```

**Behavior:**
- Implementations **MUST** call this hook before updating
- The returned object **MUST** be used for the update
- Failures **SHOULD** prevent the update

### 4.4 after_update_message

Called after a message is successfully updated.

**Signature:**
```typescript
(state: ThreadState, message: HookMessage) => Promise<void>
```

**Behavior:**
- Implementations **MUST** call this hook after successful update
- Failures **SHOULD NOT** affect the updated message

## 5. Tool Execution Hooks

### 5.1 tool_call_started

Called when a tool call **starts** — before the tool executes, while the model may still be generating the rest of the call. Fires exactly once per tool call. This hook is observational: its return value is ignored.

**Signature:**
```typescript
(state: ThreadState, toolCall: HookToolCall, progress?: string) => Promise<void>
```

**Timing:**
- When the tool declares a [`progressArgument`](/0.1.0/specification/tools#8-progress-reporting), the hook fires as soon as *just that argument* has finished streaming (not the whole call), passing its value as `progress`. This lets a UI show what the tool is about to do — for example `fixing index.html` — before a large argument such as `content` finishes generating.
- When the tool does **not** declare a `progressArgument`, the hook fires as soon as the tool call appears in the stream. Its name is known, but `toolCall.function.arguments` **MAY** be an incomplete JSON fragment (or empty), and `progress` is `undefined`.

**Behavior:**
- Implementations **MUST** call this hook exactly once per tool call.
- The return value **MUST** be ignored; the hook cannot modify the tool call.
- Runtimes **SHOULD** also broadcast a matching `tool_call_started` thread event to connected clients with `{ id, name, progress }` at the same moment.
- Use for surfacing tool activity in a UI, logging, or progress telemetry.

### 5.2 before_store_tool_result

Called before a tool result is stored in the database.

**Signature:**
```typescript
(state: ThreadState, toolCall: Record<string, unknown>, toolResult: Record<string, unknown>) => Promise<Record<string, unknown>>
```

**Use cases:**
- Sanitize sensitive data from results
- Add metadata to tool results
- Transform result format

### 5.3 after_tool_call_success

Called after a tool executes successfully. Can return modified result or null for original.

**Signature:**
```typescript
(state: ThreadState, toolCall: HookToolCall, toolResult: HookToolResult) => Promise<HookToolResult | null>
```

**Behavior:**
- If hook returns `null`, the original result is used
- If hook returns a result, it replaces the original
- Use for logging, metrics, or result post-processing

### 5.4 after_tool_call_failure

Called after a tool execution fails. Can return modified error or null for original.

**Signature:**
```typescript
(state: ThreadState, toolCall: HookToolCall, toolResult: HookToolResult) => Promise<HookToolResult | null>
```

**Use cases:**
- Error logging and alerting
- Error recovery attempts
- Error message transformation

Hooks accessing external services **MUST** handle failures gracefully.

### 5.5 tool_call_done

Called when a tool call is **done** — after it has executed, with its result, regardless of success or failure. Fires once per tool call. This hook is observational: its return value is ignored.

**Signature:**
```typescript
(state: ThreadState, toolCall: HookToolCall, toolResult: HookToolResult) => Promise<void>
```

**Behavior:**
- Implementations **MUST** call this hook once per tool call, whether it succeeded or failed.
- The return value **MUST** be ignored; the hook cannot modify the result.
- This complements `after_tool_call_success` / `after_tool_call_failure`, which can additionally *modify* the stored result; `tool_call_done` is a single unified observation point that always fires.
- Runtimes **SHOULD** also broadcast a matching `tool_call_done` thread event to connected clients with `{ id, name, status }` at the same moment.
- Use for unified tool telemetry, metrics, or closing out UI progress indicators.

## 6. Type Definitions

### 6.1 HookMessage

```typescript
interface HookMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string | null;
  tool_calls?: string | null;
  tool_call_id?: string | null;
  created_at: number;
  parent_id?: string | null;
  depth?: number;
  silent?: boolean;
}
```

### 6.2 HookToolCall

```typescript
interface HookToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
```

### 6.3 HookToolResult

```typescript
interface HookToolResult {
  status: 'success' | 'error';
  result?: string;
  error?: string;
  stack?: string;
  attachments?: Array<ToolAttachment | AttachmentRef>;
}
```

Files returned by a tool are surfaced through `attachments`. Each entry is either a new `ToolAttachment` (binary data to store) or an `AttachmentRef` (pointer to an existing file in the thread filesystem). Hooks that inspect tool output can read these; hooks that rewrite tool results **MUST** preserve or replace this field deliberately.

### 6.4 LLMMessage

```typescript
interface LLMMessage {
  role: string;
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}
```

## 7. TypeScript Reference

```typescript
/**
 * Hook signatures for all available hooks.
 * All hooks receive ThreadState as their first parameter.
 * See the Threads specification for the ThreadState interface.
 */
interface HookSignatures<
  State = ThreadState,
  Message = HookMessage,
  ToolCall = HookToolCall,
  ToolResult = HookToolResult,
> {
  after_thread_created: (state: State) => Promise<void>;

  after_subagent_created: (
    state: State,
    childState: State
  ) => Promise<void>;

  after_system_message: (
    state: State,
    systemMessage: string
  ) => string | Promise<string | null | undefined> | null | undefined;

  filter_messages: (state: State, messages: Message[]) => Promise<Message[]>;

  prefilter_llm_history: (
    state: State,
    messages: LLMMessage[]
  ) => Promise<LLMMessage[]>;

  before_create_message: (
    state: State,
    message: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;

  after_create_message: (
    state: State,
    message: Record<string, unknown>
  ) => Promise<void>;

  before_update_message: (
    state: State,
    messageId: string,
    updates: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;

  after_update_message: (state: State, message: Message) => Promise<void>;

  before_store_tool_result: (
    state: State,
    toolCall: Record<string, unknown>,
    toolResult: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;

  after_tool_call_success: (
    state: State,
    toolCall: ToolCall,
    toolResult: ToolResult
  ) => Promise<ToolResult | null>;

  after_tool_call_failure: (
    state: State,
    toolCall: ToolCall,
    toolResult: ToolResult
  ) => Promise<ToolResult | null>;

  tool_call_started: (
    state: State,
    toolCall: ToolCall,
    progress?: string
  ) => Promise<void>;

  tool_call_done: (
    state: State,
    toolCall: ToolCall,
    toolResult: ToolResult
  ) => Promise<void>;
}

/**
 * Valid hook names.
 */
type HookName = keyof HookSignatures;

/**
 * Options for defining a hook with explicit ID.
 */
interface HookDefinitionOptions<K extends HookName> {
  /** The hook type (e.g., 'filter_messages', 'before_create_message') */
  hook: K;
  /** Unique identifier for this hook implementation (snake_case) */
  id: string;
  /** The hook implementation function (typed per hook type) */
  execute: HookSignatures[K];
}

/**
 * Return type from defineHook.
 */
interface HookDefinitionResult<K extends HookName> {
  hook: K;
  id: string;
  execute: HookSignatures[K];
}

/**
 * Define a hook with a unique identifier and strict typing.
 */
function defineHook<K extends HookName>(
  options: HookDefinitionOptions<K>
): HookDefinitionResult<K>;
```

## 8. Examples

### 8.1 Message Context Limiting

```typescript
import { defineHook } from '@standardagents/spec';

export default defineHook({
  hook: 'filter_messages',
  id: 'limit_to_50_messages',
  execute: async (state, messages) => {
    // Keep only the most recent 50 messages
    return messages.slice(-50);
  },
});
```

### 8.2 Logging All Tool Calls

```typescript
import { defineHook } from '@standardagents/spec';

export default defineHook({
  hook: 'after_tool_call_success',
  id: 'log_tool_calls',
  execute: async (state, toolCall, result) => {
    console.log({
      event: 'tool_success',
      threadId: state.threadId,
      step: state.execution.stepCount,
      tool: toolCall.function.name,
      args: toolCall.function.arguments,
      result: result.result,
      timestamp: Date.now(),
    });
    return null; // Use original result
  },
});
```

### 8.3 Surfacing Tool Progress

```typescript
import { defineHook } from '@standardagents/spec';

export default defineHook({
  hook: 'tool_call_started',
  id: 'log_tool_start',
  execute: async (state, toolCall, progress) => {
    // `progress` is the value of the tool's declared progressArgument,
    // available before the rest of the call finishes streaming.
    console.log(`▸ ${toolCall.function.name}${progress ? `: ${progress}` : ''}`);
  },
});
```

### 8.4 Unified Tool Telemetry

```typescript
import { defineHook } from '@standardagents/spec';

export default defineHook({
  hook: 'tool_call_done',
  id: 'record_tool_completion',
  execute: async (state, toolCall, result) => {
    // Always fires once a tool finishes, whether it succeeded or failed.
    console.log({
      event: 'tool_done',
      threadId: state.threadId,
      tool: toolCall.function.name,
      status: result.status,
      timestamp: Date.now(),
    });
  },
});
```

### 8.5 Error Alerting

```typescript
import { defineHook } from '@standardagents/spec';

export default defineHook({
  hook: 'after_tool_call_failure',
  id: 'alert_payment_failures',
  execute: async (state, toolCall, result) => {
    // Send alert for critical tool failures
    if (toolCall.function.name === 'payment_process') {
      await sendAlert({
        level: 'critical',
        message: `Payment tool failed: ${result.error}`,
        context: { threadId: state.threadId },
      });
    }
    return null; // Use original error
  },
});
```

### 8.6 Adding Metadata to Messages

```typescript
import { defineHook } from '@standardagents/spec';

export default defineHook({
  hook: 'before_create_message',
  id: 'add_execution_metadata',
  execute: async (state, message) => {
    return {
      ...message,
      metadata: JSON.stringify({
        flow_id: state.execution.flowId,
        step: state.execution.stepCount,
        side: state.execution.currentSide,
      }),
    };
  },
});
```

### 8.7 Sanitizing Sensitive Data

```typescript
import { defineHook } from '@standardagents/spec';

export default defineHook({
  hook: 'before_store_tool_result',
  id: 'redact_credit_cards',
  execute: async (state, toolCall, result) => {
    // Redact credit card numbers from results
    const sanitized = { ...result };
    if (typeof sanitized.result === 'string') {
      sanitized.result = sanitized.result.replace(
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        '****-****-****-****'
      );
    }
    return sanitized;
  },
});
```
