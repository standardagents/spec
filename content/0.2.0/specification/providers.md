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
  getModelsPage?(query?: ProviderModelsQuery): Promise<ProviderModelsPage>;
  getModelCapabilities?(modelId: string): Promise<ModelCapabilities | null>;
  getIcon?(modelId?: string): string | undefined;
  inspectRequest?(request: ProviderRequest): Promise<InspectedRequest>;
  getResponseMetadata?(summary: ResponseSummary, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
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
| `getModelsPage` | Optional. Lists available models with pagination/search metadata. |
| `getModelCapabilities` | Optional. Returns capabilities for a specific model. |
| `getIcon` | Optional. Returns icon for the provider or a specific model. |
| `inspectRequest` | Optional. Returns a provider-native preview of a Standard Agents request. |
| `getResponseMetadata` | Optional. Fetches additional metadata after response completes (async). |

### 1.2 Provider Factory

Provider packages export a factory function that creates provider instances:

```typescript
type ProviderFactory = (config: ProviderFactoryConfig) => Provider;

interface ProviderFactoryConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  // Extra HTTP headers sent on every request to the provider backend.
  // HTTP-client provider implementations SHOULD forward these.
  defaultHeaders?: Record<string, string>;
  // Transport override. When present, HTTP-based provider implementations MUST
  // route every request to the provider backend through this `fetch` instead
  // of the global one. The runtime may inject it for mocking, proxying,
  // instrumentation, or any other request routing the host environment needs.
  fetch?: FetchLike;
  [key: string]: unknown;
}

// A `fetch`-compatible transport function.
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
```

> Note: `fetch` is a generic transport override with no knowledge of what the
> transport does. It is how a runtime can, for example, route a provider's
> requests through a custom pipe without the provider package knowing.

### 1.3 Provider Extension Factories

A provider extension is a named provider factory created from a base provider factory. Extensions allow compatible APIs to expose a distinct provider identity, endpoint, credential source, model list, icons, pricing, tools, or request behavior.

A provider extension MUST declare a `baseProvider`. Models that import the base provider and models that import the extension remain separate provider choices.

```typescript
import { defineModel, defineProvider, providerEnv } from '@standardagents/spec';
import { openai } from '@standardagents/openai';

const openaiCompatible = defineProvider({
  name: 'openai_compatible',
  label: 'OpenAI-compatible endpoint',
  baseProvider: openai,
  config: {
    apiKey: providerEnv('EXAMPLE_PROVIDER_API_KEY', {
      valueType: 'secret',
      required: true,
      description: 'API key for the compatible endpoint.',
    }),
    baseUrl: providerEnv('EXAMPLE_PROVIDER_BASE_URL', {
      valueType: 'url',
      default: 'https://api.example.com/v1',
      description: 'OpenAI-compatible API base URL.',
    }),
  },
});

export default defineModel({
  name: 'example_chat',
  provider: openaiCompatible,
  model: 'example-chat',
});
```

#### Config Slots

Base providers declare connection-level configuration slots on the provider factory. These slots are the provider's override locations.

```typescript
openai.configSlots = {
  apiKey: {
    type: 'secret',
    required: true,
    defaultEnv: 'OPENAI_API_KEY',
    overridable: true,
    description: 'OpenAI API key used to authenticate provider requests.',
  },
  baseUrl: {
    type: 'url',
    required: false,
    default: 'https://api.openai.com/v1',
    overridable: true,
    description: 'OpenAI-compatible API base URL.',
  },
  timeout: {
    type: 'number',
    required: false,
    default: 30000,
    overridable: true,
    description: 'Provider request timeout in milliseconds.',
  },
};
```

Provider config is for connection-level values: API keys, base URLs, regions, account IDs, timeouts, and similar values used to construct the provider instance. Per-model request behavior still belongs in `providerOptions` on the model, prompt, or runtime request.

For each slot:

1. If the extension defines `config[slotName]`, that value source supplies the value.
2. If the extension does not define the slot, the base provider slot is resolved from its `defaultEnv` when present.
3. If no environment value is present, the base provider slot `default` is used when present.
4. If a required slot has no value, the implementation reports the slot as a missing provider variable.

Therefore, an OpenAI-compatible extension that only overrides `baseUrl` still uses `OPENAI_API_KEY`. To use its own key, it MUST also override `apiKey` with a value source such as `providerEnv('EXAMPLE_PROVIDER_API_KEY', { valueType: 'secret' })`.

Provider config value sources are:

| Source | Description |
|--------|-------------|
| `providerEnv(name, options)` | Environment variable source with UI/runtime metadata such as `valueType`, `required`, `default`, and `description`. |
| `providerValue(value)` | Supplies a literal value. |
| `providerConst(value)` | Alias for `providerValue(value)`. |
| bare literal | A `string`, `number`, or `boolean` used directly as a constant. |
| nested map | An object whose leaves are themselves config value sources. |

A config slot MAY also be a **nested map** whose leaves are individual value
sources, so one slot can combine environment and constant entries. `defaultHeaders`
uses this form. A leaf that resolves to no value — an unset optional environment
variable — is omitted from the resolved map rather than sent empty.

```typescript
defaultHeaders: {
  'x-account-id': providerEnv('EXAMPLE_ACCOUNT_ID', { valueType: 'secret', required: true }),
  'x-api-beta': 'responses=experimental',                 // constant literal
  'x-optional-key': providerEnv('EXAMPLE_OPTIONAL', { required: false }), // omitted when unset
}
```

#### Method Overrides

Provider extensions can override any provider hook. Each override receives a context object plus `next()`, where `next()` calls the base provider implementation. An override MUST call `next()` to compose with the base provider. If it does not call `next()`, it replaces that behavior.

```typescript
export default defineProvider({
  name: 'openai_compatible',
  label: 'OpenAI-compatible endpoint',
  baseProvider: openai,
  config: {
    apiKey: providerEnv('EXAMPLE_PROVIDER_API_KEY', { valueType: 'secret', required: true }),
    baseUrl: providerEnv('EXAMPLE_PROVIDER_BASE_URL', {
      valueType: 'url',
      default: 'https://api.example.com/v1',
    }),
  },
  overrides: {
    getIcon({ modelId }, next) {
      if (modelId?.startsWith('example-')) return '/icons/example-provider.svg';
      return next();
    },
    async getModels({ config, filter }) {
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      const models = await response.json();
      return filter ? models.data.filter((model) => model.id.includes(filter)) : models.data;
    },
  },
});
```

The override context always includes:

| Field | Description |
|-------|-------------|
| `providerName` | The extension provider name. |
| `config` | The resolved config passed to the base provider factory. |
| `baseProvider` | The provider instance created by `baseProvider(config)`. |

Overrideable methods are `generate`, `stream`, `supportsModel`, `getModels`, `getModelsPage`, `getModelCapabilities`, `getTools`, `getIcon`, `inspectRequest`, and `getResponseMetadata`.

`supportsModel` and `getIcon` are synchronous. Implementations SHOULD use `getModels` or `getModelsPage` for asynchronous model discovery.

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
type ErrorOrigin =
  | `provider:${string}`
  | 'platform-router'
  | 'runtime'
  | `tool:${string}`
  | `hook:${string}`;

class ProviderError extends Error {
  constructor(
    message: string,
    public code: 'rate_limit' | 'invalid_request' | 'auth_error' | 'server_error' | 'timeout' | 'unknown',
    public statusCode?: number,
    public retryAfter?: number,
    options?: {
      cause?: unknown;
      origin?: ErrorOrigin;
      upstream?: string;
    }
  ) {
    super(message);
  }
}
```

Provider packages SHOULD set `origin: 'provider:<id>'` when they rethrow an
upstream failure. Wrapped or delegated endpoints SHOULD also set `upstream` to
the backend that actually handled the request. Runtimes use these fields for
logs and operator interfaces; attribution MUST NOT require parsing the human
error message. When a provider omits them, the runtime MAY attribute the known
request boundary (direct provider or hosted router).

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

See the [Tools specification](/0.2.0/specification/tools) for details on variable declarations and runtime resolution.

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
  getModelsPage?(query?: ProviderModelsQuery): Promise<ProviderModelsPage>;
  getModelCapabilities?(modelId: string): Promise<ModelCapabilities | null>;
  getIcon?(modelId?: string): string | undefined;
  inspectRequest?(request: ProviderRequest): Promise<InspectedRequest>;
  getResponseMetadata?(summary: ResponseSummary, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
}

// Response metadata summary (for async metadata fetching)
interface ResponseSummary {
  responseId?: string;
  model: string;
  finishReason: ProviderFinishReason;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// Factory types
type ProviderFactory = ProviderFactoryWithOptions;

interface ProviderFactoryWithOptions<TOptions = unknown> {
  (config: ProviderFactoryConfig): Provider;
  providerOptions?: TOptions;
  configSlots?: ProviderConfigSlots;
  providerDefinition?: ProviderDefinition;
}

interface ProviderFactoryConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  [key: string]: unknown;
}

type ProviderConfigSlots = Record<string, ProviderConfigSlot>;
type ProviderConfigValueType = 'text' | 'secret' | 'url' | 'number' | 'boolean';

interface ProviderConfigSlot<T = unknown> {
  type: ProviderConfigValueType;
  required?: boolean;
  default?: T;
  defaultEnv?: string;
  overridable?: boolean;
  description?: string;
}

type ProviderConfigValueSource<T = unknown> =
  | { type: 'const'; value: T }
  | {
      type: 'env';
      name: string;
      valueType?: ProviderConfigValueType;
      required?: boolean;
      default?: T;
      description?: string;
    };

function providerEnv<T = string>(
  name: string,
  options?: Omit<Extract<ProviderConfigValueSource<T>, { type: 'env' }>, 'type' | 'name'>
): ProviderConfigValueSource<T>;

function providerValue<T>(value: T): ProviderConfigValueSource<T>;
const providerConst: typeof providerValue;

function defineProvider<N extends string, Base extends ProviderFactoryWithOptions>(
  definition: ProviderDefinition<N, Base>
): ProviderFactoryWithOptions;

interface ProviderDefinition<
  N extends string = string,
  Base extends ProviderFactoryWithOptions = ProviderFactoryWithOptions
> {
  name: N;
  label?: string;
  baseProvider: Base;
  config?: Partial<Record<keyof ProviderFactoryConfig | string, ProviderConfigValueSource>>;
  overrides?: ProviderMethodOverrides;
}

interface ProviderOverrideContext {
  providerName: string;
  config: ProviderFactoryConfig;
  baseProvider: Provider;
}

type MaybePromise<T> = T | Promise<T>;

type ProviderOverride<Context, Result> = (
  context: ProviderOverrideContext & Context,
  next: () => MaybePromise<Result>
) => MaybePromise<Result>;

type ProviderSyncOverride<Context, Result> = (
  context: ProviderOverrideContext & Context,
  next: () => Result
) => Result;

interface ProviderMethodOverrides {
  generate?: ProviderOverride<{ request: ProviderRequest }, ProviderResponse>;
  stream?: ProviderOverride<{ request: ProviderRequest }, AsyncIterable<ProviderStreamChunk>>;
  supportsModel?: ProviderSyncOverride<{ modelId: string }, boolean>;
  getModels?: ProviderOverride<{ filter?: string }, ProviderModelInfo[]>;
  getModelsPage?: ProviderOverride<{ query?: ProviderModelsQuery }, ProviderModelsPage>;
  getModelCapabilities?: ProviderOverride<{ modelId: string }, ModelCapabilities | null>;
  getTools?: ProviderOverride<{ modelId?: string }, Record<string, ToolDefinition>>;
  getIcon?: ProviderSyncOverride<{ modelId?: string }, string | undefined>;
  inspectRequest?: ProviderOverride<{ request: ProviderRequest }, InspectedRequest>;
  getResponseMetadata?: ProviderOverride<{
    summary: ResponseSummary;
    signal?: AbortSignal;
  }, Record<string, unknown> | null>;
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
  /** The actual provider that fulfilled the request (e.g. 'google', 'anthropic') */
  provider?: string;
  /** Per-million-token USD unit prices the provider reported for this request's model */
  pricing?: ProviderUsagePricing;
}

interface ProviderUsagePricing {
  inputPerMillion?: number;
  cachedInputPerMillion?: number;
  outputPerMillion?: number;
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
type ErrorOrigin =
  | `provider:${string}`
  | 'platform-router'
  | 'runtime'
  | `tool:${string}`
  | `hook:${string}`;

class ProviderError extends Error {
  code: 'rate_limit' | 'invalid_request' | 'auth_error' | 'server_error' | 'timeout' | 'unknown';
  statusCode?: number;
  retryAfter?: number;
  origin?: ErrorOrigin;
  upstream?: string;
}
```
