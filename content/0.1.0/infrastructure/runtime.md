# Runtime

[TK]

## 1. Overview

A Standard Agents runtime executes agent conversations on threads. This specification defines the observable behavior that conforming runtimes **MUST** implement.

## 2. Thread Invocation

### 2.1 Triggering Execution

Execution begins when a thread receives input. The runtime **MUST** support:

| Trigger | Description |
|---------|-------------|
| User message | A message is added to the thread |
| Queued tool | A tool is queued via `queueTool()` |
| Scheduled effect | A scheduled effect fires |

### 2.2 Agent Loading

When a thread is invoked, the runtime **MUST**:

1. Load the agent definition assigned to the thread
2. Load the prompt definition for the current side
3. Resolve all tool definitions available to the prompt

## 3. Execution Loop

### 3.1 Step Cycle

The runtime **MUST** execute steps in a loop until a stop condition is met. Each step consists of:

1. **Assemble context** — Build the message array for the LLM
2. **Invoke LLM** — Send request to the model provider
3. **Store response** — Persist the assistant message
4. **Execute tools** — Process any tool calls sequentially
5. **Check stop conditions** — Determine if execution should end

### 3.2 Step Limits

The runtime **MUST** enforce step limits to prevent runaway execution:

| Limit | Source | Description |
|-------|--------|-------------|
| Global maximum | Runtime configuration | Absolute cap on steps per invocation |
| Per-side maximum | Agent `maxSteps` property | Limit for a single side |
| Session turns | Agent `maxSessionTurns` property | Completed exchanges for `dual_ai` |

When a limit is reached, execution **MUST** stop.

## 4. Context Assembly

### 4.1 Message Array

Before each LLM invocation, the runtime **MUST** construct a message array containing:

1. **System message** — The interpolated prompt content
2. **Conversation history** — Previous messages from the thread

### 4.2 History Filtering

The runtime **MUST** filter the message history:

| Rule | Behavior |
|------|----------|
| Incomplete messages | Exclude messages not yet persisted |
| Silent messages | Exclude unless explicitly requested |
| Tool messages | Exclude if prompt sets `include_past_tools: false` |

### 4.3 Dual AI Perspective

For `dual_ai` agents, each side **MUST** see the conversation from its own perspective:

- Own messages appear as role `"assistant"`
- Other side's messages appear as role `"user"`
- Tool messages from the other side are not visible

## 5. LLM Invocation

### 5.1 Request

The runtime **MUST** send the assembled context to the configured model provider.

### 5.2 Retry Behavior

The runtime **SHOULD** retry failed requests with exponential backoff. Non-retriable errors (validation failures, content policy violations) **MUST NOT** be retried.

### 5.3 Fallback Models

If the primary model fails after retries, the runtime **SHOULD** attempt configured fallback models in order.

### 5.4 Response Storage

After a successful response, the runtime **MUST**:

1. Create an assistant message with the response content
2. Include any tool calls in the message
3. Persist the message to thread storage

## 6. Tool Execution

### 6.1 Sequential Processing

Tool calls **MUST** be executed sequentially in the order returned by the LLM. Parallel execution is not permitted.

### 6.2 Execution

For each tool call, the runtime **MUST**:

1. Validate the tool exists and is allowed
2. Parse arguments according to the tool schema
3. Execute the tool with a `ThreadState` context
4. Store the result as a tool message

### 6.3 Error Handling

Tool execution errors **MUST NOT** terminate the invocation. The error is stored as the tool result and execution continues.

### 6.4 Tool Types

The runtime **MUST** support:

| Type | Behavior |
|------|----------|
| Function tools | Execute the defined function |
| Prompt tools | Execute a sub-prompt as a nested invocation |
| Agent tools | Hand off to another agent or create isolated execution |

### 6.5 Hooks

After tool execution, the runtime **MUST** invoke applicable hooks:

- `after_tool_call_success` — Tool returned successfully
- `after_tool_call_failure` — Tool returned an error

If a hook returns `null`, the tool call and result **MUST** be removed from history.

Hook resolution follows scoping rules: prompt-level hooks take precedence over agent-level hooks. See the [Hooks specification](/specification/hooks) for details.

## 7. Stop Conditions

### 7.1 Evaluation

After each step, the runtime **MUST** evaluate stop conditions in this order:

1. **End session tool** — The configured `endSessionTool` was called
2. **Stop tool** — The configured `stopTool` was called
3. **Stop on response** — Text response with no tool calls (if `stopOnResponse` is true)

### 7.2 End Session Tool

When called, execution ends for all sides. The session is complete.

### 7.3 Stop Tool

When called, the current side's turn ends. For `ai_human`, this ends the session. For `dual_ai`, execution may continue with the other side.

### 7.4 Stop on Response

When `stopOnResponse` is `true` (the default), a text response without tool calls ends the current side's turn.

## 8. Side Switching

### 8.1 Dual AI Behavior

For `dual_ai` agents, after a side's turn ends (but not the session):

1. Switch to the other side
2. Load that side's prompt configuration
3. Continue the execution loop

### 8.2 Session Turn Counting

A session turn is counted when both sides have completed at least one turn. When `maxSessionTurns` is reached, the session **MUST** end.

## 9. Abort Handling

### 9.1 Abort Signal

The runtime **MUST** support aborting execution via an abort signal.

### 9.2 Behavior

When aborted:

1. Stop processing after the current atomic operation
2. Clear any pending tool queue
3. End execution

## 10. Concurrency

### 10.1 Thread Exclusivity

A thread **MUST NOT** have multiple concurrent executions. If a thread is already executing, new invocations **MUST** be queued or rejected.

### 10.2 Effect Isolation

Scheduled effects execute as independent invocations and **MAY** run concurrently across different threads.

## 11. Conformance

### 11.1 Required

Implementations **MUST**:

- Execute steps sequentially within an invocation
- Enforce all configured step and session limits
- Execute tools in order, one at a time
- Prevent concurrent execution on the same thread
- Transform message roles correctly for `dual_ai` agents
- Persist messages before continuing execution

### 11.2 Recommended

Implementations **SHOULD**:

- Use exponential backoff for LLM retries
- Support streaming responses to clients
- Log LLM requests and responses for debugging
