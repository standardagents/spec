# Prompts

[TK]

## 1. Prompt Definition

A prompt defines how each request to an LLM is crafted. Each prompt specifies system instructions, a model reference, and optional configuration for tools, input validation, and response behavior.

### 1.1 Required Properties

A prompt definition **MUST** include the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique identifier for this prompt |
| `toolDescription` | `string` | Description shown when prompt is exposed as a tool |
| `prompt` | `PromptContent` | System prompt content (string or structured) |
| `model` | `string` | Model reference to use for this prompt |

### 1.2 Optional Properties

A prompt definition **MAY** include the following properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `includeChat` | `boolean` | `false` | Include full chat history |
| `includePastTools` | `boolean` | `false` | Include past tool results |
| `parallelToolCalls` | `boolean` | `false` | Allow parallel tool execution |
| `toolChoice` | `'auto' \| 'none' \| 'required'` | `'auto'` | Tool calling strategy |
| `requiredSchema` | `ZodSchema` | - | Input validation schema |
| `tools` | `(string \| ToolConfig)[]` | - | Available tools (include `ai_human` agent names for handoffs) |
| `reasoning` | `ReasoningConfig` | - | Extended thinking config |
| `recentImageThreshold` | `number` | `10` | Messages to keep images |
| `hooks` | `string[]` | - | Hook IDs to run for this prompt |

## 2. Prompt Content

### 2.1 String Prompts

The simplest form is a plain string containing the system instructions:

```typescript
prompt: 'You are a helpful assistant. Be concise and accurate.'
```

System prompts **SHOULD NOT** contain secrets or sensitive credentials. Implementations **SHOULD** sanitize prompt content to prevent injection.

### 2.2 Structured Prompts

For composition and reuse, prompts can be structured arrays of parts:

```typescript
prompt: [
  { type: 'text', content: 'You are a helpful assistant.\n\n' },
  { type: 'include', prompt: 'common_rules' },
  { type: 'text', content: '\n\nBe concise.' },
]
```

### 2.3 Prompt Parts

#### 2.3.1 Text Parts

Text parts contain static content:

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'text'` | Discriminator |
| `content` | `string` | Text content |

#### 2.3.2 Include Parts

Include parts reference other prompts:

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'include'` | Discriminator |
| `prompt` | `string` | Name of prompt to include |

### 2.4 Include Resolution

When a prompt includes another prompt:

1. Implementations **MUST** recursively resolve all includes
2. Implementations **MUST** detect and reject circular includes
3. The included prompt's content is inserted at the include location
4. Only the `prompt` field is included (not tools, model, etc.)

## 3. Tool Configuration

### 3.1 Simple Tool References

Tools can be referenced by name:

```typescript
tools: ['search_docs', 'create_ticket', 'send_email']
```

### 3.2 Tool Configuration with Tenvs

Tools can be configured with thread environment variable (tenv) values. This allows prompts to provide default or required values for tools that need runtime configuration:

```typescript
tools: [
  'search_docs',  // Simple reference
  {
    name: 'file_search',  // Tool with tenv configuration
    tenvs: {
      vectorStoreId: 'vs_abc123',  // Required by file_search
    },
  },
]
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Name of the tool |
| `tenvs` | `Record<string, unknown>` | Thread environment variable values for this tool |
| `options` | `Record<string, unknown>` | Static tool options |

Tenv values set in prompts serve as defaults. They can be overridden by agent-level tenvs or thread-level tenvs at creation time. See the [Tools specification](/specification/tools#9-thread-environment-variables-tenvs) for details on tenv merging.

### 3.3 Sub-Prompt Tool Configuration

When a prompt is used as a tool by another prompt, the caller can configure how results are returned. These options **only apply to sub-prompts**, not to regular function tools.

Since sub-prompts return their results as tool call responses, all output must be serialized into a single text string. The configuration options control what gets included in that string.

```typescript
tools: [
  'search_docs',  // Simple reference (function tool)
  {
    name: 'summarize_document',  // Sub-prompt with configuration
    includeTextResponse: true,
    includeToolCalls: false,
    includeErrors: true,
    initUserMessageProperty: 'document',
  },
  {
    name: 'analyze_image',  // Sub-prompt with attachment configuration
    initUserMessageProperty: 'question',
    initAttachmentsProperty: 'image_path',
  },
  {
    name: 'support_handoff',  // Agent (ai_human) with initial message
    initUserMessageProperty: 'customer_query',
  },
]
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | Required | Name of the sub-prompt or agent to call |
| `includeTextResponse` | `boolean` | `true` | Include the sub-prompt's text response in the result string |
| `includeToolCalls` | `boolean` | `true` | Serialize tool calls made by the sub-prompt (and their results) into the result string |
| `includeErrors` | `boolean` | `true` | Serialize any errors from the sub-prompt into the result string |
| `initUserMessageProperty` | `string` | - | Use this argument property as the initial user message when invoking the sub-prompt or agent |
| `initAttachmentsProperty` | `string` | - | Use this argument property (file path or array of paths) as attachments in the initial user message |

