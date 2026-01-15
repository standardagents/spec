# Agents

[TK]

## 1. Agent Definition

Agents are the top-level orchestration units in Standard Agents. They combine prompts, stop conditions, and behavioral rules into cohesive entities that manage conversations between AI models or between AI and human users.

### 1.1 Required Properties

An agent definition **MUST** include the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique identifier for this agent |
| `sideA` | `SideConfig` | Configuration for the primary side |

### 1.2 Optional Properties

An agent definition **MAY** include the following properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | `string` | - | Human-readable title (deprecated) |
| `type` | `AgentType` | `'ai_human'` | Conversation type |
| `maxSessionTurns` | `number` | - | Maximum turns for dual_ai |
| `sideB` | `SideConfig` | - | Configuration for secondary side |
| `exposeAsTool` | `boolean` | `false` | Make agent callable as tool |
| `toolDescription` | `string` | - | Description when used as tool |
| `description` | `string` | - | Brief description |
| `icon` | `string` | - | Icon URL or path |
| `tenvs` | `Record<string, unknown>` | - | Default thread environment variables |

## 2. Definitions

### 2.1 Core Concepts

| Term | Definition |
|------|------------|
| **Thread** | An abstract execution context that maintains conversation state, message history, and any associated resources (e.g., files). A thread persists across multiple sessions. Each thread **MUST** have a cryptographically unique identifier (implementations **SHOULD** use `crypto.randomUUID()`). |
| **Session** | The period when an agent is executing autonomously in a loop. For `ai_human` agents, a session is a single turn of AI processing. For `dual_ai` agents, a session spans multiple turns between two AIs until a stop condition is met. |
| **Turn** | A single side completing its execution. In `ai_human`, a turn is the AI responding to a user message. In `dual_ai`, each side taking its turn constitutes one turn. |
| **Step** | A single LLM invocation within a turn. A turn may include multiple steps if the agent calls tools and continues processing. |

### 2.2 Execution Flow

A typical `ai_human` execution flow:

1. User sends a message (starts a **session** and **turn**)
2. Agent invokes the LLM with the configured prompt (a **step**)
3. If the LLM returns tool calls, the agent executes them and invokes the LLM again (another **step**)
4. Steps repeat until a stop condition is met (e.g., text response without tool calls)
5. The **turn** and **session** end; agent waits for the next user message

A typical `dual_ai` execution flow:

1. Initial message triggers a **session**
2. Side A executes its **turn** (one or more **steps**, until a stop condition is met)
3. Side B executes its **turn** (one or more **steps**, until a stop condition is met)
4. Turns alternate until a session ending condition is met (e.g., `maxSessionTurns` reached, or `endSessionTool` is called)
5. The **session** ends

## 3. Agent Types

### 3.1 ai_human

The `ai_human` type is the most common configuration, where an AI agent converses with a human user.

**Behavior:**
- Side A is the AI participant
- Side B represents the human (no configuration needed)
- The AI responds to human messages
- Execution ends when stop conditions are met or the human stops

**Example:**
```typescript
defineAgent({
  name: 'support_agent',
  type: 'ai_human',
  sideA: {
    prompt: 'customer_support',
    stopOnResponse: true,
  },
});
```

### 3.2 dual_ai

The `dual_ai` type enables two AI participants to converse with each other.

**Message History Perspective:**

Each AI receives the message history as if **it is the assistant** and the other AI is the user:
- Side A sees its own messages as `assistant` and Side B's messages as `user`
- Side B sees its own messages as `assistant` and Side A's messages as `user`

> 💡 Tip: Neither side implicitly knows it is communicating with another AI. This makes `dual_ai` particularly effective for **reflection** (an agent critiques its own work), **debate** (two perspectives argue a topic), **negotiation** (parties work toward agreement), and **red teaming** (one agent probes another for weaknesses).

**Behavior:**
- Both Side A and Side B are AI participants
- Sides alternate turns automatically
- `maxSessionTurns` **SHOULD** be set to prevent infinite loops
- Both sides **MUST** have configuration

**Example:**
```typescript
defineAgent({
  name: 'debate_agent',
  type: 'dual_ai',
  maxSessionTurns: 20,
  sideA: {
    label: 'Pro',
    prompt: 'debate_pro',
    stopOnResponse: true,
  },
  sideB: {
    label: 'Con',
    prompt: 'debate_con',
    stopOnResponse: true,
  },
});
```

### 3.3 Type Selection

