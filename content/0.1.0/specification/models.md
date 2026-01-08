# Models

[TK]

## 1. Model Definition

A model definition specifies which Large Language Model (LLM) to use for inference and how to connect to it. Models are referenced by name from prompt definitions and serve as the foundation of the agent system.

### 1.1 Required Properties

A model definition **MUST** include the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique identifier for this model. Used when referencing from prompts. |
| `provider` | `ModelProvider` | The LLM provider to use for API calls. |
| `model` | `string` | The model identifier sent to the provider API. |

### 1.2 Optional Properties

A model definition **MAY** include the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `fallbacks` | `string[]` | Names of fallback models to try if this model fails. |
| `includedProviders` | `string[]` | Provider routing preferences for OpenRouter. |
| `inputPrice` | `number` | Cost per 1 million input tokens in USD. |
| `outputPrice` | `number` | Cost per 1 million output tokens in USD. |
| `cachedPrice` | `number` | Cost per 1 million cached input tokens in USD. |
| `capabilities` | `ModelCapabilities` | Feature flags for model capabilities. |

## 2. Provider Reference

The `provider` property references a provider identifier. See the [Providers](/specification/providers) specification for supported providers and their configuration.

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

### 5.1 Capability Flags

The `capabilities` object describes features the model supports:

| Property | Type | Description |
|----------|------|-------------|
| `vision` | `boolean` | Whether the model supports image understanding. |
| `functionCalling` | `boolean` | Whether the model supports tool/function calling. |
| `structuredOutputs` | `boolean` | Whether the model supports JSON mode. |

### 5.2 Default Capabilities

When `capabilities` is not specified or a specific capability is omitted:

- `vision`: Defaults to `false`
- `functionCalling`: Implementations **SHOULD** default to `true` for modern models
- `structuredOutputs`: Defaults to `false`

### 5.3 Capability Behavior

When `vision` is `true`, client implementations **SHOULD** allow image attachments in requests to the model. When `vision` is `false` or unset, client implementations **SHOULD** omit image content from requests.

## 6. Validation

Implementations **MUST** validate that:

1. `name` is non-empty, unique, and does not contain spaces
2. `provider` is one of the installed provider identifiers
3. `model` is not an empty string

Implementations **SHOULD** validate that all `fallbacks` entries reference valid model names.

## 7. TypeScript Reference

```typescript
/**
 * Supported LLM provider identifiers.
 */
type ModelProvider = 'openai' | 'openrouter' | 'anthropic' | 'google' | 'test';

/**
 * Model capability flags.
 */
interface ModelCapabilities {
  /** Whether the model supports vision (image understanding). */
  vision?: boolean;
  /** Whether the model supports function calling (tool use). */
  functionCalling?: boolean;
  /** Whether the model supports structured outputs (JSON mode). */
  structuredOutputs?: boolean;
}

/**
 * Model definition configuration.
 */
interface ModelDefinition<N extends string = string> {
  /** Unique identifier for this model. */
  name: N;
  /** The LLM provider to use for API calls. */
  provider: ModelProvider;
  /** The model identifier sent to the provider API. */
  model: string;
  /** Provider routing preferences for OpenRouter. */
  includedProviders?: string[];
  /** Names of fallback models to try if this model fails. */
  fallbacks?: string[];
  /** Cost per 1 million input tokens in USD. */
  inputPrice?: number;
  /** Cost per 1 million output tokens in USD. */
  outputPrice?: number;
  /** Cost per 1 million cached input tokens in USD. */
  cachedPrice?: number;
  /** Model capability flags. */
  capabilities?: ModelCapabilities;
}

/**
 * Define a model configuration.
 */
function defineModel<N extends string>(
  options: ModelDefinition<N>
): ModelDefinition<N>;
```

## 8. Examples

### 8.1 Basic Model Definition

```typescript
import { defineModel } from '@standardagents/spec';

export default defineModel({
  name: 'gpt-4o',
  provider: 'openai',
  model: 'gpt-4o',
});
```

### 8.2 Model with Pricing and Capabilities

```typescript
import { defineModel } from '@standardagents/spec';

export default defineModel({
  name: 'gpt-4o',
  provider: 'openai',
  model: 'gpt-4o',
  inputPrice: 2.5,
  outputPrice: 10,
  capabilities: {
    vision: true,
    functionCalling: true,
    structuredOutputs: true,
  },
});
```

### 8.3 Model with Fallback Chain

```typescript
import { defineModel } from '@standardagents/spec';

export default defineModel({
  name: 'primary-model',
  provider: 'openai',
  model: 'gpt-4o',
  fallbacks: ['gpt-4-turbo', 'gpt-3.5-turbo'],
  inputPrice: 2.5,
  outputPrice: 10,
});
```

### 8.4 OpenRouter with Provider Preferences

```typescript
import { defineModel } from '@standardagents/spec';

export default defineModel({
  name: 'claude-3-opus',
  provider: 'openrouter',
  model: 'anthropic/claude-3-opus',
  includedProviders: ['anthropic'],
  inputPrice: 15,
  outputPrice: 75,
  capabilities: {
    vision: true,
    functionCalling: true,
  },
});
```

### 8.5 Test Model for Development

```typescript
import { defineModel } from '@standardagents/spec';

export default defineModel({
  name: 'test',
  provider: 'test',
  model: 'test',
});
```

