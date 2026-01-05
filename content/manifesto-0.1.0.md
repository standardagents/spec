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

General-purpose agents, like ChatGPT, have limited utility. They cannot power the internal workings of a business without exposure to custom external tooling that interfaces with a business's surface area. Software engineers already use coding agents like Claude Code, Cursor, or Opencode (custom, domain-specific agents) even though the underlying model are often the same as ChatGPT or Claude.

The truth is purpose-built agents yield far better results in their given domain than general-purpose agents. Despite the religious fervor of those proclaiming AGI is close at hand domain-specific agents (DSAs) are here to stay. The obvious next question is one Standard Agents exists to answer: How do you create a domain-specific agent?

## How

The Standard Agents Specification defines the minimal set of parts required to create any agent. Those parts are:

1. A model
2. A prompt
3. Agent rules

Typically, Standard Agents also implement:

4. Tools
5. Hooks
6. Endpoints

These six constituent parts define all Standard Agents and are capable of creating any agentic system.

Standard Agents also defines a runtime: TypeScript. There is no need to run a full MCP server just to implement a custom tool. Models, prompts, rules, tools, hooks, and endpoints are all written in TypeScript. Defining a runtime has many bennefits:

1. Tools can be executed directly.
2. Type safety between component parts.
3. Agents can be distributed via package manager.
4. Agents can be easily written with coding agents.
5. Tools can directly access the runtime state.

Combined these constraints provide us with a highly reproducable environment in which fine-tuned agents can be executed and interop with other agents.

Instead of installing an MCP server for Gmail and expecting a model to sort out all of those tools from all of the tools in the Shopify MCP server Standard Agents suggests having a purpose built Gmail Standard Agent that is purpose built to work with gmail. That allows all the tools, prompting, and model-specific configuration to be encapsulated, distributed, and composed with other agents.

## Who, When, and Where

The Standard Agent Specification was published in 2026 by the FormKit and Standard Agent Builder team and is MIT licensed.

- Continue to read the specification.
- Try Standard Agent Builder yourself.

To discuss the specification further, please join us on the Standard Agents discord server. 

Explore the Specification
