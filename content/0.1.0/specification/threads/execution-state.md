# Execution State

`ThreadState.execution` is present while a thread is actively running (during tool calls, hook invocations, sub-prompts) and `null` when the thread is at rest (from endpoints, external callers). Execution state carries step counts, the active dual-side, cancellation, and controls for stopping or forcing turns.

For everything else about threads, see [Threads](/0.1.0/specification/threads).

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
| `currentSide` | `'a' \| 'b'` | Active side (dual_ai) |
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

- A successful [`injectMessage()`](/0.1.0/specification/threads/messages#3-injecting-messages) **MUST** make that record observable on `execution.messageHistory` to later tools and hooks in the same execution.
- Silent messages **MUST** remain on `execution.messageHistory`.
- Synthetic or transformed messages produced by `filter_messages` or `prefilter_llm_history` **MUST** remain confined to the request context. They **MUST NOT** replace `execution.messageHistory`.

The provider request is assembled from a separate snapshot. See [Runtime §4](/0.1.0/infrastructure/runtime#4-context-assembly).

## 3. Controlling Execution

```typescript
// Force next turn to a specific side (dual_ai only)
state.execution.forceTurn('b');

// Stop execution after current operation
state.execution.stop();

// Use abort signal for cancellation
fetch(url, { signal: state.execution.abortSignal });
```

`state.execution.stop()` stops the current execution loop. It does not by itself satisfy a subagent/session terminal boundary. To terminally end the active agent session, use [`state.stopSession()`](/0.1.0/specification/threads#9-subagent-hierarchy-communication-and-termination).

## 4. TypeScript Reference

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