Implementations **SHOULD** default to `ai_human` when type is not specified.

## 4. Side Configuration

### 4.1 SideConfig Properties

Each side has its own configuration controlling prompts and stop conditions:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `prompt` | `string` | Required | Prompt to use for this side |
| `label` | `string` | - | Custom label for UI/logs |
| `stopOnResponse` | `boolean` | `true` | Stop on text response |
| `stopTool` | `string` | - | Tool that triggers stop |
| `stopToolResponseProperty` | `string` | - | Property to extract from stop tool |
| `maxSteps` | `number` | - | Maximum LLM request/response cycles for this side |
| `endSessionTool` | `string` | - | Tool that ends entire session |

### 4.2 Side Labels

Labels are optional but **RECOMMENDED** for clarity:

```typescript
sideA: {
  label: 'ATC Controller',
  prompt: 'atc_prompt',
},
sideB: {
  label: 'Pilot',
  prompt: 'pilot_prompt',
},
```

## 5. Stop Conditions

### 5.1 Stop on Response

When `stopOnResponse` is `true` (the default):
- The side's turn ends when the LLM produces a text response without tool calls
- Tool-only responses do not trigger a stop
- This is the most common stop condition

### 5.2 Stop Tool

The `stopTool` property specifies a tool that triggers a stop when called:

```typescript
sideA: {
  prompt: 'classifier',
  stopTool: 'classify_intent',
  stopToolResponseProperty: 'intent',
},
```

**Requirements:**
- When `stopTool` is set, `stopToolResponseProperty` **MUST** also be set
- The extracted property value is used to determine the conversation outcome
- `stopTool` overrides `stopOnResponse` when the named tool is called

### 5.3 End Session Tool

The `endSessionTool` property specifies a tool that ends the entire session:

```typescript
sideA: {
  prompt: 'support',
  endSessionTool: 'close_ticket',
},
```

**Behavior:**
- When called, the session ends for both sides
- Different from `stopTool` which only ends the current side's turn
- Useful for explicit termination scenarios

### 5.4 Maximum Steps

The `maxSteps` property limits LLM request/response cycles for a single side:

```typescript
sideA: {
  prompt: 'researcher',
  maxSteps: 50,
},
```

**Behavior:**
- When the limit is reached, the side is forced to stop
- This is a safety limit to prevent runaway execution
- Implementations **SHOULD** inject a budget warning message before the limit
- `maxSteps` and `maxSessionTurns` **SHOULD** be enforced to prevent resource exhaustion

## 6. Session Turns

### 6.1 maxSessionTurns

For `dual_ai` agents, `maxSessionTurns` limits the total back-and-forth:

```typescript
defineAgent({
  name: 'negotiation',
  type: 'dual_ai',
  maxSessionTurns: 30,
  sideA: { prompt: 'buyer', stopOnResponse: true },
  sideB: { prompt: 'seller', stopOnResponse: true },
});
```

**Behavior:**
- Counts completed exchanges (one turn = one side completing)
- When limit is reached, the conversation ends
- Implementations **MUST** enforce this limit for `dual_ai` agents

### 6.2 Step and Turn Counting

Implementations **SHOULD** track:
- Per-side step counts (for `maxSteps`) - counts LLM request/response cycles
- Total session turns (for `maxSessionTurns`) - counts completed side exchanges
- Global step count (for absolute safety limits)

## 7. Agent as Tool

### 7.1 Exposing Agents

Agents can be exposed as tools for other prompts:

```typescript
defineAgent({
  name: 'specialist',
  exposeAsTool: true,
  toolDescription: 'Hand off to specialist for complex issues',
  sideA: { prompt: 'specialist_prompt', stopOnResponse: true },
});
```

**Requirements:**
- When `exposeAsTool` is `true`, `toolDescription` **MUST** be provided
- The description is shown to the LLM for tool selection
- Agents exposed as tools **SHOULD** have appropriate access controls

### 7.2 Agent Handoffs

When an agent is called as a tool:
1. A new thread context is created
2. The agent executes with the provided input
3. The result is returned to the calling prompt
4. The calling prompt can continue its execution

## 8. Metadata Properties

### 8.1 Description

The description provides context for humans:

```typescript
defineAgent({
  name: 'code_reviewer',
  description: 'Reviews code for bugs, security issues, and best practices',
  // ...
});
```

### 8.2 Icon

Icons improve visual identification:

```typescript
defineAgent({
  name: 'support',
  icon: '/icons/support.svg',  // or 'https://example.com/icon.svg'
  // ...
});
```

