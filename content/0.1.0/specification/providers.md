# Providers

A provider is the bridge between Standard Agents and an LLM API. Providers translate Standard Agent requests into provider-native formats and transform responses back into Standard Agent format.

## 1. Provider Interface

```typescript
interface Provider {
  readonly name: string;
  readonly specificationVersion: '1';

  generate(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): Promise<AsyncIterable<ProviderStreamChunk>>;
  supportsModel?(modelId: string): boolean;
  getTools?(modelId?: string): Record<string, ToolDefinition>;
  getModels?(filter?: string): Promise<ProviderModelInfo[]>;
  getModelCapabilities?(modelId: string): Promise<ModelCapabilities | null>;
  getIcon?(modelId?: string): string | undefined;
}
```

### 1.1 Methods

| Method | Description |
|--------|-------------|
| `generate` | Non-streaming generation. Returns complete response. |
| `stream` | Streaming generation. Returns async iterable of chunks. |
| `supportsModel` | Optional. Returns true if provider can handle the model. |
| `getTools` | Optional. Returns provider-embedded tools available for the model. |
| `getModels` | Optional. Lists available models from the provider. |
| `getModelCapabilities` | Optional. Returns capabilities for a specific model. |
| `getIcon` | Optional. Returns icon for the provider or a specific model. |
| `getResponseMetadata` | Optional. Fetches additional metadata after response completes (async). |

### 1.2 Provider Factory

Provider packages export a factory function that creates provider instances:

```typescript
type ProviderFactory = (config: ProviderConfig) => Provider;

interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}
```

## 2. Request Format

```typescript
interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  tools?: ProviderTool[];
  toolChoice?: 'auto' | 'none' | 'required' | { name: string };
  parallelToolCalls?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  reasoning?: {
    level?: number;       // 0-100 scale
    maxTokens?: number;
    exclude?: boolean;
  };
  responseFormat?: { type: 'text' } | { type: 'json'; schema?: JSONSchema };
  signal?: AbortSignal;
  providerOptions?: Record<string, unknown>;
}
```

### 2.1 Provider Options

The `providerOptions` field allows provider-specific options not covered by the standard interface. Options are merged in order (later wins):

1. `model.providerOptions` - Defaults for the model
2. `prompt.providerOptions` - Overrides for the prompt
3. `request.providerOptions` - Runtime overrides

### 2.2 Reasoning Levels

Reasoning is specified as a 0-100 numeric scale. Models declare their supported levels in `capabilities.reasoningLevels`, which maps numeric values to the model's native reasoning strings.

| Value | Typical Meaning |
|-------|-----------------|
| 0 | No reasoning |
| 33 | Low effort |
| 66 | Medium effort |
| 100 | Maximum effort |

## 3. Message Format

```typescript
type ProviderMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

interface SystemMessage {
  role: 'system';
  content: string;
}

interface UserMessage {
  role: 'user';
  content: MessageContent;
}

interface AssistantMessage {
  role: 'assistant';
  content?: string | null;
  reasoning?: string | null;
  reasoningDetails?: ReasoningDetail[];
  toolCalls?: ToolCallPart[];
}

interface ToolMessage {
  role: 'tool';
  toolCallId: string;
  toolName: string;
  content: ToolResultContent;
}
```

### 3.1 Content Types

```typescript
type MessageContent = string | ContentPart[];

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mediaType: string; detail?: 'auto' | 'low' | 'high' }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'file'; data: string; mediaType: string; filename?: string };
```

The `image_url` type is used for passing image URLs directly to providers (OpenAI/OpenRouter format). The `url` can be a data URI (`data:image/...`) or an HTTP(S) URL.

### 3.2 Tool Calls

```typescript
interface ToolCallPart {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

type ToolResultContent =
  | string
  | { type: 'text'; text: string }
  | { type: 'error'; error: string }
  | ContentPart[];
```

## 4. Tool Definitions

```typescript
interface ProviderTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: JSONSchema;
  };
}
```

## 5. Response Format

```typescript
interface ProviderResponse {
  content: string | null;
  reasoning?: string | null;
  reasoningDetails?: ReasoningDetail[];
  toolCalls?: ToolCallPart[];
  images?: GeneratedImage[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
    cachedTokens?: number;
    cost?: number;
  };
  metadata?: {
    model?: string;
    provider?: string;
    requestId?: string;
    [key: string]: unknown;
  };
}

interface GeneratedImage {
  data: string;
  mediaType: string;
  revisedPrompt?: string;
}
```

## 6. Streaming

```typescript
type ProviderStreamChunk =
  | { type: 'content-delta'; delta: string }
  | { type: 'content-done' }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'reasoning-done' }
  | { type: 'tool-call-start'; id: string; name: string }
  | { type: 'tool-call-delta'; id: string; argumentsDelta: string }
  | { type: 'tool-call-done'; id: string; arguments: Record<string, unknown> }
  | { type: 'image-delta'; index: number; data: string }
  | { type: 'image-done'; index: number; image: GeneratedImage }
  | { type: 'finish'; finishReason: ProviderResponse['finishReason']; usage: ProviderResponse['usage'] }
  | { type: 'error'; error: string; code?: string };
```

