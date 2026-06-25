# Providers

Providers are the bridge between Standard Agents and LLM APIs. They translate Standard Agents requests into provider-native calls and return responses in the standard format.

## Provider Packages

The specification does not require a fixed provider list. Implementations MAY ship any provider package that satisfies the [Provider specification](/0.1.0/specification/providers). Examples include:

- OpenAI
- Anthropic
- Google
- OpenRouter
- Cerebras
- Cloudflare
- Groq
- xAI

Runtimes MUST treat provider extensions as separate provider identities from their base providers.

## Extending a Provider

A provider extension MAY be defined when an API is compatible with an existing provider package but requires a distinct name, API key, base URL, model list, icons, tools, pricing, or request behavior.

```typescript
import { defineProvider, providerEnv } from '@standardagents/spec';
import { openai } from '@standardagents/openai';

export default defineProvider({
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
```

A model definition MAY reference the extension provider:

```typescript
import { defineModel } from '@standardagents/spec';
import openaiCompatible from '../providers/openai-compatible';

export default defineModel({
  name: 'example_chat',
  provider: openaiCompatible,
  model: 'example-chat',
});
```

The base provider and extension provider are distinct provider identities. The extension reuses the base provider implementation unless it overrides a method.

## Provider Configuration

Provider configuration is connection-level configuration used to construct the provider client. It is separate from `providerOptions`, which are per-model, per-prompt, or per-request options.

Provider config values MAY include:

- API keys
- base URLs
- regions
- account IDs
- deployment IDs
- request timeouts

Base providers expose supported config locations through `configSlots`:

```typescript
openai.configSlots = {
  apiKey: {
    type: 'secret',
    required: true,
    defaultEnv: 'OPENAI_API_KEY',
    overridable: true,
  },
  baseUrl: {
    type: 'url',
    default: 'https://api.openai.com/v1',
    overridable: true,
  },
};
```

A provider extension's `config` object chooses where each slot gets its value. If a slot is not overridden, the base provider's `defaultEnv` and `default` are used. For example, an OpenAI-based extension that only overrides `baseUrl` still uses `OPENAI_API_KEY`; to use its own key, the extension MUST override `apiKey`.

Provider config value sources are:

| Source | Use |
|--------|-----|
| `providerEnv(name, options)` | Environment variable source with metadata for setup UIs and validation. |
| `providerValue(value)` | Supplies a literal value. |
| `providerConst(value)` | Alias for `providerValue(value)`. |

## Method Overrides

Provider extensions can override provider behavior with an `overrides` object. Each override receives a context object and `next()`, where `next()` calls the base provider implementation.

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
    async getModels({ config }) {
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      const body = await response.json();
      return body.data;
    },
  },
});
```

An override MUST call `next()` to compose with the base provider. If it does not call `next()`, it replaces the base provider behavior.

Overrideable methods are `generate`, `stream`, `supportsModel`, `getModels`, `getModelsPage`, `getModelCapabilities`, `getTools`, `getIcon`, `inspectRequest`, and `getResponseMetadata`.

## API Key Management

API keys and other credentials MUST be declared as provider config slots or provider extension value sources with `type`/`valueType: 'secret'`.

Runtimes and setup UIs SHOULD:

- mark secret values as sensitive
- avoid logging raw secret values
- report missing required provider variables before model execution
- allow compatible provider extensions to use their own secret variables instead of the base provider's default key

An OpenAI model MAY use `OPENAI_API_KEY` while an OpenAI-compatible extension uses `EXAMPLE_PROVIDER_API_KEY` and `EXAMPLE_PROVIDER_BASE_URL`.