**Behavior:**
- Absolute paths (starting with `/`) are converted to full URLs by the API
- External URLs are used as-is
- Icon URLs **MUST** be validated to prevent XSS via `javascript:` URLs

## 9. Validation

### 9.1 Required Field Validation

Implementations **MUST** validate that:

1. `name` is a non-empty string (validated to prevent path traversal attacks). Names **SHOULD** end in `_agent` (e.g., `support_agent`, `research_agent`)
2. `sideA` is provided
3. `sideA.prompt` is a non-empty string
4. For `dual_ai` type, `sideB` and `sideB.prompt` are provided

### 9.2 Conditional Validation

Implementations **MUST** validate that:

1. When `exposeAsTool` is `true`, `toolDescription` is provided
2. When `stopTool` is set, `stopToolResponseProperty` is also set
3. When `maxSteps` is set, it is a positive number
4. When `maxSessionTurns` is set, it is a positive number

### 9.3 Type Validation

Implementations **MUST** validate that:

1. `type` is one of: `'ai_human'`, `'dual_ai'`

Implementations **SHOULD** rate-limit agent creation and execution.

## 10. TypeScript Reference

```typescript
/**
 * Agent conversation type.
 */
type AgentType = 'ai_human' | 'dual_ai';

/**
 * Configuration for one side of an agent conversation.
 */
interface SideConfig<
  Prompt extends string = string,
  Callable extends string = string,
> {
  label?: string;
  prompt: Prompt;
  stopOnResponse?: boolean;
  stopTool?: Callable;
  stopToolResponseProperty?: string;
  maxSteps?: number;
  endSessionTool?: Callable;
}

/**
 * Agent definition configuration.
 */
interface AgentDefinition<
  N extends string = string,
  Prompt extends string = string,
  Callable extends string = string,
> {
  name: N;
  title?: string;
  type?: AgentType;
  maxSessionTurns?: number;
  sideA: SideConfig<Prompt, Callable>;
  sideB?: SideConfig<Prompt, Callable>;
  exposeAsTool?: boolean;
  toolDescription?: string;
  description?: string;
  icon?: string;
  tenvs?: Record<string, unknown>;
}

/**
 * Define an agent configuration.
 */
function defineAgent<N extends string>(
  options: AgentDefinition<N>
): AgentDefinition<N>;
```

## 11. Examples

### 11.1 Basic AI-Human Agent

```typescript
import { defineAgent } from '@standardagents/spec';

export default defineAgent({
  name: 'assistant',
  type: 'ai_human',
  sideA: {
    prompt: 'general_assistant',
    stopOnResponse: true,
  },
});
```

### 11.2 Support Agent with Tools

```typescript
import { defineAgent } from '@standardagents/spec';

export default defineAgent({
  name: 'customer_support',
  type: 'ai_human',
  description: 'Handles customer inquiries and resolves issues',
  sideA: {
    label: 'Support Agent',
    prompt: 'support_prompt',
    stopOnResponse: true,
    endSessionTool: 'close_ticket',
    maxSteps: 50,
  },
  exposeAsTool: true,
  toolDescription: 'Hand off to customer support',
});
```

### 11.3 Dual AI Debate

```typescript
import { defineAgent } from '@standardagents/spec';

export default defineAgent({
  name: 'debate',
  type: 'dual_ai',
  maxSessionTurns: 10,
  sideA: {
    label: 'Pro',
    prompt: 'debate_pro',
    stopOnResponse: true,
  },
  sideB: {
    label: 'Con',
    prompt: 'debate_con',
    stopOnResponse: true,
    endSessionTool: 'conclude_debate',
  },
});
```

### 11.4 Classifier Agent

```typescript
import { defineAgent } from '@standardagents/spec';

export default defineAgent({
  name: 'intent_classifier',
  type: 'ai_human',
  sideA: {
    prompt: 'classifier_prompt',
    stopTool: 'classify',
    stopToolResponseProperty: 'intent',
  },
  exposeAsTool: true,
  toolDescription: 'Classify user intent and route accordingly',
});
```

### 11.5 Research Agent with High Step Limit

```typescript
import { defineAgent } from '@standardagents/spec';

export default defineAgent({
  name: 'researcher',
  type: 'ai_human',
  description: 'Conducts in-depth research on complex topics',
  sideA: {
    label: 'Research Assistant',
    prompt: 'research_prompt',
    stopOnResponse: true,
    maxSteps: 100,
  },
});
```

