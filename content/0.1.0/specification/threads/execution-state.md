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
| `messageHistory` | `Message[]` | Current history |
| `abortSignal` | `AbortSignal` | Cancellation signal |
| `promptPath` | `string[]` | Path from root to current prompt |

### 2.1 Prompt Path

The `promptPath` property tracks the current position in the prompt hierarchy:
- At root level: `['my_prompt']`
- Inside a sub-prompt: `['my_prompt', 'sub_prompt']`
- After handoff: `['new_agent_prompt']`

This allows tools and hooks to understand their execution context depth.

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
  readonly messageHistory: Message[];
  readonly abortSignal: AbortSignal;
  readonly promptPath: string[];
  forceTurn(side: 'a' | 'b'): void;
  stop(): void;
}
```
