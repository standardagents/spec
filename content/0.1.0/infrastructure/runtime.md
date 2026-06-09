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
| User message | A new message is injected into the thread (see [Messages](/0.1.0/specification/threads/messages)) |
| Queued message | `queueMessage()` is called (see [Messages](/0.1.0/specification/threads/messages)) |
| Queued tool | `queueTool()` is called (see [Tools](/0.1.0/specification/tools)) |
| Scheduled effect | A scheduled effect alarm fires (see [Effects](/0.1.0/specification/effects)) |

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

For runtime lifecycle creation, `subagent_create` must receive a non-empty `name` argument and runtimes should persist that name for child thread display.

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
- `state.stopSession({ result, notifyParent, status })`

If the thread has no parent, `notifyParent()` does not queue anything externally; `setStatus()` is a no-op without a parent registry entry. Clients may render the originating tool call or log entry as outbound parent communication.

Attachment copying is required for correctness; linked paths from the source thread are not valid in the destination thread.

### 8.3 Status Updates

`sessionStatus` updates child status in the parent registry without terminating child execution.

`state.stopSession()` marks the active session terminal without requiring a `sessionStop` tool call. Implementations should treat this as a successful terminal child run for blocking and non-blocking subagent lifecycle handling. The optional `notifyParent` and `status` fields perform the same parent-message and registry-status effects as `notifyParent()` and `setStatus()`.

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

## 13. Code Execution Runtime

This section covers the runtime-side mechanics for implementing `ThreadState.runCode`. The caller-facing contract — signature, options, handle, result shape, usage patterns, and limitations — lives in [Code Execution](/0.1.0/specification/threads/code-execution).

### 13.1 Isolation

A conforming implementation **MUST**:

- Create a **fresh isolate** per `runCode` call. No module cache, intrinsic, or top-level binding leaks across calls.
- Present a `globalThis` containing only ECMAScript intrinsics. Host APIs (`fetch`, `setTimeout`, `console`, `process`, `require`, etc.) **MUST NOT** be present unless the caller installed them via `options.globals`.
- Install `options.globals` identifiers at **module scope** only — they **MUST NOT** appear on `globalThis` or be enumerable via `Object.keys(globalThis)`.
- Freshly construct the sandbox's intrinsic prototypes; mutating `Object.prototype`, `Array.prototype`, or any other intrinsic inside the sandbox **MUST** have zero effect on the host.
- Reject `eval`, `new Function(source)`, `SharedArrayBuffer`, `Atomics`, and URL dynamic imports. Relative dynamic imports may resolve only when the target is supplied through `options.modules`.

### 13.2 Module Resolution

- Bare specifiers resolve **only** from `options.imports`. Relative specifiers resolve **only** from `options.modules`. Unknown specifiers and URL specifiers (`https://…`) **MUST** fail linkage and settle with `status: 'link_error'`.
- Each `options.imports[specifier]` entry is a synthetic module whose namespace is a frozen copy of the host-provided object. The key `default` (when present) becomes that module's default export.
- Each `options.modules[specifier]` entry is a source-backed ES module evaluated inside the sandbox.
- `import.meta.url` **MUST** be a synthetic `sandbox:<filename>` URL. Host paths **MUST NOT** be exposed.

### 13.3 Value Marshaling

Values cross the sandbox boundary in both directions.

- Primitives (`string`, `number`, `boolean`, `null`, `undefined`, `bigint`) cross by value.
- Plain objects, arrays, `Map`, `Set`, `Date`, typed arrays cross by **structured clone** (deep copy; no shared reference).
- Functions cross as callable proxies. Calls forward serialized arguments and marshal the return value (awaiting any returned `Promise`) back.
- Class instances, `WeakMap`, `WeakRef`, and symbols with host identity are **not transferable**. Runtimes **MAY** throw a `SerializationError`.
- Bridged functions **MUST NOT** expose host `this` or host closure state to the sandbox beyond their explicit arguments.

### 13.4 Resource Enforcement

