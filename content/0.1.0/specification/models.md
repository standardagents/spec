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
| `providerOptions` | `InferProviderOptions<P>` | Provider-specific default options for this model. Type is inferred from the provider's schema. |
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

Pricing configuration is optional. Providers **MAY** return pricing information per-request (e.g. in response headers or metadata). When provider-reported pricing is available:

- Provider-reported pricing **SHOULD** take priority over static model configuration.
- Static pricing serves as a fallback when provider pricing is unavailable.
- Implementations **MUST** restrict cost information to authorized parties.

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
import type { z, ZodTypeAny } from 'zod';

interface ProviderFactoryConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Provider factory with optional typed providerOptions schema.
 * The schema property allows type inference and runtime validation.
 */
interface ProviderFactoryWithOptions<TOptions extends ZodTypeAny = ZodTypeAny> {
  (config: ProviderFactoryConfig): Provider;
  /** Zod schema for provider-specific options */
  providerOptions?: TOptions;
}

// ProviderFactory is an alias for backward compatibility
type ProviderFactory = ProviderFactoryWithOptions<ZodTypeAny>;

/**
 * Extract providerOptions type from a provider factory.
 * Returns the inferred input type from the provider's Zod schema.
 */
type InferProviderOptions<P> =
  P extends ProviderFactoryWithOptions<infer S>
    ? S extends ZodTypeAny
      ? z.input<S>
      : Record<string, unknown>
    : Record<string, unknown>;

interface ModelCapabilities {
  reasoningLevels?: Record<number, string | null>;
  supportsImages?: boolean;
  supportsToolCalls?: boolean;
  supportsStreaming?: boolean;
  supportsJsonMode?: boolean;
  maxContextTokens?: number;
  maxOutputTokens?: number;
}

interface ModelDefinition<
  N extends string = string,
  P extends ProviderFactoryWithOptions<ZodTypeAny> = ProviderFactoryWithOptions<ZodTypeAny>
> {
  name: N;
  provider: P;
  model: string;
  includedProviders?: string[];
  fallbacks?: string[];
  inputPrice?: number;
  outputPrice?: number;
  cachedPrice?: number;
  capabilities?: ModelCapabilities;
  providerOptions?: InferProviderOptions<P>;
  providerTools?: string[];
}

function defineModel<N extends string, P extends ProviderFactoryWithOptions<ZodTypeAny>>(
  options: ModelDefinition<N, P>
): ModelDefinition<N, P>;
```

## 8. Typed Provider Options

### 8.1 Overview

Provider packages can export a Zod schema that defines the shape of their `providerOptions`. This enables:

- **TypeScript autocomplete**: IDE suggestions for valid options
- **Type checking**: Compile-time errors for invalid options
- **Runtime validation**: Errors thrown if options don't match schema

### 8.2 How It Works

Provider factories can attach a `providerOptions` property containing a Zod schema:

```typescript
// Inside @standardagents/openai
import { z } from 'zod';

export const openaiProviderOptions = z.object({
  service_tier: z.enum(['auto', 'default', 'flex']).optional(),
  user: z.string().optional(),
  seed: z.number().int().optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
}).passthrough();

export const openai: ProviderFactoryWithOptions<typeof openaiProviderOptions> =
  Object.assign(
    (config) => new OpenAIProvider(config),
    { providerOptions: openaiProviderOptions }
  );
```

When you use this provider with `defineModel`, TypeScript automatically infers the correct type for `providerOptions`:

```typescript
import { defineModel } from '@standardagents/builder';
import { openai } from '@standardagents/openai';

