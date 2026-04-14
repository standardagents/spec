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
- GLM prices use the listed OpenRouter rates for `z-ai/glm-5.1`, `z-ai/glm-4.7`, and `z-ai/glm-4.7-flash`.
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
			"name": "GPT-5.4",
			"bestFor": "Premium all-around work",
			"price": "2.50 / 15.00",
			"scores": {
				"reasoning": 4,
				"coding": 4,
				"toolUse": 4,
				"instructionFollowing": 4,
				"longContext": 3,
				"vision": 4,
				"imageGeneration": 0,
				"structuredOutput": 4,
				"speed": 2,
				"costEfficiency": 2,
				"reliability": 4,
				"conversation": 3
			},
			"summary": "High-capability general model with strong reasoning, coding, tool use, multimodal input, and long-context performance."
		},
		{
			"name": "GPT-5.4 mini",
			"bestFor": "High-throughput production",
			"price": "0.75 / 4.50",
			"scores": {
				"reasoning": 3,
				"coding": 2,
				"toolUse": 3,
				"instructionFollowing": 3,
				"longContext": 2,
				"vision": 2,
				"imageGeneration": 0,
				"structuredOutput": 2,
				"speed": 3,
				"costEfficiency": 3,
				"reliability": 4,
				"conversation": 2
			},
			"summary": "Smaller, faster GPT-5.4 variant with strong coding and tool-use performance at materially lower cost."
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
			"name": "Kimi K2.5",
			"bestFor": "Cheap high-end agent work",
			"price": "0.60 / 3.00",
			"scores": {
				"reasoning": 3,
				"coding": 2,
				"toolUse": 2,
				"instructionFollowing": 3,
				"longContext": 3,
				"vision": 3,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 3,
				"costEfficiency": 4,
				"reliability": 3,
				"conversation": 4
			},
			"summary": "256K-context multimodal model with thinking mode, tool calls, JSON mode, and strong price-performance for agent workloads."
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
			"summary": "Long-horizon text model tuned for extended autonomous tasks, with strong coding and agent performance at relatively low cost."
		},
		{
			"name": "GLM 4.7",
			"bestFor": "Cheap general use, pretty descent reasoning. Does a good job at tool discernment, struggles with instruction following and making well formatted tool calls (needs a fallback).",
			"price": "0.39 / 1.75",
			"scores": {
				"reasoning": 3,
				"coding": 2,
				"toolUse": 2,
				"instructionFollowing": 2,
				"longContext": 2,
				"vision": 0,
				"imageGeneration": 0,
				"structuredOutput": 2,
				"speed": 3,
				"costEfficiency": 4,
				"reliability": 2,
				"conversation": 2
			},
			"summary": "Mid-tier text model with balanced coding, reasoning, and instruction performance plus strong cost efficiency."
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
			"name": "Gemini 2.5 Flash",
			"bestFor": "Conversation, tool calling, speed.",
			"price": "0.30 / 2.50",
			"scores": {
				"reasoning": 2,
				"coding": 2,
				"toolUse": 2,
				"instructionFollowing": 2,
				"longContext": 4,
				"vision": 3,
				"imageGeneration": 0,
				"structuredOutput": 4,
				"speed": 4,
				"costEfficiency": 4,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "Fast 1M-context multimodal model with strong cost efficiency, descent tool use, and low latency. Good for simple agents, goes off track with long context."
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
			"name": "MiniMax M2.7",
			"bestFor": "Coding agents on a budget",
			"price": "0.30 / 1.20",
			"scores": {
				"reasoning": 3,
				"coding": 3,
				"toolUse": 3,
				"instructionFollowing": 3,
				"longContext": 3,
				"vision": 0,
				"imageGeneration": 0,
				"structuredOutput": 3,
				"speed": 3,
				"costEfficiency": 3,
				"reliability": 3,
				"conversation": 3
			},
			"summary": "Agent-oriented model with strong coding and reasoning performance, moderate latency, and very strong price-performance."
		},
		{
			"name": "GPT-OSS-120B",
			"bestFor": "Cheap deployable open model",
			"price": "0.039 / 0.190",
			"scores": {
				"reasoning": 2,
				"coding": 2,
				"toolUse": 2,
				"instructionFollowing": 2,
				"longContext": 2,
				"vision": 0,
				"imageGeneration": 0,
				"structuredOutput": 2,
				"speed": 4,
				"costEfficiency": 4,
				"reliability": 2,
				"conversation": 2
			},
			"summary": "Low-cost open-weight model with descent structured output and tool-use support, optimized for cheap deployable workloads. Acceptable discernment."
		}
	]
}
```

