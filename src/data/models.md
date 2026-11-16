# Current Models

Working snapshot of practical model tradeoffs. Recommendations updated November 16, 2026.

## Recommended models

One model is recommended in each category. The [Recommended Models](/models) page shows the same list with the reasons and the alternatives.

| Category | Recommended model | Provider model ID | Price |
| --- | --- | --- | --- |
| Frontier | Claude Opus 5.5 | Anthropic: `claude-opus-5-5` | 4.00 / 20.00 |
| Workhorse | GPT-6 Luna | OpenAI: `gpt-6-luna` | 0.10 / 0.50 |
| Open-weight workhorse | DeepSeek V4.1 Flash 1017 | Novita: `deepseek/deepseek-v4.1-flash-1017` | 0.30 / 1.20 |
| Code review | GLM 5.3 | Novita: `zai-org/glm-5.3` | 1.40 / 4.40 |
| Orchestrator | GPT-6.1 Sol | OpenAI: `gpt-6.1-sol` | 2.00 / 10.00 |
| UI and frontend | Claude Opus 5.5 | Anthropic: `claude-opus-5-5` | 4.00 / 20.00 |
| Ultra-cheap | GPT-6 Luna | OpenAI: `gpt-6-luna` | 0.10 / 0.50 |
| Decision | Jev | TypeSafe AI: `jev-latest` | 0.042 / 0.00 |
| Image generation | Gemini 3 Pro Image Preview | Google: `gemini-3-pro-image-preview` | 2.00 / 12.00 text, 120.00 image out |
| Vision and documents | GPT-6.1 Terra | OpenAI: `gpt-6.1-terra` | 1.00 / 5.00 |

**Start non-coding work with GPT-6 Luna.** It is the default for cheap or small
tasks: extraction, classification, summaries, tool calls, and focused
subagents. Luna is not a coding model. DeepSeek V4.1 Flash 1017 is the other
recommended low-cost option, and its weights are open. Use the dated 1017
snapshot; the undated `deepseek-v4.1-flash` is not recommended.

Give difficult work, including coding, to Claude Opus 5.5. Use GLM 5.3 for code
review and security tasks, and GPT-6.1 Sol when coordination is the hard part;
simple coordination still starts with Luna. These are task-selection
recommendations, not automatic runtime fallbacks. Additional catalog entries
below are alternatives, not the default recommendations.

A model can be the pick in more than one category. GPT-6 Luna is also the
ultra-cheap pick for high-volume simple work, with DeepSeek V4.1 Flash 1017 as
the alternative. Use TypeSafe AI's Jev for the routing and yes-or-no decisions
an agent makes between steps, and GPT-6.1 Terra to read images, screenshots,
PDFs, and scanned documents.

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

For especially difficult technical work, Claude Fable 5.2 (`claude-fable-5-2`)
is a frontier alternative to Claude Opus 5.5, not the default. Its higher measured peak
capability can justify escalation, but budget for effort-dependent token use
and latency.

## Notes

