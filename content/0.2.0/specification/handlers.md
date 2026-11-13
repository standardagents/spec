# Handlers

A handler is a function that takes one side's turns in a conversation. When a side of an [agent](/0.2.0/specification/agents) is backed by a handler, the runtime does not call a model to answer an inbound message — it calls the handler function once, with the thread state and the message, and whatever that function does is the side's turn.

A handler is **not** a hook (hooks decorate turns owned by something else, and their failures are non-fatal), **not** a tool (tools are capabilities a turn-owner chooses to invoke), and **not** an effect (effects run outside the conversation flow). Its only role is backing a side of an agent.

## 1. Handler Definition

Handlers live in their own definition directory (`agents/handlers/` in the conventional layout) and are created with `defineHandler()`:

```typescript
// agents/handlers/relay_pipe.ts
import { defineHandler } from '@standardagents/spec';

export default defineHandler({
  description: 'Forwards inbound user traffic to the assistant child and relays answers back.',
  execute: async (state, message) => {
    // full ThreadState — forward, respond, spawn, stop, read/write KV
  },
});
```

| Property | Type | Description |
|----------|------|-------------|
| `description` | `string` | Optional human-facing summary |
| `execute` | `(state: ThreadState, message: Message) => Promise<void>` | The turn implementation |

The `message` parameter is the full persisted [`Message`](/0.2.0/specification/threads/messages#1-message-structure) — id, role, content, silent flag, metadata, timestamps. It is not a narrowed view: handlers are trusted definition code, like tools.

## 2. Referencing a Handler

A handler is referenced from exactly one place: the `handler` property of a [side configuration](/0.2.0/specification/agents#12-sideconfig).

```typescript
defineAgent({
  name: 'relay_agent',
  sideA: { handler: 'relay_pipe', subagents: [{ agent: 'assistant_agent', maxInstances: 1 }] },
  sideB: { human: true },
});
```

Handlers **MUST NOT** be referenced by prompt `tools` arrays, hook lists, or effect schedules. Implementations **MUST** reject such references at definition time. This keeps the taxonomy crisp — code that wants a capability writes a tool; code that wants to decorate writes a hook; code that owns turns is a handler.

## 3. Execution Model

A handler-backed side's turn is:

1. An inbound message arrives on the side's perspective.
2. The runtime invokes the handler once with the thread's `ThreadState` and that message.
3. The invocation returns (or throws). The turn is complete.

There are no steps, no tool-choice loop, and no model requests for this side. Consequences:

- `maxSteps`, `stopOnResponse`, `stopTool`, and session bindings are not legal on handler sides — a handler turn has no steps to cap and ends when `execute` returns. Handlers end sessions explicitly via [`state.stopSession()`](/0.2.0/specification/threads#9-subagent-hierarchy-communication-and-termination).
- When the agent sets `maxSessionTurns`, a handler turn counts toward the exchange cap exactly like a prompt turn — exchange counting is uniform across backings.

## 4. Delivery Semantics

Delivery to a handler is **exactly-once per message**:

- The runtime **MUST** invoke the handler exactly once for each inbound message on the side's perspective, in message persistence order.
- The runtime **MUST NOT** invoke a handler concurrently for the same thread. Messages that arrive while a handler turn is in flight **MUST** wait in the queue and be delivered one at a time, in order, after the current turn completes.
- The runtime **MUST NOT** automatically redeliver a message whose handler invocation failed. Retry is a userland decision (re-send the message).

> **Warning:** Because queued messages wait behind the in-flight turn, a long-running handler stalls its thread. In particular, a handler that awaits a `blocking` child session holds the delivery slot for that session's entire duration — and if that child can only finish after *another* inbound message on this thread, the thread deadlocks. Relay-style handlers **SHOULD** forward without blocking (`queueMessage` toward the child) and treat the child's replies as ordinary later turns.

Cross-thread fan-in ordering (two children queueing toward the same parent handler) is implementation-defined; only per-thread persistence order is guaranteed.

## 5. Error Semantics

A handler that throws is **fatal to the turn, and only the turn**:

- The turn is marked failed. The error **MUST** be surfaced on the runtime's request/execution log as a runtime-origin failure — a throwing handler never silently swallows a message.
- The inbound message stays persisted. Nothing is rolled back.
- The **session continues**: the failure does not end the session, terminate the thread, or poison the queue. The next inbound message gets a fresh handler invocation.

This is deliberately unlike hooks (whose failures are non-fatal to the turn they decorate) and unlike session failure (`sessionFail` / `stopSession`), which a handler must invoke explicitly if an error should end the session.

## 6. Capabilities

A handler receives the full [`ThreadState`](/0.2.0/specification/threads) and may do anything tools can do:

- **Forward** — `(await state.getChildThread(ref)).queueMessage(...)` toward a child, or `state.notifyParent(...)` toward a parent.
- **Respond** — `state.injectMessage({ role, content })` in its own side's role (`assistant` for side A, `user` for side B — see [perspective mapping](/0.2.0/specification/threads/messages#4-queueing-messages)).
- **Spawn** — create child instances of the side's declared [relationships](/0.2.0/specification/subagents) via lifecycle APIs.
- **Control** — `state.stopSession()`, `state.setStatus()`, effects, environment, key-value store, filesystem.

Handlers need no tool grants for children: the side's `subagents` declarations establish existence and lifecycle, and the handler reaches children through `ThreadState` directly. (The injected lifecycle *tools* exist for prompts — a handler calls the same operations as code.)

## 7. The Outbound Boundary

Handlers get no auto-injected reply channel. If a handler (or the side it feeds) should speak to a user or an external surface, that is userland code — a tool or handler calling the messaging surface it chooses (the `message_user` pattern).

This is a deliberate specification boundary: **the runtime routes inbound; userland decides outbound.** A runtime-injected "reply" channel was considered and rejected — it would hard-code one outbound topology into the spec and every runtime, where a five-line userland call expresses any of them.

## 8. Livelock Discipline

Handler sides do not run away on their own — a handler runs only when a message arrives. But a handler that *replies to every inbound message* paired with a prompt-backed side creates a message ping-pong with no natural stop. Handler authors own their termination discipline:

- reply conditionally, not unconditionally;
- or set `maxSessionTurns` on the agent (available on every shape) as a hard safety valve;
- or end the session explicitly with `state.stopSession()` when the work is done.

## 9. Worked Example: the Relay

A user-facing thread that does **zero model work**: every inbound user message is forwarded verbatim to a composed assistant child; every child answer is relayed back out through userland messaging. One handler expresses the entire surface:

```typescript
// agents/handlers/relay_pipe.ts
import { defineHandler } from '@standardagents/spec';

export default defineHandler({
  description: 'Forwards user messages and displays replies from the assistant child.',
  execute: async (state, message) => {
    if (message.metadata?.relay_reply === true) {
      await state.injectMessage({ role: 'assistant', content: message.content ?? '' });
      return;
    }

    const child = state.children.find((c) => c.relationship === 'assistant_agent');
    if (!child) throw new Error('The assistant child is unavailable.');
    const thread = await state.getChildThread(child.reference);
    if (!thread) throw new Error('The assistant thread is unavailable.');
    await thread.queueMessage({ role: 'user', content: message.content ?? '' });
  },
});
```

```typescript
// agents/agents/relay_agent.ts
import { defineAgent } from '@standardagents/spec';

export default defineAgent({
  name: 'relay_agent',
  sideA: {
    handler: 'relay_pipe',
    subagents: [{
      agent: 'assistant_agent',
      maxInstances: 1,
      immediate: true,              // spawned at thread creation — see Subagents §3
      parentCommunication: 'explicit',
    }],
  },
  sideB: { human: true },
});
```

```typescript
// agents/tools/reply_to_user.ts
import { defineTool } from '@standardagents/spec';
import { z } from 'zod';

export default defineTool({
  description: 'Return a text reply to the person through the parent relay.',
  args: z.object({ text: z.string().min(1).describe('The reply for the person') }),
  execute: async (state, { text }) => {
    const parent = await state.getParentThread();
    if (!parent) return { status: 'error', error: 'The parent relay is unavailable.' };
    await parent.queueMessage({
      role: 'user',
      content: text,
      silent: true,
      metadata: { relay_reply: true },
    });
    return { status: 'success', result: text };
  },
});
```

The child's prompt lists `reply_to_user` in `tools`.
Its prompt instructs the model to call this tool with its answer.
The child's prompt-backed side binds `sessionStop: { name: 'reply_to_user', messageProperty: 'text' }`.
The tool queues the answer with an application-defined `relay_reply` flag.
The queued message is silent, so the person's conversation does not show it as a user message.
The parent handler displays that answer with `injectMessage`.
The relationship uses `parentCommunication: 'explicit'` to suppress implicit completion messages.
The flag is part of this application's message protocol.
The explicit flag works when a runtime omits provenance metadata.

The relay thread sends no model requests. The assistant child owns the model work.

## 10. TypeScript Reference

```typescript
interface HandlerDefinition {
  description?: string;
  execute: (state: ThreadState, message: Message) => Promise<void>;
}

function defineHandler(options: HandlerDefinition): HandlerDefinition;
```

Handler names participate in the [type registry](/0.2.0/specification/type-registry) via `HandlerRegistry`, so `HandlerSide.handler` narrows to defined handler names when generation is active.