The `initUserMessageProperty` is useful when the sub-prompt expects conversational input. For example, if `initUserMessageProperty: 'query'` is set and the caller passes `{ query: 'What is X?' }`, the sub-prompt receives "What is X?" as its initial user message.

The `initAttachmentsProperty` allows passing file attachments (images, documents) to the sub-prompt. The property value should be a file path string or an array of paths. For example, if `initAttachmentsProperty: 'image'` is set and the caller passes `{ image: '/attachments/photo.jpg' }`, the sub-prompt receives the image as an attachment.

> **💡 Tip:** Combine `initUserMessageProperty` with `includeChat: false` on the sub-prompt. The sub-prompt will only receive its own system prompt and the initial user message—allowing it to operate on a smaller, focused context with reduced token usage.

## 4. Tool Choice Strategy

### 4.1 Strategy Values

The `toolChoice` property controls how the LLM calls tools:

| Value | Behavior |
|-------|----------|
| `'auto'` | Model decides when to call tools (default) |
| `'none'` | Disable tool calling entirely |
| `'required'` | Force the model to call at least one tool |

### 4.2 Tool Choice Behavior

When `toolChoice` is `'required'`:
- The LLM **MUST** include at least one tool call in its response
- Implementations **SHOULD** retry if the LLM fails to call a tool

When `toolChoice` is `'none'`:
- Tool definitions are not sent to the LLM
- The `tools` array is ignored for that request

## 5. Input Validation

### 5.1 Required Schema

The `requiredSchema` property defines inputs when the prompt is called as a tool:

```typescript
requiredSchema: z.object({
  query: z.string().describe('Search query'),
  limit: z.number().optional().default(10).describe('Max results'),
})
```

### 5.2 Schema Usage

When a required schema is provided:

1. Implementations **MUST** validate inputs against the schema
2. Implementations **MUST** generate JSON Schema for LLM tool definitions
3. Field descriptions from `.describe()` **SHOULD** be included

User inputs **MUST** be validated before inclusion in prompts.

> **💡 Tip:** TypeScript implementations can use the `PromptInput<T>` helper type to extract the inferred input type from a prompt's schema: `type SearchInput = PromptInput<typeof searchPrompt>`.

## 6. Reasoning Configuration

### 6.1 Reasoning Properties

For models with extended thinking capabilities:

| Property | Type | Description |
|----------|------|-------------|
| `effort` | `'low' \| 'medium' \| 'high'` | Reasoning effort level |
| `maxTokens` | `number` | Max tokens for reasoning |
| `exclude` | `boolean` | Exclude reasoning from response |
| `include` | `boolean` | Include reasoning in history |

### 6.2 Effort Levels

| Level | Behavior |
|-------|----------|
| `'low'` | Minimal reasoning, faster responses |
| `'medium'` | Balanced reasoning and speed |
| `'high'` | Maximum reasoning, slower but thorough |

### 6.3 Reasoning Visibility

- When `exclude` is `true`, reasoning is used internally but not returned
- When `include` is `true`, reasoning is preserved in message history
- These can be combined for different use cases

## 7. Image Context Management

The `recentImageThreshold` property controls how images are handled in conversation context:

- Images in the most recent N messages are kept as full image content
- Older images are replaced with text descriptions
- Helps manage context window usage in long conversations

## 8. Hook Scoping

The `hooks` property declares which hooks run when this prompt is active. Hook IDs reference hooks defined in `agents/hooks/` using `defineHook()`.

```typescript
definePrompt({
  name: 'customer_support',
  // ...
  hooks: ['limit_to_20_messages', 'log_tool_calls', 'redact_credit_cards'],
});
```

**Behavior:**

- When `hooks` is specified, **only** those hooks run for this prompt
- When `hooks` is omitted, the runtime falls back to agent-level hooks
- Hook IDs reference the `id` property from `defineHook({ hook, id, execute })`
- See the [Hooks specification](/specification/hooks) for hook definition details

This allows different prompts within the same agent to use different hooks. For example, a classifier prompt might skip message filtering hooks while a support prompt includes them.

## 9. Validation

### 8.1 Required Field Validation

Implementations **MUST** validate that:

1. `name` is a non-empty string
2. `toolDescription` is a non-empty string
3. `model` references a defined model
4. `prompt` is either a string or valid structured array

### 8.2 Optional Field Validation

Implementations **MUST** validate that:

1. `toolChoice` is one of: `'auto'`, `'none'`, `'required'`
2. `reasoning.effort` is one of: `'low'`, `'medium'`, `'high'`
3. `recentImageThreshold` is a positive integer

