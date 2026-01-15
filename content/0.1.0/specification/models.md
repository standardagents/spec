# Models

A model definition specifies which Large Language Model (LLM) to use for inference and how to connect to it. Models are referenced by name from prompt definitions and serve as the foundation of the agent system.

## 1. Model Definition

### 1.1 Required Properties

A model definition **MUST** include the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique identifier for this model. Used when referencing from prompts. |
| `provider` | `ProviderFactory` | Factory function that creates a provider instance. |
| `model` | `string` | The model identifier sent to the provider API. |

### 1.2 Optional Properties

A model definition **MAY** include the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `fallbacks` | `string[]` | Names of fallback models to try if this model fails. |
| `includedProviders` | `string[]` | Provider routing preferences for multi-provider gateways. |
| `inputPrice` | `number` | Cost per 1 million input tokens in USD. |
| `outputPrice` | `number` | Cost per 1 million output tokens in USD. |
| `cachedPrice` | `number` | Cost per 1 million cached input tokens in USD. |
| `capabilities` | `ModelCapabilities` | Feature support and limits for this model. |
| `providerOptions` | `Record<string, unknown>` | Provider-specific default options for this model. |
| `providerTools` | `string[]` | Provider-embedded tools available for this model. |

## 2. Provider Reference

The `provider` property accepts a provider factory function imported from a provider package. See the [Providers](/0.1.0/specification/providers) specification for the provider interface.

## 3. Fallback Chains

### 3.1 Fallback Behavior

When a model definition includes `fallbacks`, implementations **SHOULD**:

1. Attempt the primary model first
2. If the primary model fails after exhausting retries, try each fallback in order
3. Continue until a model succeeds or all fallbacks are exhausted

### 3.2 Fallback References

Fallback model names **MUST** reference other defined models by their `name` property. Implementations **SHOULD** validate that all referenced fallback models exist at startup.

## 4. Pricing Configuration

### 4.1 Token Pricing

Pricing properties are used for cost tracking and reporting. All prices are expressed in USD per 1 million tokens.

| Property | Description |
|----------|-------------|
| `inputPrice` | Cost for input/prompt tokens |
| `outputPrice` | Cost for output/completion tokens |
| `cachedPrice` | Cost for cached input tokens (when provider supports caching) |

### 4.2 Pricing Priority

Pricing configuration is optional. Providers MAY return pricing information per-request (e.g., in response headers or metadata). When provider pricing is available:

- Provider-reported pricing **SHOULD** take priority over static model configuration
- Static pricing serves as a fallback when provider pricing is unavailable
- Pricing information **SHOULD NOT** be exposed to end users without appropriate access controls

## 5. Capabilities

### 5.1 Capability Properties

The `capabilities` object describes features and limits for the model:

| Property | Type | Description |
|----------|------|-------------|
| `reasoningLevels` | `Record<number, string \| null>` | Maps 0-100 scale to model's native reasoning values. |
| `supportsImages` | `boolean` | Whether the model accepts image inputs. |
| `supportsToolCalls` | `boolean` | Whether the model supports tool/function calling. |
| `supportsStreaming` | `boolean` | Whether the model supports streaming responses. |
| `supportsJsonMode` | `boolean` | Whether the model supports JSON response format. |
| `maxContextTokens` | `number` | Maximum input context window size. |
| `maxOutputTokens` | `number` | Maximum output tokens per response. |

### 5.2 Reasoning Levels

The `reasoningLevels` property maps the 0-100 reasoning scale to model-specific values:

```typescript
// OpenAI o-series models
reasoningLevels: { 0: null, 33: 'low', 66: 'medium', 100: 'high' }

// Binary reasoning (on/off)
reasoningLevels: { 0: null, 100: 'enabled' }

// No reasoning support
reasoningLevels: { 0: null }
```

### 5.3 Default Capabilities

When `capabilities` is not specified or a property is omitted:

- `supportsImages`: Defaults to `false`
- `supportsToolCalls`: Defaults to `true`
- `supportsStreaming`: Defaults to `true`
- `supportsJsonMode`: Defaults to `false`
- `reasoningLevels`: Defaults to `{ 0: null }` (no reasoning)

## 6. Validation

Implementations **MUST** validate that:

