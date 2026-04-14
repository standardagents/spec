# Runtime

A runtime is the execution environment that runs Standard Agents on threads. It assembles LLM context, executes tools, enforces stop conditions, persists state, and coordinates parent/child thread communication for subagents.

## 1. Overview

A conforming runtime executes conversations deterministically around non-deterministic model output.

The runtime **MUST**:
- execute one step at a time per thread
- persist messages and tool results before continuing
- enforce configured limits and stop semantics
- support queued work for idle and active threads

## 2. Invocation Triggers

Execution begins when any of the following occurs:

| Trigger | Description |
|---------|-------------|
| User message | A new message is injected/sent to the thread |
| Queued message | `queueMessage()` is called |
| Queued tool | `queueTool()` is called |
| Scheduled effect | A scheduled effect alarm fires |

If a thread is already executing, new work is queued. If idle, the runtime starts a new execution.

## 3. Step Cycle

Each execution step **MUST** run in order:

1. Drain queued messages/tools for this step
2. Assemble LLM message context
3. Call the selected model
4. Persist assistant response
5. Execute tool calls sequentially
6. Persist tool results
7. Evaluate stop conditions

## 4. Context Assembly

Before each model call, runtime context includes:
- interpolated system prompt
- filtered conversation history
- provider/tool configuration

For `dual_ai`:
- own side appears as `assistant`
- opposite side appears as `user`
- opposite-side tool calls are not directly visible

When supported by the model, attachments remain multimodal content. If a model does not support vision, runtimes may filter image parts at request time while preserving stored message attachments.

## 5. Tool Execution

### 5.1 Ordering

Tool calls **MUST** execute sequentially in the returned order.

### 5.2 Error Handling

Tool errors **MUST** be persisted as tool results and **MUST NOT** crash the execution loop.

### 5.3 Tool Classes

Runtimes **MUST** support:
- function tools
- prompt tools
- agent tools (`ai_human` handoff and `dual_ai` subagent behavior)

## 6. Stop Conditions

Stop evaluation order should be:

1. `sessionStop` / `sessionFail` terminal lifecycle tools
2. `stopTool`
3. `stopOnResponse`
4. safety limits (`maxSteps`, `maxSessionTurns`, runtime hard caps)

## 7. Subagent Runtime Semantics

Subagents are autonomous `dual_ai` child threads.

### 7.1 Parent/Child Threading

Runtimes **MUST**:
- create child threads with parent linkage
- maintain child registry entries for resumable instances
- expose parent/child lookup through `ThreadState`

### 7.2 Resumable Lifecycle Tooling

For resumable subagents, runtimes should expose built-in lifecycle tools:
- `subagent_create`
- `subagent_message`

Creation attempts beyond `maxInstances` **MUST** return tool errors with actionable guidance.
If `parentCommunication` is `explicit`, runtimes should not auto-queue child completion/failure to the parent.

### 7.3 Optional + Immediate Branches

Runtimes should evaluate subagent tool flags before exposing/executing them:
- `optional`: only enabled when the referenced environment flag resolves to `true`, `1`, or `yes` (case-insensitive)
- `immediate`: execute before the first model step when the prompt becomes active
- `immediate` object form: treat `nameEnv` and `descriptionEnv` as safe bootstrap hints and `scopedEnv` as runtime-only transfer data

Immediate execution should be recursive across activated child prompts.

### 7.4 Initial Payload Mapping

Subagent tool configuration can map args to:
- initial user message (`initUserMessageProperty`)
- initial attachments (`initAttachmentsProperty`)
- human-readable child name (`initAgentNameProperty`)

When `immediate` uses the object form, runtimes may perform an internal bootstrap-model pass before enqueuing the child call. In that flow:
- only `nameEnv` and `descriptionEnv` are model-visible
- `scopedEnv` values must remain encrypted at rest and runtime-only during transfer
- copied child env must never be injected into LLM-visible prompt text unless explicitly promoted through `nameEnv` or `descriptionEnv`

### 7.5 Scoped Variable Bootstrap

If `subagent_create` cannot proceed because required scoped variables are missing, runtimes should return a structured bootstrap error and expose a temporary completion flow:
- `GET /threads/{parent_thread_id}/variables/{request_id}`
- `POST /threads/{parent_thread_id}/variables/{request_id}`

`POST` stores values and immediately boots the deferred subagent.

## 8. Cross-Thread Communication

### 8.1 Parent -> Child

When parent messages a child (initial invocation or resumable message):
- referenced attachments **MUST** be copied parent filesystem -> child filesystem
- queued child messages must use child-local attachment paths

### 8.2 Child -> Parent

When child reports completion/failure:
- mapped lifecycle payload (`sessionStop` / `sessionFail`) is converted to parent queued message
- payload attachments **MUST** be copied child filesystem -> parent filesystem
- parent message content should include subagent reference and result summary

When `parentCommunication` is `explicit`, tools/hooks may still escalate by calling:
- `state.notifyParent(content)`
- `state.setStatus(status)`

Attachment copying is required for correctness; linked paths from the source thread are not valid in the destination thread.

### 8.3 Status Updates

`sessionStatus` updates child status in the parent registry without terminating child execution.

## 9. Queue and Delivery Semantics

Queued messages are durable and ordered:
- if active: inject before next model call
- if idle: queue and force next turn
- if multiple: process in FIFO order
- persistence should survive DO eviction

## 10. Termination Semantics

`terminate()` is a soft shutdown:
- set terminated timestamp
- abort in-flight work
- reject future execute/queue/send operations
- propagate child termination status to parent registry when linked

Non-resumable children are typically auto-terminated after delivering terminal payloads.

## 11. Concurrency

A single thread **MUST NOT** execute multiple concurrent flows. Cross-thread concurrency is allowed.

## 12. Observability

Runtimes should emit durable logs and lifecycle markers for:
- model invocations
- tool calls/results
- subagent create/message/return/failure/status events
- execution abort/termination

Implementations may persist synthesized status messages in thread history (`metadata.status_kind`) for client grouping.

## 13. Conformance Summary

Implementations **MUST**:
- preserve sequential step and tool execution within a thread
- enforce stop and safety semantics
- persist messages/tool results before advancing
- prevent per-thread concurrent execution
- support durable queue semantics
- copy attachment files across thread boundaries for subagent communication