- **Memory**: when the engine supports heap accounting, the runtime **MUST** enforce `options.memoryLimitBytes` and settle with `status: 'memory'` on overrun. When `memoryLimitBytes` is omitted, a runtime-defined default applies; the runtime **SHOULD** document it. Implementations **MAY** impose a platform-fixed ceiling that caller values cannot exceed. When a caller requests a limit above that ceiling, runtimes **MUST** either (a) clamp to the ceiling and settle overruns with `status: 'memory'` and an `error.message` naming the effective limit, or (b) reject the call with `status: 'link_error'` naming the cap. Runtimes **MUST** document which behavior they use and the effective ceiling.
- **Termination**: `handle.terminate()` **MUST** signal the sandbox to stop. The handle **MUST** settle at the next ECMAScript yield point (microtask boundary, async operation, or runtime interrupt) — **SHOULD** be within 50 ms and typically a few. A sandbox running a pure-synchronous tight loop may not reach a yield point; runtimes **MAY** rely on their own safety cap (next bullet) to force settlement. `terminate` is idempotent; subsequent calls are no-ops. When the caller passes `reason`, it surfaces in `result.error.message`.
- **Safety caps (optional)**: runtimes **MAY** apply their own caps (for example, interrupting a pure-JS infinite loop under sustained CPU pressure). When a cap fires, the handle settles with `status: 'terminated'` and a diagnosable `error.message` — the same channel as caller-initiated termination.
- The spec does **not** require a wall-clock timeout. Runtimes **MUST NOT** invent one silently; callers impose deadlines by calling `handle.terminate()`.

### 13.5 Configured Export Resolution

After module evaluation, the runtime **MUST** resolve the export selected by `options.execute` in this order:

1. Read `module.namespace[execute.fn]`, where `execute.fn` defaults to `'default'`.
2. If it is a function, call it with `execute.args` inside the sandbox. The return value is the new candidate for step 3.
3. If the current candidate is a thenable, await it. Repeat until the value is not a thenable.
4. Marshal the final value into `CodeExecutionResult.result`.

If the selected export is missing, the runtime **MUST** settle with `status: 'link_error'`. If the selected export is not a function and `execute.args` is non-empty, the runtime **MUST** settle with `status: 'error'`. An uncaught throw from the selected-export function (or a rejection from its returned promise) **MUST** settle with `status: 'error'`.

### 13.6 TypeScript Erasure

When `options.language === 'typescript'` (the default), the runtime **MUST** strip types before evaluation. Runtimes **SHOULD** use a type-erasure implementation (`sucrase`, `esbuild-transform`, `swc`, or native type-stripping). Runtimes **MUST NOT** invoke a TypeScript type-checker as part of `runCode` — only erasure runs.

### 13.7 Event Loop

