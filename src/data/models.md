# Current Models

Working snapshot of practical model tradeoffs.

All prices are in USD and shown as cost per 1M input tokens / 1M output tokens.

## Scoring

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
- GPT-5.6 ships in three tiers (Sol / Terra / Luna). Sol requests above 272K input tokens are billed at a higher long-context rate (10.00 / 45.00).
- Kimi K3 always reasons (`reasoning_effort` locked to max) and reasoning tokens bill as output tokens; cached input is 0.30.
- Hy3 prices use the listed OpenRouter rate for `tencent/hy3` (first-party Tencent Cloud pricing is ~0.15 / 0.59).
- MiniMax M3 doubles to 0.60 / 2.40 as a step function when a request's input crosses 512K tokens.
- GLM prices use the listed OpenRouter rates for `z-ai/glm-5.1` and `z-ai/glm-4.7-flash`.
- Nemotron prices use the listed OpenRouter rates for `nvidia/nemotron-3-ultra-550b-a55b` and `nvidia/nemotron-3-super-120b-a12b`.
- `conversation` estimates how natural, coherent, and useful the model feels in multi-turn chat, separate from raw reasoning or coding strength.
- `imageGeneration` measures native image-output capability, not just image understanding.

## Providers

- OpenRouter: Great deafult if you only have to pick one. Breadth across labs, easy access to open-weight and niche models, provider routing, and aggressive price/performance options.
- OpenAI: Strong reasoning, reliable tool calling, structured outputs, good coding, and mature production ergonomics.
- Anthropic: Great for UI coding and spending a lot of money.
- Google: Best for vision-heavy workflows, large context windows, and fast multimodal models that are cheap enough for broad deployment.
- Cerebras: Best when raw speed matters most, especially for high-throughput inference and low-latency open-model serving.
- Groq: Best for extremely fast token generation, responsive chat UX, and cheap real-time workloads where latency dominates.
- Cloudflare Workers AI: Best when you want inference close to the edge, simple deployment inside Cloudflare, and tight integration with Worker-based apps.

## Data

```json
{
	"models": [
		{
			"name": "GPT-5.6 Sol",
			"bestFor": "Premium heavy work",
			"price": "5.00 / 30.00",
			"scores": {
				"reasoning": 4,
				"coding": 4,
				"toolUse": 4,
				"instructionFollowing": 4,
				"longContext": 4,
				"vision": 4,
				"imageGeneration": 0,
				"structuredOutput": 4,
				"speed": 2,
				"costEfficiency": 1,
				"reliability": 4,
				"conversation": 3
			},
			"summary": "OpenAI's top GPT-5.6 tier: frontier reasoning, coding, and tool use with a ~1M context window (128K max output). Expensive — reserve it for coordinator/heavy work where the quality difference pays for itself; input beyond 272K bills at the long-context rate."
		},
		{
			"name": "GPT-5.6 Luna",
			"bestFor": "Lighter agent work — run reasoning on high",
			"price": "1.00 / 6.00",
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
				"costEfficiency": 4,
				"reliability": 4,
				"conversation": 3
			},
			"summary": "Cost-optimized GPT-5.6 tier for routing, extraction, summarization, and discrete subagents. On default effort it is throughput-oriented; set reasoning effort HIGH for agent work — it closes most of the gap to Terra while staying far cheaper (higher effort simply bills more output tokens)."
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
			"name": "Claude Opus 4.6",
			"bestFor": "Long-running coding agents",
			"price": "5.00 / 25.00",
			"scores": {
				"reasoning": 4,
				"coding": 4,
				"toolUse": 4,
				"instructionFollowing": 3,
				"longContext": 3,
				"vision": 3,
				"imageGeneration": 0,
				"structuredOutput": 4,
				"speed": 2,
				"costEfficiency": 1,
				"reliability": 3,
				"conversation": 4
			},
			"summary": "Premium 1M-context model optimized for long-running coding, multi-step agent workflows, and high-reliability execution."
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
			"name": "GLM 5.1",
			"bestFor": "Value long-horizon agents",
			"price": "0.95 / 3.15",
			"scores": {
				"reasoning": 3,
				"coding": 3,
				"toolUse": 2,
				"instructionFollowing": 3,
				"longContext": 3,
				"vision": 0,
				"imageGeneration": 0,
				"structuredOutput": 2,
				"speed": 2,
				"costEfficiency": 3,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "Long-horizon text model tuned for extended autonomous tasks, with strong coding and agent performance at relatively low cost. Hy3 undercuts it for pure long-horizon work; GLM keeps the edge when the agent also writes code."
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