## 7. Error Handling

Providers throw typed errors for error conditions.

```typescript
class ProviderError extends Error {
  constructor(
    message: string,
    public code: 'rate_limit' | 'invalid_request' | 'auth_error' | 'server_error' | 'timeout' | 'unknown',
    public statusCode?: number,
    public retryAfter?: number
  ) {
    super(message);
  }
}
```

### 7.1 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `rate_limit` | Rate limit exceeded (429) | Yes |
| `server_error` | Provider server error (5xx) | Yes |
| `timeout` | Request timed out | Yes |
| `auth_error` | Authentication failed (401/403) | No |
| `invalid_request` | Bad request (400) | No |
| `unknown` | Unknown error | No |

## 8. Provider Icons

### 8.1 getIcon Method

The optional `getIcon` method returns an icon for the provider or a specific model:

```typescript
getIcon(modelId?: string): string | undefined;
```

**Behavior:**
- When `modelId` is omitted, returns the provider's default icon
- When `modelId` is provided, returns an icon for that model (useful for aggregators)
- Returns `undefined` if no icon is available

**Return Format:**

The preferred return format is an **SVG data URI**:

```
data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22...
```

This format allows icons to be embedded directly in UI elements without additional network requests:

```html
<img src={provider.getIcon()} alt="Provider icon" />
```

### 8.2 Implementation Example

**Direct provider (e.g., OpenAI):**

```typescript
class OpenAIProvider implements Provider {
  getIcon(_modelId?: string): string {
    // Always return OpenAI icon - all models are from OpenAI
    return svgToDataUri(OPENAI_ICON_SVG);
  }
}
```

**Aggregator provider (e.g., OpenRouter):**

```typescript
class OpenRouterProvider implements Provider {
  getIcon(modelId?: string): string | undefined {
    if (modelId) {
      // Extract lab from model ID: "anthropic/claude-3-opus" -> "anthropic"
      const lab = modelId.split('/')[0];
      return getLabIconDataUri(lab);
    }
    // Default to OpenRouter's own icon
    return svgToDataUri(OPENROUTER_ICON_SVG);
  }
}
```

### 8.3 Helper Function

Provider packages typically include a helper to convert SVG to data URI:

```typescript
function svgToDataUri(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}
```

## 9. Response Metadata (Async)

### 9.1 Overview

Some providers (like aggregators) may not have complete metadata immediately when a response finishes. The optional `getResponseMetadata` method allows fetching additional metadata asynchronously without blocking the main execution flow.

### 9.2 getResponseMetadata Method

```typescript
getResponseMetadata?(
  summary: ResponseSummary,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null>;
```

**Parameters:**
- `summary`: Stripped-down response info (no content/attachments to avoid passing large data)
- `signal`: Optional abort signal for cancellation

**Returns:** Additional metadata or `null` if unavailable

### 9.3 ResponseSummary Structure