export default defineModel({
  name: 'gpt-4o',
  provider: openai,
  model: 'gpt-4o',
  providerOptions: {
    service_tier: 'flex',    // TypeScript knows this is valid
    // typo_field: 'x',      // TypeScript ERROR: unknown property
  },
});
```

### 8.3 Runtime Validation

When `defineModel` is called, if the provider has a schema and `providerOptions` are provided, the options are validated at runtime:

```typescript
// This throws an error at runtime:
defineModel({
  name: 'test',
  provider: openai,
  model: 'gpt-4o',
  providerOptions: {
    service_tier: 'invalid', // Error: Invalid enum value
  },
});
// Error: Invalid providerOptions for model 'test': service_tier: Invalid enum value
```

### 8.4 Provider Schema Examples

**OpenAI** (`@standardagents/openai`):
```typescript
providerOptions: {
  service_tier: 'default' | 'auto' | 'flex',
  user: string,
  seed: number,
  frequency_penalty: number,  // -2.0 to 2.0
  presence_penalty: number,   // -2.0 to 2.0
  logprobs: boolean,
  top_logprobs: number,       // 0-20
  store: boolean,
  metadata: Record<string, string>,
}
```

**OpenRouter** (`@standardagents/openrouter`):
```typescript
providerOptions: {
  provider: {
    order: string[],              // Provider slugs to try in order
    allow_fallbacks: boolean,
    require_parameters: boolean,
    data_collection: 'allow' | 'deny',
    zdr: boolean,                 // Zero Data Retention
    only: string[],               // Restrict to these providers
    ignore: string[],             // Skip these providers
    sort: 'price' | 'throughput' | 'latency',
    max_price: {
      prompt: number,
      completion: number,
      request: number,
      image: number,
    },
    quantizations: string[],
    preferred_min_throughput: number,
    preferred_max_latency: number,
  },
}
```

**DeepInfra** (`@standardagents/deepinfra`):
```typescript
providerOptions: {
  reasoning_effort: 'none' | 'low' | 'medium' | 'high',
  service_tier: 'default' | 'priority' | 'flex',
  prompt_cache_key: string,
  seed: number,
  top_k: number,
  min_p: number,
}
```

### 8.5 Sampling Parameters

`providerOptions` is the intended home for sampling and generation parameters — `temperature`, `top_p`, `top_k`, `max_tokens`, `min_p`, seeds, and penalty settings. `defineModel` deliberately has no first-class fields for these: the right values are model-family-specific (one model wants `temperature: 0.3` for deterministic tool loops, another's vendor recommends `1.0` and degrades below it), so they belong on the model definition, next to the model they tune. Options set here are merged onto every request made with the model, after the runtime's standard fields, so they also act as overrides.

```typescript
import { defineModel } from '@standardagents/builder';
import { novita } from '@standardagents/novita';

export default defineModel({
  name: 'minimax_m3',
  provider: novita,
  model: 'minimax/minimax-m3',
  // Vendor-recommended sampling rides with the model, not the prompt.
  providerOptions: { temperature: 1.0, top_p: 0.95, top_k: 40, max_tokens: 32768 },
});
```

> Tip: Prefer the model vendor's published sampling recommendations over provider defaults, and record them here explicitly — an unset parameter silently rides whatever the provider defaults to, which can change under you.

Prompt-level `reasoning` (effort, exclusion) remains the per-prompt knob; sampling stays with the model.

### 8.6 Backward Compatibility

- Providers without a schema still work (accept `Record<string, unknown>`)
- Existing model definitions continue to work without changes
- Schema validation is opt-in (only runs if provider exports a schema)

## 9. Examples

### 9.1 Basic Model Definition

```typescript
import { defineModel } from '@standardagents/builder';
import { openai } from '@standardagents/openai';

export default defineModel({
  name: 'gpt-4o',
  provider: openai,
  model: 'gpt-4o',
});
```

### 9.2 Model with Pricing and Capabilities

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

### 9.3 Model with Reasoning Levels

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

### 9.4 Model with Fallback Chain

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

### 9.5 OpenRouter with Typed Provider Options

```typescript
import { defineModel } from '@standardagents/builder';
import { openrouter } from '@standardagents/openrouter';

export default defineModel({
  name: 'claude-3-opus',
  provider: openrouter,
  model: 'anthropic/claude-3-opus',
  inputPrice: 15,
  outputPrice: 75,
  capabilities: {
    supportsImages: true,
    supportsToolCalls: true,
  },
  providerOptions: {
    provider: {
      zdr: true,              // TypeScript knows this is boolean
      only: ['anthropic'],    // TypeScript knows this is string[]
      max_price: {
        prompt: 1,            // TypeScript autocompletes this structure
        completion: 5,
      },
    },
  },
});
```

### 9.6 OpenAI with Typed Provider Options

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
    service_tier: 'flex',     // TypeScript knows: 'auto' | 'default' | 'flex'
    seed: 42,                 // TypeScript knows this is number
    frequency_penalty: 0.5,   // TypeScript validates: -2.0 to 2.0
  },
});
```

### 9.7 Model with Provider Tools

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
