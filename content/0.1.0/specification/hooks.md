# Hooks

A hook is an interception point in the agent execution lifecycle. Hooks enable logging, validation, transformation, and side effects at specific moments during execution—without modifying core agent logic.

## 1. Hook Definition

This section defines hook types, required fields, and scoping behavior.

### 1.1 Available Hooks

The specification defines the following hooks:

| Hook | Trigger Point | Purpose |
|------|---------------|---------|
| `filter_messages` | Before LLM context assembly | Filter/transform message history |
| `prefilter_llm_history` | After context assembly | Final adjustments before LLM request |
| `before_create_message` | Before message insert | Transform message before storage |
| `after_create_message` | After message insert | Side effects after storage |
| `before_update_message` | Before message update | Transform update data |
| `after_update_message` | After message update | Side effects after update |
| `before_store_tool_result` | Before tool result storage | Transform tool results |
| `after_tool_call_success` | After successful tool call | Post-process success results |
| `after_tool_call_failure` | After failed tool call | Handle/recover from errors |

### 1.2 Hook Definition

Each hook implementation **MUST** be created using `defineHook()` with three properties:

| Property | Type | Description |
|----------|------|-------------|
| `hook` | `HookName` | The hook type from Section 1.1 |
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

- Hook `hook` values **MUST** match one of the defined hook types in Section 1.1
- Hook `id` values **MUST** be unique across all hooks and follow snake_case format
- Multiple hooks of the same type MAY exist (each with a distinct `id`)
- Hook implementations **SHOULD** be idempotent where possible
- Implementations **SHOULD** enforce timeouts on hook execution
- Hooks **SHOULD NOT** perform blocking operations that could timeout execution
- Hooks **MUST NOT** expose sensitive data in logs or error messages

### 1.3 Hook Scoping

Hooks are **scoped** to prompts and agents rather than running globally. This allows different prompts to use different hooks.

**Resolution priority:**

1. **Prompt-level hooks** — If the active prompt declares a `hooks` array, only those hooks run
2. **Agent-level hooks** — If the prompt has no `hooks` property, the agent's `hooks` array is used
3. **No hooks** — If neither prompt nor agent declares hooks, no hooks run

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

## 3. Message Filtering Hooks

### 3.1 filter_messages

Called before messages are assembled into LLM context. Receives raw message data from storage.

**Signature:**
```typescript
(state: ThreadState, messages: HookMessage[]) => Promise<HookMessage[]>
```

**Use cases:**
- Limit conversation history to N most recent messages
- Filter out system-only messages
- Remove messages matching certain patterns
- Inject synthetic messages

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

### 3.2 prefilter_llm_history

Called after messages are transformed into LLM chat format, before the request is sent.

**Signature:**
```typescript
(state: ThreadState, messages: LLMMessage[]) => Promise<LLMMessage[]>
```

**Use cases:**
- Add dynamic instructions to context
- Modify message content before LLM sees it
- Inject reminders or constraints

Hooks modifying message content **SHOULD** validate inputs to prevent injection attacks.

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

## 4. Message Lifecycle Hooks

### 4.1 before_create_message

Called before a message is inserted into storage. Return modified data to transform the message.

**Signature:**
```typescript
(state: ThreadState, message: Record<string, unknown>) => Promise<Record<string, unknown>>
```

**Behavior:**
- Implementations **MUST** call this hook before inserting any message
- The returned object **MUST** be used for insertion
- Failures **SHOULD** prevent message creation

### 4.2 after_create_message

Called after a message is successfully inserted. Cannot modify the message.

**Signature:**
```typescript
(state: ThreadState, message: Record<string, unknown>) => Promise<void>
```

**Behavior:**
- Implementations **MUST** call this hook after successful insertion
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

### 5.1 before_store_tool_result

Called before a tool result is stored in the database.

**Signature:**
```typescript
(state: ThreadState, toolCall: Record<string, unknown>, toolResult: Record<string, unknown>) => Promise<Record<string, unknown>>
```

**Use cases:**
- Sanitize sensitive data from results
- Add metadata to tool results
- Transform result format

### 5.2 after_tool_call_success

Called after a tool executes successfully. Can return modified result or null for original.

**Signature:**
```typescript
(state: ThreadState, toolCall: HookToolCall, toolResult: HookToolResult) => Promise<HookToolResult | null>
```

**Behavior:**
- If hook returns `null`, the original result is used
- If hook returns a result, it replaces the original
- Use for logging, metrics, or result post-processing

### 5.3 after_tool_call_failure

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
}
```

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

### 8.3 Error Alerting

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

### 8.4 Adding Metadata to Messages

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

### 8.5 Sanitizing Sensitive Data

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
