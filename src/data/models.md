# Current Models

Working snapshot of practical model tradeoffs. Recommendations updated November 12, 2026.

## Recommended models

One model is recommended in each category. The [Recommended Models](/models) page shows the same list with the reasons and the alternatives.

| Category | Recommended model | Provider model ID | Price |
| --- | --- | --- | --- |
| Frontier | GPT-6 Astra | OpenAI: `gpt-6-astra` | 10.00 / 50.00 |
| Workhorse | GPT-6 Luna | OpenAI: `gpt-6-luna` | 0.10 / 0.50 |
| Open-weight workhorse | DeepSeek V4.1 Flash | Novita: `deepseek/deepseek-v4.1-flash` | 0.30 / 1.20 |
| Code review | GLM 5.3 | Novita: `zai-org/glm-5.3` | 1.40 / 4.40 |
| Orchestrator | GPT-6.1 Sol | OpenAI: `gpt-6.1-sol` | 2.00 / 10.00 |
| UI and frontend | Claude Opus 5.5 | Anthropic: `claude-opus-5-5` | 4.00 / 20.00 |
| Ultra-cheap | No pick yet | | |
| Decision | No pick yet | | |
| Image generation | Gemini 3 Pro Image Preview | Google: `gemini-3-pro-image-preview` | 2.00 / 12.00 text, 120.00 image out |
| Vision and documents | No pick yet | | |

**Start most work with GPT-6 Luna.** It is the default for cheap or small tasks,
routine coding, extraction, classification, summaries, tool calls, and focused
subagents. DeepSeek V4.1 Flash is the other recommended low-cost option, and its
weights are open.

Use GLM 5.3 for code review and security tasks. Reserve Astra, Opus, and Sol for
work that needs their respective strengths; routine UI edits and simple
coordination still start with Luna. These are task-selection recommendations,
not automatic runtime fallbacks. A category with no pick yet has no model that
has been judged for it. Additional catalog entries below are alternatives, not
the default recommendations.

Run `agents current-models` for this guide and
`agents available-models --provider=<name>` to confirm availability and the exact
ID on the provider you will use. IDs differ by provider: for example, OpenRouter
uses `z-ai/glm-5.3`, while Novita uses `zai-org/glm-5.3`.

All prices are in USD and shown as cost per 1M input tokens / 1M output tokens.

## Scoring

Scores, where present on additional catalog entries, are qualitative estimates,
not benchmark results or runtime capability declarations. The recommendations
above take precedence over these older comparison scores.

| Score | Meaning |
| --- | --- |
| 0 | Not supported |
| 1 | Weak |
| 2 | Moderate |
| 3 | Above average |
| 4 | State of the art |

## Notes