1. `name` is non-empty, unique, and does not contain spaces
2. `provider` is a valid provider factory function
3. `model` is not an empty string

Implementations **SHOULD** validate that all `fallbacks` entries reference valid model names.

## 7. TypeScript Reference

```typescript
interface ProviderFactoryConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

type ProviderFactory = (config: ProviderFactoryConfig) => Provider;

interface ModelCapabilities {
  reasoningLevels?: Record<number, string | null>;
  supportsImages?: boolean;
  supportsToolCalls?: boolean;
  supportsStreaming?: boolean;
  supportsJsonMode?: boolean;
  maxContextTokens?: number;
  maxOutputTokens?: number;
}

interface ModelDefinition<N extends string = string> {
  name: N;
  provider: ProviderFactory;
  model: string;
  includedProviders?: string[];
  fallbacks?: string[];
  inputPrice?: number;
  outputPrice?: number;
  cachedPrice?: number;
  capabilities?: ModelCapabilities;
  providerOptions?: Record<string, unknown>;
  providerTools?: string[];
}

function defineModel<N extends string>(
  options: ModelDefinition<N>
): ModelDefinition<N>;
```

## 8. Examples

### 8.1 Basic Model Definition

```typescript
import { defineModel } from '@standardagents/builder';
import { openai } from '@standardagents/openai';

export default defineModel({
  name: 'gpt-4o',
  provider: openai,
  model: 'gpt-4o',
});
```

### 8.2 Model with Pricing and Capabilities

```typescript
import { defineModel } from '@standardagents/builder';
import { openai } from '@standardagents/openai';

export default defineModel({
  name: 'gpt-4o',
  provider: openai,
  model: 'gpt-4o',
  inputPrice: 2.5,
  outputPrice: 10,
  capabilities: {
    supportsImages: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    maxContextTokens: 128000,
  },
});
```

### 8.3 Model with Reasoning Levels

```typescript
import { defineModel } from '@standardagents/builder';
import { openai } from '@standardagents/openai';

export default defineModel({
  name: 'o3',
  provider: openai,
  model: 'o3',
  inputPrice: 10,
  outputPrice: 40,
  capabilities: {
    reasoningLevels: { 0: null, 33: 'low', 66: 'medium', 100: 'high' },
    supportsImages: true,
    supportsToolCalls: true,
  },
});
```

### 8.4 Model with Fallback Chain

```typescript
import { defineModel } from '@standardagents/builder';
import { openai } from '@standardagents/openai';

export default defineModel({
  name: 'primary-model',
  provider: openai,
  model: 'gpt-4o',
  fallbacks: ['gpt-4-turbo', 'gpt-3.5-turbo'],
  inputPrice: 2.5,
  outputPrice: 10,
});
```

### 8.5 OpenRouter with Provider Preferences

```typescript
import { defineModel } from '@standardagents/builder';
import { openrouter } from '@standardagents/openrouter';

export default defineModel({
  name: 'claude-3-opus',
  provider: openrouter,
  model: 'anthropic/claude-3-opus',
  includedProviders: ['anthropic'],
  inputPrice: 15,
  outputPrice: 75,
  capabilities: {
    supportsImages: true,
    supportsToolCalls: true,
  },
});
```

### 8.6 Model with Provider Options

```typescript
import { defineModel } from '@standardagents/builder';
import { openai } from '@standardagents/openai';

export default defineModel({
  name: 'gpt-4o-flex',
  provider: openai,
  model: 'gpt-4o',
  inputPrice: 2.5,
  outputPrice: 10,
  providerOptions: {
    service_tier: 'flex',
  },
});
```

### 8.7 Model with Provider Tools

```typescript
import { defineModel } from '@standardagents/builder';
import { openai } from '@standardagents/openai';

export default defineModel({
  name: 'gpt-4o-with-tools',
  provider: openai,
  model: 'gpt-4o',
  inputPrice: 2.5,
  outputPrice: 10,
  providerTools: ['web_search', 'file_search', 'code_interpreter'],
  capabilities: {
    supportsImages: true,
    supportsToolCalls: true,
  },
});
```

Provider tools are built-in capabilities embedded in the provider (e.g., OpenAI's web search, file search, code interpreter). See the [Providers specification](/0.1.0/specification/providers#9-provider-tools) for how providers expose tools.

