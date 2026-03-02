# Effects

Effects are scheduled side-effect handlers that run outside normal tool execution. They are ideal for delayed notifications, background cleanup, and async operations that should not block a model step.

## 1. Effect Definition

### 1.1 Purpose

Unlike tools, effects:

- do not return output to the LLM
- can be delayed for future execution
- run independently from immediate conversation turn processing

### 1.2 defineEffect

Effects **MUST** be declared with `defineEffect()` and exported as the default export from a file in `agents/effects/`.

With args schema:

```typescript
import { z } from 'zod';
import { defineEffect } from '@standardagents/spec';

export default defineEffect(
  'Send a reminder email',
  z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  async (state, args) => {
    // runtime-specific implementation
  }
);
```

Without args schema:

```typescript
import { defineEffect } from '@standardagents/spec';

export default defineEffect(
  'Clean up stale records',
  async (state) => {
    // runtime-specific implementation
  }
);
```

### 1.3 Naming

- Effect names are file-based (`agents/effects/send_digest.ts` => `send_digest`)
- Names **SHOULD** use `snake_case`
- Names **MUST** be unique within the active namespace

## 2. Scheduling Effects

Effects are scheduled through `ThreadState.scheduleEffect(name, args, delay?)`.

```typescript
await state.scheduleEffect(
  'send_reminder_email',
  { to: 'user@example.com', subject: 'Reminder', body: 'Hello!' },
  30 * 60 * 1000
);
```

### 2.1 Packed Effect Names

For packed package effects, runtimes should support qualified names:

```text
{packageId}/{effectName}
```

Example:

```typescript
await state.scheduleEffect('standardagent-sales/send_digest', { accountId: 'acct_123' }, 0);
```

This avoids collisions between global and package-local effect names.

## 3. Execution Semantics

Implementations:

- **MUST** enqueue effect execution asynchronously
- **MUST** preserve scheduled args for execution time
- **SHOULD** expose inspection and cancellation APIs (`getScheduledEffects`, `removeScheduledEffect`)
- **SHOULD** keep effect handlers idempotent where possible

Effect execution is runtime-managed and may occur after the originating flow has completed.

## 4. Type Definitions

```typescript
export type Effect<State = ThreadState, Args extends ToolArgs | null = null> =
  Args extends ToolArgs
    ? (state: State, args: z.infer<Args>) => Promise<void> | void
    : (state: State) => Promise<void> | void;

export type EffectDefinition<State = ThreadState, Args extends ToolArgs | null = null> =
  [string, Args, Effect<State, Args>];
```

See also:

- [Threads](/0.1.0/specification/threads) for scheduling APIs
- [Packaging](/0.1.0/distribution/packaging) for packed effect export structure