- First-party list prices are used where available.
- Open-weight and aggregator-distributed models use representative public API pricing.
- Recommended-model prices were checked on October 6, 2026: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview), and [Novita pricing](https://novita.ai/pricing) for DeepSeek V4.1 Flash and GLM 5.3. Listed rates are standard input/output rates; cache, long-context, service-tier, and routing charges can differ.
- Kimi K3 always reasons (`reasoning_effort` locked to max) and reasoning tokens bill as output tokens; cached input is 0.30.
- Hy3 prices use the listed OpenRouter rate for `tencent/hy3` (first-party Tencent Cloud pricing is ~0.15 / 0.59).
- MiniMax M3 doubles to 0.60 / 2.40 as a step function when a request's input crosses 512K tokens.
- GLM 5.3 uses Novita's listed rate; the older GLM 4.7 Flash entry uses OpenRouter's listed rate. GLM 5.3 reasoning is always enabled; confirm supported reasoning options on your chosen provider.
- Nemotron prices use the listed OpenRouter rates for `nvidia/nemotron-3-ultra-550b-a55b` and `nvidia/nemotron-3-super-120b-a12b`.
- `conversation` estimates how natural, coherent, and useful the model feels in multi-turn chat, separate from raw reasoning or coding strength.
- `imageGeneration` measures native image-output capability, not just image understanding.

## Providers

- OpenAI: Default starting point through GPT-6 Luna. Reserve GPT-6 Astra for heavy work and GPT-6.1 Sol for coordination-heavy efforts.
- Novita: Direct access to the recommended DeepSeek V4.1 Flash low-cost alternative and GLM 5.3 security specialist.
- Anthropic: Claude Opus 5.5 for demanding UI work; budget it as a very expensive specialist.
- OpenRouter: Broad access across labs and alternate provider routes. Confirm model IDs, endpoint availability, and prices rather than assuming they match direct providers.
- Google: Best for vision-heavy workflows, large context windows, and fast multimodal models that are cheap enough for broad deployment.
- Cerebras: Best when raw speed matters most, especially for high-throughput inference and low-latency open-model serving.
- Groq: Best for extremely fast token generation, responsive chat UX, and cheap real-time workloads where latency dominates.
- Cloudflare Workers AI: Best when you want inference close to the edge, simple deployment inside Cloudflare, and tight integration with Worker-based apps.

## Data

```json
{
	"updated": "2026-11-12",
	"categories": [
		{
			"id": "frontier",
			"label": "Frontier",
			"description": "The most capable general models, for work where quality decides and price is secondary."
		},
		{
			"id": "workhorse",
			"label": "Workhorse",
			"description": "Affordable, dependable models for the bulk of everyday agent and coding work."
		},
		{
			"id": "open_workhorse",
			"label": "Open-weight workhorse",
			"description": "The best everyday model whose weights you can download and host yourself."
		},
		{
			"id": "code_review",
			"label": "Code review",
			"description": "Models that read code critically and find real bugs, security flaws, and regressions."
		},
		{
			"id": "orchestrator",
			"label": "Orchestrator",
			"description": "Models that coordinate many agents, tools, and work streams over long runs."
		},
		{
			"id": "ui",
			"label": "UI and frontend",
			"description": "Models for demanding interface work: design fidelity, layout, and visual refinement."
		},
		{
			"id": "ultra_cheap",
			"label": "Ultra-cheap",
			"description": "Low-intelligence, very cheap models for high-volume simple work such as extraction and classification."
		},
		{
			"id": "decision",
			"label": "Decision",
			"description": "Small, fast models for the routing and yes-or-no judgements an agent makes between steps."
		},
		{
			"id": "image",
			"label": "Image generation",
			"description": "Models that generate or edit images."
		},
		{
			"id": "vision",
			"label": "Vision and documents",
			"description": "Models that read images, screenshots, PDFs, and scanned documents."
		}
	],
	"recommendations": [
		{
			"category": "frontier",
			"name": "GPT-6 Astra",
			"provider": "openai",
			"model": "gpt-6-astra",
			"price": "10.00 / 50.00",
			"modalities": {
				"input": [
					"text",
					"image",
					"file"
				],
				"output": [
					"text"
				]
			},
			"openWeights": false,
			"why": "Reserve for difficult reasoning, complex debugging, and heavy implementation where the extra capability justifies the cost.",
			"alternatives": []
		},
		{
			"category": "workhorse",
			"name": "GPT-6 Luna",
			"provider": "openai",
			"model": "gpt-6-luna",
			"price": "0.10 / 0.50",
			"modalities": {
				"input": [
					"text",
					"image",
					"file"
				],
				"output": [
					"text"
				]
			},
			"openWeights": false,
			"why": "Start here for routine coding, focused subagents, tool calls, classification, extraction, summaries, and everyday writing.",
			"alternatives": []
		},
		{
			"category": "open_workhorse",
			"name": "DeepSeek V4.1 Flash",
			"provider": "novita",
			"model": "deepseek/deepseek-v4.1-flash",
			"price": "0.30 / 1.20",
			"modalities": {
				"input": [
					"text",
					"image"
				],
				"output": [
					"text"
				]
			},
			"openWeights": true,
			"why": "The recommended low-cost option with open weights, for focused agent and coding work. Novita cache reads are $0.006 per million tokens.",
			"alternatives": []
		},
		{
			"category": "code_review",
			"name": "GLM 5.3",
			"provider": "novita",
			"model": "zai-org/glm-5.3",
			"price": "1.40 / 4.40",
			"modalities": {
				"input": [
					"text"
				],
				"output": [
					"text"
				]
			},
			"openWeights": true,
			"why": "Preferred specialist for security analysis, vulnerability review, and security-sensitive changes. Use the full GLM 5.3 model, not GLM 5.3 Flash.",
			"alternatives": []
		},
		{
			"category": "orchestrator",
			"name": "GPT-6.1 Sol",
			"provider": "openai",
			"model": "gpt-6.1-sol",
			"price": "2.00 / 10.00",
			"modalities": {
				"input": [
					"text",
					"image",
					"file"
				],
				"output": [
					"text"
				]
			},
			"openWeights": false,
			"why": "Use when coordinating many agents, tools, dependencies, or work streams is the hard part.",
			"alternatives": []
		},
		{
			"category": "ui",
			"name": "Claude Opus 5.5",
			"provider": "anthropic",
			"model": "claude-opus-5-5",
			"price": "4.00 / 20.00",
			"modalities": {
				"input": [
					"text",
					"image",
					"file"
				],
				"output": [
					"text"
				]
			},
			"openWeights": false,
			"why": "Use for difficult UI implementation, design fidelity, and visual refinement. Routine UI changes still start with Luna.",
			"alternatives": []
		},
		{
			"category": "image",
			"name": "Gemini 3 Pro Image Preview",
			"provider": "google",
			"model": "gemini-3-pro-image-preview",
			"price": "2.00 / 12.00 text, 120.00 image out",
			"modalities": {
				"input": [
					"text",
					"image"
				],
				"output": [
					"text",
					"image"
				]
			},
			"openWeights": false,
			"why": "Image generation with strong prompt understanding. Image output costs far more than text.",
			"alternatives": []
		}
	],
	"models": [
		{
			"name": "GPT-6 Luna",
			"provider": "openai",
			"model": "gpt-6-luna",
			"bestFor": "Default for most work, especially all cheap/small tasks",
			"price": "0.10 / 0.50",
			"summary": "Start here for routine coding, focused subagents, tool calls, classification, extraction, summaries, and everyday writing. Escalate only when the task needs a specialist or Luna does not meet the required quality."
		},
		{
			"name": "DeepSeek V4.1 Flash",
			"provider": "novita",
			"model": "deepseek/deepseek-v4.1-flash",
			"bestFor": "Low-cost alternative for focused agent and coding work",
			"price": "0.30 / 1.20",
			"summary": "The other recommended low-cost option alongside Luna. Novita cache reads are $0.006 per million tokens; measure the full workload cost, including cache hits and output length."
		},
		{
			"name": "GLM 5.3",
			"provider": "novita",
			"model": "zai-org/glm-5.3",
			"bestFor": "Security work and security review",
			"price": "1.40 / 4.40",
			"summary": "Preferred specialist for security analysis, vulnerability review, and security-sensitive changes. Use the full GLM 5.3 model, not GLM 5.3 Flash. Reasoning is always enabled."
		},
		{
			"name": "GPT-6 Astra",
			"provider": "openai",
			"model": "gpt-6-astra",
			"bestFor": "Very expensive specialist for heavy work",
			"price": "10.00 / 50.00",
			"summary": "Reserve for difficult reasoning, complex debugging, and heavy implementation where the extra capability justifies the cost. Most tasks should start with Luna."
		},
		{
			"name": "Claude Opus 5.5",
			"provider": "anthropic",
			"model": "claude-opus-5-5",
			"bestFor": "Very expensive specialist for demanding UI work",
			"price": "4.00 / 20.00",
			"summary": "Use for difficult UI implementation, design fidelity, and visual refinement. Routine UI changes still start with Luna."
		},
		{
			"name": "GPT-6.1 Sol",
			"provider": "openai",
			"model": "gpt-6.1-sol",
			"bestFor": "Very expensive specialist for coordination-heavy efforts",
			"price": "2.00 / 10.00",
			"summary": "Use when coordinating many agents, tools, dependencies, or work streams is the hard part. Simple routing and small coordination tasks still start with Luna."
		},
		{
			"name": "Kimi K3",
			"bestFor": "Open-source heavy work",
			"price": "3.00 / 15.00",
			"scores": {
				"reasoning": 4,
				"coding": 4,
				"toolUse": 4,
				"instructionFollowing": 3,
				"longContext": 4,
				"vision": 3,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 2,
				"costEfficiency": 2,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "Open-weight frontier model (2.8T LatentMoE, 16 of 896 experts active) with native vision and a 1M context window. Leads BrowseComp, MCPMark, SpreadsheetBench 2, and AutomationBench; second on the AA-Briefcase long-horizon benchmark ahead of GPT-5.6 Sol. Always reasons — reasoning tokens bill as output, so budget accordingly."
		},
		{
			"name": "Gemini 3.1 Pro",
			"bestFor": "Multimodal pro workflows",
			"price": "2.00 / 12.00",
			"scores": {
				"reasoning": 4,
				"coding": 3,
				"toolUse": 2,
				"instructionFollowing": 2,
				"longContext": 4,
				"vision": 4,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 2,
				"costEfficiency": 2,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "High-end multimodal model with strong reasoning, agent tooling, and long-context support, but slower and pricier than Flash-class models."
		},
		{
			"name": "Tencent Hy3",
			"bestFor": "Cheap long-horizon agents",
			"price": "0.14 / 0.58",
			"scores": {
				"reasoning": 3,
				"coding": 2,
				"toolUse": 3,
				"instructionFollowing": 3,
				"longContext": 3,
				"vision": 0,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 3,
				"costEfficiency": 4,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "Apache-licensed 295B MoE (21B active) with a 256K window tuned for long-horizon agent work: multi-turn constraint tracking, coreference over long transcripts, and tool calling that stays stable across scaffoldings. Configurable effort (no-think default, low/high CoT). Weak spot is coding depth — pair it with a coding model."
		},
		{
			"name": "NVIDIA Nemotron 3 Ultra 550B A55B",
			"bestFor": "Frontier open reasoning and coordinator/orchestration work at a value price. Strong tool discernment across large tool sets.",
			"price": "0.50 / 2.50",
			"scores": {
				"reasoning": 4,
				"coding": 3,
				"toolUse": 4,
				"instructionFollowing": 3,
				"longContext": 4,
				"vision": 0,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 2,
				"costEfficiency": 3,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "Open frontier reasoning and orchestration MoE (55B active of 550B) with a 1M context window, built for multi-agent coordination, tool calling, and structured output at a fraction of closed frontier pricing."
		},
		{
			"name": "GLM 4.7 Flash",
			"bestFor": "Good for conversation at a very low cost. Fine with small number of tool calls, but not appropriate for coordinators.",
			"price": "0.06 / 0.40",
			"scores": {
				"reasoning": 1,
				"coding": 1,
				"toolUse": 1,
				"instructionFollowing": 2,
				"longContext": 3,
				"vision": 0,
				"imageGeneration": 0,
				"structuredOutput": 2,
				"speed": 4,
				"costEfficiency": 4,
				"reliability": 2,
				"conversation": 3
			},
			"summary": "Lightweight variant focused on speed and low-friction usage rather than high-end reasoning or coding depth."
		},
		{
			"name": "Gemma 4 31B",
			"bestFor": "Conversation, tool calling, speed — open weights.",
			"price": "0.10 / 0.35",
			"scores": {
				"reasoning": 3,
				"coding": 2,
				"toolUse": 2,
				"instructionFollowing": 3,
				"longContext": 3,
				"vision": 3,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 4,
				"costEfficiency": 4,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "Open-weight 256K-context multimodal model with native function calling and a configurable thinking mode. Punches far above its size (89.2 AIME, strong OCR/document/UI understanding) and is cheap enough for broad deployment — the Flash-class slot, deployable on your own hardware."
		},
		{
			"name": "gemini-3-flash-preview",
			"bestFor": "Fast grounded assistants",
			"price": "0.50 / 3.00",
			"scores": {
				"reasoning": 3,
				"coding": 2,
				"toolUse": 2,
				"instructionFollowing": 3,
				"longContext": 4,
				"vision": 3,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 3,
				"costEfficiency": 3,
				"reliability": 2,
				"conversation": 2
			},
			"summary": "Fast multimodal preview model with solid grounding and tool support, positioned for responsive assistant and agent use. Good price."
		},
		{
			"name": "gemini-3-pro-image-preview",
			"bestFor": "Image generation with strong prompt understanding",
			"price": "2.00 / 12.00 text, 120.00 image out",
			"scores": {
				"reasoning": 3,
				"coding": 0,
				"toolUse": 0,
				"instructionFollowing": 1,
				"longContext": 1,
				"vision": 4,
				"imageGeneration": 4,
				"structuredOutput": 0,
				"speed": 2,
				"costEfficiency": 1,
				"reliability": 2,
				"conversation": 2
			},
			"summary": "Image-generation preview model with strong prompt following and multimodal understanding, but significantly higher output cost for images."
		},
		{
			"name": "NVIDIA Nemotron 3 Super 120B",
			"bestFor": "Cheap open agent systems",
			"price": "0.10 / 0.50",
			"scores": {
				"reasoning": 3,
				"coding": 3,
				"toolUse": 3,
				"instructionFollowing": 3,
				"longContext": 4,
				"vision": 0,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 4,
				"costEfficiency": 4,
				"reliability": 3,
				"conversation": 2
			},
			"summary": "Fast throughput, and unusually low token pricing for agentic work."
		},
		{
			"name": "Qwen3.5 397B A17B",
			"bestFor": "Multilingual multimodal work",
			"price": "0.39 / 2.34",
			"scores": {
				"reasoning": 3,
				"coding": 3,
				"toolUse": 3,
				"instructionFollowing": 3,
				"longContext": 3,
				"vision": 3,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 3,
				"costEfficiency": 3,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "Large multimodal model with strong reasoning, coding, and visual performance at competitive pricing for its capability class."
		},
		{
			"name": "MiniMax M3",
			"bestFor": "Coding agents on a budget",
			"price": "0.30 / 1.20",
			"scores": {
				"reasoning": 3,
				"coding": 3,
				"toolUse": 3,
				"instructionFollowing": 3,
				"longContext": 4,
				"vision": 3,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 3,
				"costEfficiency": 4,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "Agent-oriented model with a 1M context window and text/image/video input, strong coding and tool use, and excellent price-performance. Cache reads are 10% of input; note the whole request bills 2x once input crosses 512K."
		},
		{
			"name": "Qwen3.5 35B A3B",
			"bestFor": "Cheap deployable open model",
			"price": "0.14 / 1.00",
			"scores": {
				"reasoning": 2,
				"coding": 3,
				"toolUse": 2,
				"instructionFollowing": 3,
				"longContext": 2,
				"vision": 0,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 4,
				"costEfficiency": 4,
				"reliability": 2,
				"conversation": 2
			},
			"summary": "Sparse open-weight MoE (only 3B active) that is very fast and cheap to serve — including on local hardware. Surprisingly strong coding for its activation size; keep tool sets small and prompts explicit, as discernment thins out with breadth."
		}
	]
}
```