```typescript
interface ResponseSummary {
  /** Provider-specific response/generation ID */
  responseId?: string;
  /** Model that handled the request */
  model: string;
  /** How the response ended */
  finishReason: ProviderFinishReason;
  /** Token usage (without detailed breakdowns) */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

### 9.4 Use Cases

| Use Case | Description |
|----------|-------------|
| Aggregator provider info | Fetch actual provider from aggregators like OpenRouter |
| Accurate cost data | Get precise cost information from provider APIs |
| Token reconciliation | Retrieve native token counts that may differ from streaming counts |
| Generation metadata | Access provider-specific generation details (latency, etc.) |

### 9.5 Implementation Notes

- This method is called **after** the response completes.
- Runtimes **MUST** invoke it asynchronously and **MUST NOT** block the flow on it.
- The flow engine waits for all pending metadata promises before completing.
- Results update log records with provider-reported metadata.

### 9.6 Example Implementation

```typescript
class OpenRouterProvider implements Provider {
  async getResponseMetadata(
    summary: ResponseSummary,
    signal?: AbortSignal
  ): Promise<Record<string, unknown> | null> {
    if (!summary.responseId) {
      return null;
    }

    const metadata = await fetchGenerationMetadata(
      this.apiKey,
      summary.responseId,
      signal
    );

    if (!metadata) return null;

    return {
      actual_provider: metadata.providerName,
      native_tokens_prompt: metadata.nativePromptTokens,
      native_tokens_completion: metadata.nativeCompletionTokens,
      generation_cost: metadata.totalCost,
    };
  }
}
```

## 10. Provider Tools

### 10.1 Overview

Providers can embed built-in tools that leverage provider-specific capabilities. For example, OpenAI provides web search, file search, code interpreter, and image generation tools that execute server-side.

### 10.2 getTools Method

The optional `getTools` method returns tools available for a given model:

```typescript
getTools(modelId?: string): Record<string, ToolDefinition>
```

**Behavior:**
- When `modelId` is omitted, returns all tools the provider supports
- When `modelId` is provided, returns only tools available for that model
- Returns an empty object if no tools are available

### 10.3 Tool Definitions with Variables

Provider tools use `defineTool()` with an optional `variables` property for thread variable requirements:

```typescript
defineTool({
  description: 'Search through uploaded files using vector embeddings',
  args: z.object({ query: z.string() }),
  execute: async (state, args) => ({ status: 'success', result: 'Handled by provider' }),
  variables: [
    {
      name: 'VECTOR_STORE_ID',
      type: 'text',
      required: true,
      description: 'Vector store to search',
    },
  ],
});
```

Variable requirements are declared per field:
- **Required variables**: `required: true`
- **Optional variables**: set `required: false`

See the [Tools specification](/0.1.0/specification/tools) for details on variable declarations and runtime resolution.

### 10.4 Model-Specific Tools

Different models may support different subsets of provider tools:

| Model | Available Tools |
|-------|-----------------|
| gpt-4o | web_search, file_search, code_interpreter, image_generation |
| gpt-4o-mini | web_search, file_search, code_interpreter |
| o1 | web_search, code_interpreter |

Implementations **SHOULD** use `getTools(modelId)` to determine which tools are available.

## 11. TypeScript Reference

```typescript
// Provider interface
interface Provider {
  readonly name: string;
  readonly specificationVersion: '1';
  generate(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): Promise<AsyncIterable<ProviderStreamChunk>>;
  supportsModel?(modelId: string): boolean;
  getTools?(modelId?: string): Record<string, ToolDefinition>;
  getModels?(filter?: string): Promise<ProviderModelInfo[]>;
  getModelCapabilities?(modelId: string): Promise<ModelCapabilities | null>;
  getIcon?(modelId?: string): string | undefined;
  getResponseMetadata?(summary: ResponseSummary, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
}

// Response metadata summary (for async metadata fetching)
interface ResponseSummary {
  responseId?: string;
  model: string;
  finishReason: ProviderFinishReason;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// Factory type
type ProviderFactory = (config: ProviderConfig) => Provider;

interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

// Request
interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  tools?: ProviderTool[];
  toolChoice?: 'auto' | 'none' | 'required' | { name: string };
  parallelToolCalls?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  reasoning?: { level?: number; maxTokens?: number; exclude?: boolean };
  responseFormat?: { type: 'text' } | { type: 'json'; schema?: JSONSchema };
  signal?: AbortSignal;
  providerOptions?: Record<string, unknown>;
}

// Response
interface ProviderResponse {
  content: string | null;
  reasoning?: string | null;
  reasoningDetails?: ReasoningDetail[];
  toolCalls?: ToolCallPart[];
  images?: GeneratedImage[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  usage: ProviderUsage;
  metadata?: Record<string, unknown>;
}

interface ProviderUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  cost?: number;
}

// Messages
type ProviderMessage = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

interface SystemMessage { role: 'system'; content: string; }
interface UserMessage { role: 'user'; content: MessageContent; }
interface AssistantMessage {
  role: 'assistant';
  content?: string | null;
  reasoning?: string | null;
  reasoningDetails?: ReasoningDetail[];
  toolCalls?: ToolCallPart[];
}
interface ToolMessage {
  role: 'tool';
  toolCallId: string;
  toolName: string;
  content: ToolResultContent;
}

// Content
type MessageContent = string | ContentPart[];
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mediaType: string; detail?: 'auto' | 'low' | 'high' }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'file'; data: string; mediaType: string; filename?: string };

// Tools
interface ProviderTool {
  type: 'function';
  function: { name: string; description: string; parameters?: JSONSchema };
}

interface ToolCallPart {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

type ToolResultContent = string | { type: 'text'; text: string } | { type: 'error'; error: string } | ContentPart[];

// Streaming
type ProviderStreamChunk =
  | { type: 'content-delta'; delta: string }
  | { type: 'content-done' }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'reasoning-done' }
  | { type: 'tool-call-start'; id: string; name: string }
  | { type: 'tool-call-delta'; id: string; argumentsDelta: string }
  | { type: 'tool-call-done'; id: string; arguments: Record<string, unknown> }
  | { type: 'image-delta'; index: number; data: string }
  | { type: 'image-done'; index: number; image: GeneratedImage }
  | { type: 'finish'; finishReason: ProviderResponse['finishReason']; usage: ProviderUsage }
  | { type: 'error'; error: string; code?: string };

// Errors
class ProviderError extends Error {
  code: 'rate_limit' | 'invalid_request' | 'auth_error' | 'server_error' | 'timeout' | 'unknown';
  statusCode?: number;
  retryAfter?: number;
}
```