- First-party list prices are used where available.
- Claude Fable 5.2 uses Anthropic's standard list price of 8.00 / 40.00; optional fast mode is 16.00 / 80.00. Cache and service-tier rates can differ. Artificial Analysis measured 26.54 per task and 41.6 minutes at Max, Default Fallback, versus Astra Max at 6.24 and 20.8 minutes; these are workload- and effort-specific measurements, not universal costs or latency.
- Open-weight and aggregator-distributed models use representative public API pricing.
- Recommended-model prices were checked on October 6, 2026: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview), and [Novita pricing](https://novita.ai/pricing) for GLM 5.3. DeepSeek V4.1 Flash 1017 was checked against Novita's model list on November 16, 2026. GPT-6.1 Terra (1.00 / 5.00) was checked against the Standard Agents pricing catalog on November 16, 2026. Listed rates are standard input/output rates; cache, long-context, service-tier, and routing charges can differ.
- Jev bills input tokens only: 0.042 per 1M input tokens, and output is free. `jev-latest` is an alias, currently Jev 1.13; pin `jev-1.13.0` where a fixed version and price are required. Price checked October 6, 2026 at [TypeSafe AI](https://docs.typesafe.ai/models).
- Kimi K3 always reasons (`reasoning_effort` locked to max) and reasoning tokens bill as output tokens; cached input is 0.30.
- Hy3 prices use the listed OpenRouter rate for `tencent/hy3` (first-party Tencent Cloud pricing is ~0.15 / 0.59).
- MiniMax M3 doubles to 0.60 / 2.40 as a step function when a request's input crosses 512K tokens.
- GLM 5.3 uses Novita's listed rate; the older GLM 4.7 Flash entry uses OpenRouter's listed rate. GLM 5.3 reasoning is always enabled; confirm supported reasoning options on your chosen provider.
- Nemotron prices use the listed OpenRouter rates for `nvidia/nemotron-3-ultra-550b-a55b` and `nvidia/nemotron-3-super-120b-a12b`.
- `conversation` estimates how natural, coherent, and useful the model feels in multi-turn chat, separate from raw reasoning or coding strength.
- `imageGeneration` measures native image-output capability, not just image understanding.

## Providers

- OpenAI: GPT-6 Luna for cheap non-coding work, GPT-6.1 Terra for vision and documents, and GPT-6.1 Sol for coordination-heavy efforts. GPT-6 Astra is a frontier alternative.
- Novita: Direct access to the recommended DeepSeek V4.1 Flash 1017 low-cost model and GLM 5.3 security specialist.
- TypeSafe AI: Jev, the recommended decision model.
- Anthropic: Claude Opus 5.5 is the frontier default and the pick for demanding UI work. Claude Fable 5.2 is the escalation above it.
- OpenRouter: Broad access across labs and alternate provider routes. Confirm model IDs, endpoint availability, and prices rather than assuming they match direct providers.
- Google: Best for vision-heavy workflows, large context windows, and fast multimodal models that are cheap enough for broad deployment.
- Cerebras: Best when raw speed matters most, especially for high-throughput inference and low-latency open-model serving.
- Groq: Best for extremely fast token generation, responsive chat UX, and cheap real-time workloads where latency dominates.
- Cloudflare Workers AI: Best when you want inference close to the edge, simple deployment inside Cloudflare, and tight integration with Worker-based apps.

## Data

```json
{
	"updated": "2026-11-16",
	"categories": [
		{
			"id": "frontier",
			"label": "Frontier",
			"description": "The most capable general models, for work where quality decides and price is secondary."
		},
		{
			"id": "workhorse",
			"label": "Workhorse",
			"description": "Affordable, dependable models for the bulk of everyday agent work: tool calls, extraction, summaries, and focused subagents. Not for coding."
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
			"why": "The default for difficult reasoning, complex debugging, and heavy implementation. Developers currently prefer it for hard work, and it costs less than half as much as GPT-6 Astra.",
			"alternatives": [
				{
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
					"note": "The previous frontier pick. Choose it when a workload measurably does better on it and the higher price is acceptable."
				},
				{
					"name": "Claude Fable 5.2",
					"provider": "anthropic",
					"model": "claude-fable-5-2",
					"price": "8.00 / 40.00",
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
					"note": "Choose for especially difficult technical and agentic work when higher measured peak capability justifies effort-dependent token use and latency."
				}
			]
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
			"why": "Start here for focused subagents, tool calls, classification, extraction, summaries, and everyday writing. Not a coding model.",
			"alternatives": []
		},
		{
			"category": "open_workhorse",
			"name": "DeepSeek V4.1 Flash 1017",
			"provider": "novita",
			"model": "deepseek/deepseek-v4.1-flash-1017",
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
			"why": "The recommended low-cost option with open weights, for focused agent and coding work. Use the dated 1017 snapshot; the undated deepseek-v4.1-flash is not recommended.",
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
			"why": "Use for difficult UI implementation, design fidelity, and visual refinement.",
			"alternatives": []
		},
		{
			"category": "ultra_cheap",
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
			"why": "The cheapest recommended model, for high-volume extraction, classification, and other simple work. It is also the workhorse pick.",
			"alternatives": [
				{
					"name": "DeepSeek V4.1 Flash 1017",
					"provider": "novita",
					"model": "deepseek/deepseek-v4.1-flash-1017",
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
					"note": "Choose it when open weights matter. Use the dated 1017 snapshot."
				}
			]
		},
		{
			"category": "decision",
			"name": "Jev",
			"provider": "typesafe",
			"model": "jev-latest",
			"price": "0.042 / 0.00",
			"modalities": {
				"input": [
					"text"
				],
				"output": [
					"text"
				]
			},
			"openWeights": false,
			"why": "Built for the routing and yes-or-no decisions an agent makes between steps. Input costs 0.042 per 1M tokens and output is free. Pin jev-1.13.0 where a fixed version and price are required.",
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
		},
		{
			"category": "vision",
			"name": "GPT-6.1 Terra",
			"provider": "openai",
			"model": "gpt-6.1-terra",
			"price": "1.00 / 5.00",
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
			"why": "Reads images, screenshots, PDFs, and scanned documents.",
			"alternatives": []
		}
	],
	"models": [
		{
			"name": "GPT-6 Luna",
			"provider": "openai",
			"model": "gpt-6-luna",
			"bestFor": "Default for cheap and small non-coding tasks",
			"price": "0.10 / 0.50",
			"summary": "Start here for focused subagents, tool calls, classification, extraction, summaries, and everyday writing. It is not a coding model: give coding to Claude Opus 5.5 or DeepSeek V4.1 Flash 1017."
		},
		{
			"name": "DeepSeek V4.1 Flash 1017",
			"provider": "novita",
			"model": "deepseek/deepseek-v4.1-flash-1017",
			"bestFor": "Low-cost alternative for focused agent and coding work",
			"price": "0.30 / 1.20",
			"summary": "The other recommended low-cost option alongside Luna. Use the dated 1017 snapshot, not the undated deepseek-v4.1-flash. Measure the full workload cost, including cache hits and output length."
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
			"bestFor": "Frontier alternative for heavy work",
			"price": "10.00 / 50.00",
			"summary": "A frontier alternative to Claude Opus 5.5 for difficult reasoning, complex debugging, and heavy implementation. It costs more than twice as much, so choose it only where a workload measurably does better on it."
		},
		{
			"name": "Claude Fable 5.2",
			"provider": "anthropic",
			"model": "claude-fable-5-2",
			"bestFor": "Frontier alternative for especially difficult technical and agentic work",
			"price": "8.00 / 40.00",
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
			"summary": "Higher measured peak capability than Astra on the Artificial Analysis Intelligence Index, but max-effort runs used substantially more output tokens and took longer. Choose when difficult work warrants escalation; measure cost and latency at your chosen effort. Optional fast mode costs 16.00 / 80.00. Claude Opus 5.5 is the frontier default."
		},
		{
			"name": "Claude Opus 5.5",
			"provider": "anthropic",
			"model": "claude-opus-5-5",
			"bestFor": "Frontier default, and the specialist for demanding UI work",
			"price": "4.00 / 20.00",
			"summary": "The default for difficult reasoning, complex debugging, heavy implementation, and demanding UI work: design fidelity and visual refinement."
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