## 10. TypeScript Reference

```typescript
/**
 * Text part of a structured prompt.
 */
interface PromptTextPart {
  type: 'text';
  content: string;
}

/**
 * Include part referencing another prompt.
 */
interface PromptIncludePart {
  type: 'include';
  prompt: string;
}

/**
 * Union of prompt part types.
 */
type PromptPart = PromptTextPart | PromptIncludePart;

/**
 * Structured prompt array.
 */
type StructuredPrompt = PromptPart[];

/**
 * Prompt content (string or structured).
 */
type PromptContent = string | StructuredPrompt;

/**
 * Configuration for tools with tenv values.
 */
interface ToolConfig<T extends string = string> {
  name: T;
  tenvs?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

/**
 * Configuration for sub-prompts or agents used as tools.
 * These options control how results are returned and how initial messages are constructed.
 */
interface SubpromptConfig<T extends string = string> {
  name: T;
  includeTextResponse?: boolean;
  includeToolCalls?: boolean;
  includeErrors?: boolean;
  initUserMessageProperty?: string;
  initAttachmentsProperty?: string;
}

/**
 * Reasoning configuration.
 */
interface ReasoningConfig {
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  exclude?: boolean;
  include?: boolean;
}

/**
 * Prompt definition configuration.
 */
interface PromptDefinition<
  N extends string = string,
  S extends ToolArgs = ToolArgs,
> {
  name: N;
  toolDescription: string;
  prompt: PromptContent;
  model: string;
  includeChat?: boolean;
  includePastTools?: boolean;
  parallelToolCalls?: boolean;
  toolChoice?: 'auto' | 'none' | 'required';
  requiredSchema?: S;
  tools?: (string | ToolConfig | SubpromptConfig)[];
  tenvs?: Record<string, unknown>;
  reasoning?: ReasoningConfig;
  recentImageThreshold?: number;
  hooks?: string[];
}

/**
 * Helper type for input inference.
 */
type PromptInput<T extends PromptDefinition> =
  T['requiredSchema'] extends ToolArgs
    ? z.infer<T['requiredSchema']>
    : never;

/**
 * Define a prompt configuration.
 */
function definePrompt<N extends string, S extends ToolArgs = never>(
  options: PromptDefinition<N, S>
): PromptDefinition<N, S>;
```

## 11. Examples

### 11.1 Basic Prompt

```typescript
import { definePrompt } from '@standardagents/spec';

export default definePrompt({
  name: 'assistant',
  toolDescription: 'General purpose assistant',
  model: 'conversational',
  prompt: 'You are a helpful assistant. Be concise and accurate.',
});
```

### 11.2 Prompt with Tools

```typescript
import { definePrompt } from '@standardagents/spec';
import { z } from 'zod';

export default definePrompt({
  name: 'customer_support',
  toolDescription: 'Handle customer support inquiries',
  model: 'conversational',
  prompt: `You are a customer support agent.
    Always be polite and try to resolve issues quickly.
    If you cannot help, offer to escalate.`,
  tools: ['search_knowledge_base', 'create_ticket'],
  includeChat: true,
  requiredSchema: z.object({
    query: z.string().describe('The customer inquiry'),
  }),
});
```

### 11.3 Structured Prompt with Includes

```typescript
import { definePrompt } from '@standardagents/spec';

export default definePrompt({
  name: 'sales_agent',
  toolDescription: 'Handle sales inquiries',
  model: 'conversational',
  prompt: [
    { type: 'text', content: 'You are a sales representative.\n\n' },
    { type: 'include', prompt: 'company_info' },
    { type: 'include', prompt: 'product_catalog' },
    { type: 'text', content: '\n\nBe helpful and persuasive.' },
  ],
  tools: ['get_pricing', 'schedule_demo'],
});
```

### 11.4 Prompt with Reasoning

```typescript
import { definePrompt } from '@standardagents/spec';

export default definePrompt({
  name: 'code_reviewer',
  toolDescription: 'Review code for issues and improvements',
  model: 'heavy',
  prompt: 'You are an expert code reviewer. Analyze code thoroughly.',
  reasoning: {
    effort: 'high',
    maxTokens: 4096,
    exclude: false,
  },
});
```

### 11.5 Prompt with Hooks

```typescript
import { definePrompt } from '@standardagents/spec';

export default definePrompt({
  name: 'customer_support',
  toolDescription: 'Handle customer support inquiries',
  model: 'conversational',
  prompt: 'You are a customer support agent. Be helpful and concise.',
  tools: ['search_knowledge_base', 'create_ticket'],
  includeChat: true,
  hooks: ['limit_to_20_messages', 'log_tool_calls', 'redact_credit_cards'],
});
```