- The sandbox has its own microtask queue. `Promise`, `await`, and (at runtime discretion) `queueMicrotask` behave normally.
- `setTimeout` / `setInterval` are **not** exposed unless the caller bridges them via `options.globals`.
- Top-level `await` is supported. A module "completes" once its top-level evaluation promise settles and the configured-export resolution ([§13.5](#135-configured-export-resolution)) finishes.

### 13.8 Implementation Approaches (Non-Normative)

Approaches that satisfy the requirements above:

- **A host-provided dynamic-isolate API** that spawns a fresh V8 isolate per call with an in-memory module map and no ambient host APIs. Termination propagates through V8 interrupts at the next yield point. Memory is typically fixed at the platform's per-isolate cap. Suitable for production deployment of `runCode` inside a parent process without embedding a separate JS engine.
- **QuickJS compiled to WebAssembly** (e.g. `quickjs-emscripten`). Fresh JS context per call, configurable heap cap, and an interrupt callback that `handle.terminate()` can trigger. Portable across WASM-capable hosts (Worker-style, Node, browser); gives per-call memory limits independent of any host cap.
- **V8 isolates via Node's `vm` module** (or equivalent embedder API). Frozen context, `eval` disabled, WebAssembly compilation disabled. `isolate->TerminateExecution()` satisfies `handle.terminate()`.
- **A second isolate reached over RPC / service binding**, with no bindings of its own and a module transformer at the boundary. Request cancellation satisfies termination.

### 13.9 Conformance Checklist

A runtime that implements code execution **MUST**:

1. Expose `ThreadState.runCode(source, options?)` returning a `CodeExecution` handle.
2. Accept TypeScript source by default and evaluate it as an ES module.
3. Resolve bare-specifier imports **only** from `options.imports`, relative imports **only** from `options.modules`, and fail linkage on URL or unknown specifiers.
4. Install `options.globals` at module scope but **not** on `globalThis`.
5. Present an isolated `globalThis` with only ECMAScript intrinsics.
6. Reject `eval`, `new Function(source)`, `SharedArrayBuffer`, `Atomics`, and URL dynamic imports.
7. Enforce `options.memoryLimitBytes` when the engine supports heap accounting; settle with `status: 'memory'` on overrun.
8. Settle the handle with `status: 'terminated'` within 50 ms of `handle.terminate()`.
9. Marshal values across the boundary by structured clone / callable proxy, with no shared references.
10. Resolve the configured export per [§13.5](#135-configured-export-resolution).
11. Return `CodeExecutionResult` with the exact status codes defined in the [caller-facing spec](/0.1.0/specification/threads/code-execution#41-status-values).
12. Create a fresh isolate per call; leak no state between calls.

A runtime **SHOULD**:

- Capture `console.*` logs when no `console` global is supplied.
- Surface syntactic and linker errors with `line`/`column` pointing to the caller's source.
- Call `handle.terminate()` when `state.execution?.abortSignal` fires.

## 14. Durable Key-Value Store

`ThreadState.getValue` / `ThreadState.setValue` expose a simple durable key-value store scoped to the thread. The caller-facing surface is specified in [Threads §7](/0.1.0/specification/threads#7-durable-key-value-store); the runtime semantics below define how implementations must back it.

### 14.1 Runtime Semantics

1. Values **MUST** be persisted to durable per-thread storage that survives execution boundaries, process restarts, and runtime redeploys.
2. A value written by `setValue(key, value)` **MUST** be visible to every subsequent `getValue(key)` on the same thread, across any execution context (tools, hooks, endpoints).
3. Each thread **MUST** maintain its own isolated key space. Values **MUST NOT** be readable by any other thread, including parent, child, or sibling threads.
4. Values **MUST** round-trip with JSON-equivalent structure (objects, arrays, strings, numbers, booleans, `null`). Runtimes **MAY** reject non-JSON-serializable values with a thrown error.
5. `getValue(key)` **MUST** return `null` when no value has been set for the key, when the value has been deleted, or when the thread is accessed after the store has never been written.
6. `setValue(key, null)` and `setValue(key, undefined)` **MUST** delete the key so that subsequent `getValue(key)` calls return `null`.
7. Writes **SHOULD** be durable before the promise returned by `setValue` resolves.
8. Values **MUST NOT** be automatically copied, inherited, or synchronized between threads when subagents are spawned.
9. Storage is **not** required to be encrypted at rest (unlike `env`); runtimes **MAY** encrypt at their discretion.

### 14.2 Capacity and Errors

Runtimes **MAY** enforce implementation-defined caps on key length, value size, and total number of keys per thread. When a cap is exceeded, `setValue` **SHOULD** reject with an error that identifies which limit was hit. Caps **SHOULD** be documented with the runtime.

## 15. Conformance Summary

Implementations **MUST**:
- preserve sequential step and tool execution within a thread
- enforce stop and safety semantics
- persist messages/tool results before advancing
- prevent per-thread concurrent execution
- support durable queue semantics
- copy attachment files across thread boundaries for subagent communication
- honor the [Code Execution](#13-code-execution-runtime) runtime contract when `ThreadState.runCode` is exposed
- back `ThreadState.getValue` / `ThreadState.setValue` with a durable, per-thread key-value store per [§14](#14-durable-key-value-store)
