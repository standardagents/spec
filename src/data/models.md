# Current Models

Last updated: April 13, 2026

This is a curated shortlist of models that are currently good fits for common
Standard Agents patterns. It is intentionally opinionated and intentionally
short. Verify the exact provider model IDs in your project with:

```bash
pnpm exec agents available-models --provider=<provider>
```

## Coordinators and deeper reasoning

- `gpt-5` (OpenAI): Strong default for coordinator agents that need planning,
  prioritization, and clean tool use.
- `gpt-5-mini` (OpenAI): Good when you want similar behavior with lower cost and
  faster latency.
- `o4-mini` (OpenAI): Strong for focused reasoning steps and structured work.
- `qwen3-32b` style reasoning models: Solid budget-friendly reasoning options
  when latency is acceptable.

## Fast tool calling and utility work

- `gpt-5-mini`: Reliable default for general tool calling.
- `llama-3.3-70b-instruct` class models: Good for cheaper tool-heavy flows if
  the tool set is narrow and descriptions are clear.
- `gpt-oss-20b`: Useful when you want a smaller open-weight style option.

## Vision and multimodal work

- `gpt-5` / `gpt-5-mini`: Good general multimodal analysis.
- `gemini-2.5-pro` or `gemini-2.5-flash`: Strong for image understanding and
  long multimodal context.
- `llama-4-scout` class models: Useful when available through providers like
  Cloudflare.

## Image generation

- `gpt-image-1`: Strong general image generation and editing.
- `imagen-4` class models: Good when you want Google-native image generation.
- `flux` class models: Strong for stylized asset generation when exposed by your
  provider.

## Practical defaults

- Coordinator agent: start with a stronger reasoning model.
- Narrow domain subagent: use a faster, cheaper model with a smaller tool set.
- Asset generation prompt/tool: use a dedicated image model instead of a full
  subagent unless you need QA or follow-up reasoning in-thread.
- Fallback models: use a different provider when possible to reduce correlated
  failures.

## Selection reminders

- Always choose the smallest model that is good enough.
- Keep tool menus narrow for smaller models.
- Use different models or providers for generation and QA when you need
  objective review.
- Re-check this file and your provider inventory regularly because availability
  changes.
