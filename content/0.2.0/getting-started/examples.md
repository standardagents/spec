# Examples

Two worked examples: the minimal agent, then a composition that uses all three backings.

## 1. Hello, World

The simplest Standard Agent is a person talking to a model. An agent has exactly two [sides](/0.2.0/specification/agents#1-sides-and-backings); here side A is backed by a prompt and side B by a human:

```typescript
// agents/models/conversational.ts
export default defineModel({
  name: 'conversational',
  provider: 'openrouter',
  model: 'anthropic/claude-sonnet-5',
});

// agents/prompts/assistant.ts
export default definePrompt({
  name: 'assistant',
  toolDescription: 'General purpose assistant',
  model: 'conversational',
  prompt: 'You are a helpful assistant. Be concise and accurate.',
  includeChat: true,
});

// agents/agents/assistant.ts
export default defineAgent({
  name: 'assistant',
  sideA: { prompt: 'assistant' },
  sideB: { human: true },
});
```

That is a complete agent: one model, one prompt, two explicit sides. The chat surface renders where the human backing is; the model takes side A's turns.

## 2. The Relay Stack

A production-shaped composition using all three backings in about thirty lines: a deterministic **relay** (handler × human) that fronts a worker/reviewer **assistant** (prompt × prompt) composed as a persistent child.

```typescript
// agents/handlers/relay_pipe.ts — deterministic side: no model, no steps
export default defineHandler({
  description: 'Pipe user traffic to the assistant child; relay answers outward.',
  execute: async (state, message) => {
    const child = state.children.find(c => c.relationship === 'assistant_agent');
    if (!child) return;
    const thread = await state.getChildThread(child.reference);
    await thread?.queueMessage({ role: 'user', content: message.content ?? '' });
  },
});

// agents/agents/relay_agent.ts — handler × human
export default defineAgent({
  name: 'relay_agent',
  sideA: {
    handler: 'relay_pipe',
    subagents: [{
      agent: 'assistant_agent',
      maxInstances: 1,
      immediate: true,                  // spawned at thread creation
      parentCommunication: 'explicit',  // child's finish doesn't wake the relay
    }],
  },
  sideB: { human: true },
});

// agents/agents/assistant_agent.ts — prompt × prompt, itself composing a child
export default defineAgent({
  name: 'assistant_agent',
  exposeAsTool: true,
  toolDescription: 'Full assistant with calendar delegation.',
  maxSessionTurns: 30,
  sideA: {
    prompt: 'assistant_worker',
    subagents: [
      { agent: 'calendar_agent', as: 'work_calendar',     scopedEnv: ['WORK_CAL_ID'] },
      { agent: 'calendar_agent', as: 'personal_calendar', scopedEnv: ['PERSONAL_CAL_ID'] },
    ],
  },
  sideB: { prompt: 'assistant_critic' },
});
```

What this exercises:

- **All three backings** — `handler` (relay side A), `human` (relay side B), `prompt` (both assistant sides).
- **Zero model calls on the relay thread** — the handler owns its turns outright. See [Handlers](/0.2.0/specification/handlers).
- **Side-owned relationships** — the assistant child is declared on the relay's handler side; the calendar children on the assistant's side A. Child traffic lands on the owning side. See [Subagents](/0.2.0/specification/subagents).
- **Aliases** — one `calendar_agent` definition composed twice under different names with independent `scopedEnv`.
- **Persistent children** — every instance is a durable thread; session end never destroys it, and a later message resumes with history intact.
- **Immediate spawning** — the assistant child exists before the first user message arrives.

Continue with the [Agents](/0.2.0/specification/agents), [Handlers](/0.2.0/specification/handlers), and [Subagents](/0.2.0/specification/subagents) chapters for the normative rules behind each of these.
