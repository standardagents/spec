# Standard Agents

The Standard Agent Specification is an open-source standard for creating domain-specific agents that are fine-tuned, portable, and composable. Any agent that complies with this standard can be published directly to npm and installed by any execution environment that supports Standard Agents.

The core principles motivating the Standard Agents Specification are:

1. Agents should be the atomic unit of AI software — not models.
2. Agents should be domain-specific.
3. Agents should be vendor-agnostic.
4. Agents should be composable.
5. Agents should be portable.

## Why

AI is advancing in two places: models and agents. Models are self-evident: the LLMs often heard about — GPT-5, Opus 4.5, or Kimi-K2. Agents are less discussed and more poorly defined — a confusion worth ending.

Agents are software responsible for utilizing one or more LLMs to achieve an objective given to it by its creator: coding, watering plants, or trading oil futures. Fundamentally, agents are deterministic software that harnesses the non-deterministic results produced by LLMs in pursuit of a business objective.

General-purpose agents, like ChatGPT, have broad but limited utility. They cannot power the internal workings of a business without exposure to custom external tooling that interfaces with a business's surface area. The answer isn't Model Context Protocol (MCP) it's domain specific agents (DSAs). Software engineers already use DSAs: coding agents. Claude Code, Cursor, or Opencode (custom, domain-specific agents) are all examples of agents that are more useful for software engineers than ChatGPT or Claude — despite using the same models.

The truth is purpose-built agents yield far better results in their given domain than general-purpose agents. Despite the religious fervor of those proclaiming AGI is close at hand domain-specific agents (DSAs) are here to stay. Standard Agents exists to answer the obvious next question: How do you create a domain-specific agent?

## How

The Standard Agents Specification defines the minimal set of parts required to create any agent. Those parts are:

- A model
- A prompt
- Agent rules

Typically, Standard Agents also implement:

- Tools
- Hooks
- Endpoints

These six constituent parts define all Standard Agents and are capable of creating any agentic system.

Standard Agents also defines a runtime: TypeScript. There is no need to run a full MCP server just to implement a custom tool. Models, prompts, rules, tools, hooks, and endpoints are all written in TypeScript. Defining a runtime has many benefits:

- Tools can be executed directly.
- Type safety between component parts.
- Agents can be distributed via package manager.
- Agents can be easily written with coding agents.
- Tools can directly access the runtime state.

Combined these constraints provide us with a highly reproducible environment in which fine-tuned agents can be executed and interop with other agents.

Instead of installing an MCP server for Gmail and expecting a model to sort out all its tools from all of the tools in the Shopify MCP server Standard Agents suggests having a purpose built Gmail Standard Agent that allows all the tools, prompting, and model-specific configuration to be encapsulated, distributed, and composed with other agents.

## Who, When, and Where

The Standard Agent Specification was published in 2026 by the FormKit and Standard Agent Builder team and is MIT licensed.

- Continue to read the specification.
- Try Standard Agent Builder yourself.

To discuss the specification further, please join us on the Standard Agents discord server. 

Explore the Specification
