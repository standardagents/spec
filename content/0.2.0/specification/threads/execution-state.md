# Execution State

`ThreadState.execution` is present while a thread is actively running (during tool calls, hook invocations, sub-prompts) and `null` when the thread is at rest (from endpoints, external callers). Execution state carries step counts, the active dual-side, cancellation, and controls for stopping or forcing turns.

For everything else about threads, see [Threads](/0.2.0/specification/threads).

## 1. Availability

The `execution` property is:
- **Present** during active execution (tools, hooks)
- **Null** when accessing at rest (endpoints)

```typescript
if (state.execution) {
  console.log(`Step ${state.execution.stepCount}`);
}
```

## 2. Execution Properties

| Property | Type | Description |
|----------|------|-------------|
| `flowId` | `string` | Unique execution ID |
| `currentSide` | `'a' \| 'b'` | The side whose turn is executing |
| `stepCount` | `number` | Total LLM request/response cycles |
| `sideAStepCount` | `number` | Side A steps |
| `sideBStepCount` | `number` | Side B steps |
| `stopped` | `boolean` | Execution stopped |
| `stoppedBy` | `'a' \| 'b' \| undefined` | Who stopped |
| `messageHistory` | `Message[]` | Live chronological persisted execution history, including silent messages |
| `abortSignal` | `AbortSignal` | Cancellation signal |
| `promptPath` | `string[]` | Path from root to current prompt |

### 2.1 Prompt Path

The `promptPath` property tracks the current position in the prompt hierarchy:
- At root level: `['my_prompt']`
- Inside a sub-prompt: `['my_prompt', 'sub_prompt']`
- After handoff: `['new_agent_prompt']`

This allows tools and hooks to understand their execution context depth.

### 2.2 Live execution history

`execution.messageHistory` **MUST** represent live chronological persisted execution history.

- A successful [`injectMessage()`](/0.2.0/specification/threads/messages#3-injecting-messages) **MUST** make that record observable on `execution.messageHistory` to later tools and hooks in the same execution.
- Silent messages **MUST** remain on `execution.messageHistory`.
- Synthetic or transformed messages produced by `filter_messages` or `prefilter_llm_history` **MUST** remain confined to the request context. They **MUST NOT** replace `execution.messageHistory`.

The provider request is assembled from a separate snapshot. See [Runtime §4](/0.2.0/infrastructure/runtime#4-context-assembly).

### 2.3 Handler turns

During a [handler](/0.2.0/specification/handlers)-backed side's turn, `execution` is present and `currentSide` reflects that side, but no LLM request/response cycles occur: `stepCount` and the per-side step counts advance only with model steps, so a handler turn contributes zero steps. When the agent sets `maxSessionTurns`, the handler turn still counts toward the session exchange cap — exchange counting is uniform across backings.

## 3. Controlling Execution

```typescript
// Force next turn to a specific side
state.execution.forceTurn('b');

// Stop execution after current operation
state.execution.stop();

// Use abort signal for cancellation
fetch(url, { signal: state.execution.abortSignal });
```

`state.execution.stop()` stops the current execution loop. It does not by itself satisfy a subagent/session terminal boundary. To terminally end the active agent session, use [`state.stopSession()`](/0.2.0/specification/threads#9-subagent-hierarchy-communication-and-termination).

## 4. Run Status

`ThreadState.execution` describes a run from inside it. The **run status**
describes the thread from outside: whether an execution is in flight, and how
the last one ended. It is available everywhere `ThreadState` is, and to
clients without polling.

```typescript
type ThreadRunState = 'idle' | 'running' | 'failed';

interface ThreadStatus {
  state: ThreadRunState;
  since: number;          // microseconds since epoch, like created_at
  reason?: string | null; // raw stop reason code of the last transition out of running
}

const status = await state.status();
```

### 4.1 States

| State | Meaning |
|-------|---------|
| `idle` | No execution is running and the last run did not fail — or the thread has never run (`since` is `0`, `reason` is `null`). |
| `running` | An execution is in flight. `reason` is `null`. |
| `failed` | The last run ended in an error. |

The run status describes **execution, not turn ownership**. A run that ends by
handing the turn to a human-backed side settles as `idle`; its `reason` (for
example `awaiting_human`, `stop_on_response`, or `stop_tool`) carries the
detail. The subagent registry keeps its own `awaiting_human` status for
children (see [Subagents](/0.2.0/specification/subagents)).

### 4.2 Reasons

`reason` is the run's stop reason code. Runtimes **SHOULD** use these codes
where they apply and **MAY** add others; clients **MUST** treat unknown codes
as opaque.

| Settles as | Codes |
|------------|-------|
| `idle` | `stop_on_response`, `stop_tool`, `awaiting_human`, `forced_human_turn`, `hook_blocked`, `aborted`, `aborted_by_user`, `session_stop`, `state_stop_session`, `max_total_steps`, `max_side_steps`, `max_session_turns`, `handler_idle` |
| `failed` | `step_error`, `repeated_tool_error`, `session_fail`, `fatal_error`, `execution_lost` |

### 4.3 Requirements

- Runtimes **MUST** set `running` when any execution of the thread starts and **MUST** settle it (`idle` or `failed`) when that execution ends, including when it throws.
- Runtimes **MUST** persist the status with the thread so it survives restarts.
- Runtimes **MUST NOT** leave a thread `running` once its executor is gone (eviction, deploy, crash). A lost execution settles to `failed` with reason `execution_lost`; a later recovery run sets `running` again.
- `since` **MUST** change only when `state` or `reason` changes.
- `status()` is unrelated to `setStatus(label)`, which writes a label into this thread's entry in its parent's subagent registry.

### 4.4 Client delivery

Run status is push-only. Runtimes that expose a thread message stream
**MUST** send a status frame immediately after accepting each stream
connection (a snapshot) and again on every change:

```json
{ "type": "thread_status", "status": { "state": "running", "since": 1727870000000000, "reason": null } }
```

A reconnecting client resynchronizes from the snapshot; clients **SHOULD NOT**
poll for run status. Runtimes with a thread read endpoint **SHOULD** include
the same `status` object in it.

## 5. TypeScript Reference

```typescript
interface ExecutionState {
  readonly flowId: string;
  readonly currentSide: 'a' | 'b';
  readonly stepCount: number;
  readonly sideAStepCount: number;
  readonly sideBStepCount: number;
  readonly stopped: boolean;
  readonly stoppedBy?: 'a' | 'b';
  readonly messageHistory: Message[]; // live persisted execution history
  readonly abortSignal: AbortSignal;
  readonly promptPath: string[];
  forceTurn(side: 'a' | 'b'): void;
  stop(): void;
}
```
