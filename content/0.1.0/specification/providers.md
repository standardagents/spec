# Providers

[TK]

## 1. Provider Definition

A provider defines the interface between Standard Agents and an external AI model service. Each provider handles authentication, request formatting, and response parsing for a specific AI platform.

## 2. Supported Providers

Implementations **MUST** support the following provider identifiers:

| Provider | Description |
|----------|-------------|
| `openai` | OpenAI API |
| `anthropic` | Anthropic API |
| `google` | Google AI API |
| `openrouter` | OpenRouter API (multi-provider gateway) |
| `test` | Test provider for scripted responses |

## 3. Authentication

Each provider requires an API key for authentication. API keys **MUST** be stored securely and **MUST NOT** be committed to version control. Implementations **SHOULD** fail gracefully with a clear error message when a required API key is missing. API keys **SHOULD NOT** be logged or included in error messages.

## 4. Model Identifiers

The `model` property in model definitions uses provider-specific identifiers:

| Provider | Format | Examples |
|----------|--------|----------|
| `openai` | Model name | `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| `anthropic` | Model name with date | `claude-3-opus-20240229`, `claude-3-sonnet-20240229` |
| `google` | Model name | `gemini-1.5-pro`, `gemini-1.5-flash` |
| `openrouter` | Provider-prefixed | `openai/gpt-4o`, `anthropic/claude-3-opus` |
| `test` | Any string | `test` |

When using OpenRouter, implementations **SHOULD** validate that the `model` property matches the expected provider-prefixed format.

## 5. Test Provider

The `test` provider enables deterministic testing without external API calls. It returns scripted responses defined in the test configuration.

