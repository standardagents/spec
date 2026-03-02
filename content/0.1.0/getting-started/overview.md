# Overview

The Standard Agent Specification is an open-source standard for creating domain-specific agents that are fine-tuned, portable, and composable. Any agent that complies with this standard can be published directly to npm and installed by any execution environment that supports Standard Agents.

Composable systems in this spec include parent/child subagents: autonomous `dual_ai` child threads that can be spawned, messaged, and resumed with durable communication and attachment copying guarantees.

## Core Principles

1. Agents are the atomic unit of AI software — not models.
2. Agents should be domain-specific.
3. Agents should be vendor-agnostic.
4. Agents should be composable.
5. Agents should be portable.

## Why?

AI is advancing in two places: models and agents. Models are self-evident: the LLMs often heard about — GPT-5, Opus 4.5, or Kimi-K2. Agents are less discussed and more poorly defined — a confusion worth ending.

Agents are software responsible for utilizing one or more LLMs to achieve an objective given to it by its creator: coding, watering plants, or trading oil futures.

<blockquote class="pullquote">Agents are <em>deterministic</em> software that harnesses the non-deterministic results produced by LLMs in pursuit of a business objective.</blockquote>

General-purpose agents, like ChatGPT, have broad but limited utility. They cannot power the internal workings of a business without exposure to custom external tooling that interfaces with a business's surface area. The answer isn't Model Context Protocol (MCP) it's domain specific agents (DSAs). Software engineers already use DSAs: coding agents. Claude Code, Cursor, or Opencode (custom, domain-specific agents) are all examples of agents that are more useful for software engineers than ChatGPT or Claude — despite using the same models.

The truth is purpose-built agents yield far better results in their given domain than general-purpose agents. Despite the religious fervor of those proclaiming AGI is close at hand domain-specific agents (DSAs) are here to stay. Standard Agents exists to answer the obvious next question: How do you create a domain-specific agent?

## How?

The Standard Agents Specification defines the minimal set of parts required to create any agent:

<div class="component-cards">
  <div class="component-card">
    <h4>Model</h4>
    <p>The LLM provider and model configuration that powers the agent's intelligence.</p>
  </div>
  <div class="component-card">
    <h4>Prompt</h4>
    <p>System instructions that define the agent's personality, capabilities, and behavior.</p>
  </div>
  <div class="component-card">
    <h4>Agent Rules</h4>
    <p>Constraints and guidelines that govern how the agent operates and responds.</p>
  </div>
</div>

Typically, Standard Agents also implement:

<div class="component-cards">
  <div class="component-card">
    <h4>Tools</h4>
    <p>Functions the agent can call to interact with external systems and perform actions.</p>
  </div>
  <div class="component-card">
    <h4>Hooks</h4>
    <p>Lifecycle callbacks that run before or after agent actions for customization.</p>
  </div>
  <div class="component-card">
    <h4>Endpoints</h4>
    <p>HTTP interfaces that expose the agent's capabilities to external applications.</p>
  </div>
</div>

These six constituent parts define all Standard Agents and are capable of creating any agentic system.

Standard Agents also defines a runtime: TypeScript. There is no need to run a full MCP server just to implement a custom tool. Models, prompts, rules, tools, hooks, and endpoints are all written in TypeScript. Defining a runtime has many benefits:

<ul class="benefits-list">
  <li>Tools can be executed directly.</li>
  <li>Type safety between component parts.</li>
  <li>Agents can be distributed via package manager.</li>
  <li>Agents can be easily written with coding agents.</li>
  <li>Tools can directly access the runtime state.</li>
</ul>

Combined these constraints provide us with a highly reproducible environment in which fine-tuned agents can be executed and interop with other agents.

Instead of installing an MCP server for Gmail and expecting a model to sort out all its tools from all of the tools in the Shopify MCP server Standard Agents suggests having a purpose built Gmail Standard Agent that allows all the tools, prompting, and model-specific configuration to be encapsulated, distributed, and composed with other agents.

<div class="comparison-cards">
  <div class="comparison-card not-recommended">
    <div class="comparison-label">MCP Approach</div>
    <h4>Install generic MCP servers</h4>
    <ul>
      <li>Install separate MCP servers for Gmail, Shopify, etc.</li>
      <li>Model must sort through all tools from all servers</li>
      <li>No domain-specific prompting or optimization</li>
      <li>Efficacy scales inversely with available tools</li>
    </ul>
  </div>
  <div class="comparison-card recommended">
    <div class="comparison-label">Standard Agents</div>
    <h4>Purpose-built agents</h4>
    <ul>
      <li>Each agent encapsulates tools, prompts, and model config</li>
      <li>Domain-specific optimization for its task</li>
      <li>Easily distributed and composed with other agents</li>
      <li>Seamless hand-off of thread context between agents</li>
    </ul>
  </div>
</div>

## Frequently Asked Questions

<div class="faq-list">
  <details class="faq-item">
    <summary>Why TypeScript?</summary>
    <p>A portable specification needs a baseline runtime that can execute almost anywhere. Without that baseline, implementations tend to depend on full server stacks (as in many MCP deployments). JavaScript is the most widely supported deployment target and can be sandboxed effectively, so it is a practical foundation. TypeScript then provides compile-time guarantees for both developers and LLM-authored code. Rather than maintaining custom validators, standard typechecking provides a simpler and more reliable contract.</p>
  </details>

  <details class="faq-item">
    <summary>Why not MCP?</summary>
    <p>MCP typically exposes one general agent to a broad tool surface, with limited tuning between model behavior, prompting strategy, and tool design. As the tool surface expands, quality and reliability often decline. Standard Agents takes a compositional approach: many focused agents, each tuned as a coherent unit across model, prompt, hooks, and tools, then orchestrated together. We did not land on the moon by giving one person every tool. We built teams of specialists.</p>
  </details>

  <details class="faq-item">
    <summary>Why not skills?</summary>
    <p>Skills add useful context, and they can improve outcomes, but they still depend on a large general model to interpret and solve problems at runtime. This creates a similar scaling challenge to MCP: more context does not automatically produce better composition. Standard Agents composes complete, task-focused agent units rather than only adding instructions. We did not land on the moon by giving one person more documentation. We built coordinated teams.</p>
  </details>

  <details class="faq-item">
    <summary>Is Standard Agents a framework or a specification?</summary>
    <p>It is an open source specification. Anyone can build or use a compatible runtime to execute any compliant agent. <a href="https://standardagentbuilder.com">AgentBuilder</a> is one such implementation.</p>
  </details>

  <details class="faq-item">
    <summary>What is the difference between a handoff and a subagent?</summary>
    <p>A handoff reassigns control of the same thread to another <code>ai_human</code> agent. A subagent creates a new child thread using a <code>dual_ai</code> agent.</p>
  </details>

  <details class="faq-item">
    <summary>How do environment variables resolve at runtime?</summary>
    <p>Resolution is layered: thread, user account, instance, agent defaults, then prompt defaults. Scoped variables can block parent inheritance for the branches that declare them.</p>
  </details>

  <details class="faq-item">
    <summary>What does “immediate” mean for tools and subagents?</summary>
    <p>Immediate tools run as soon as the prompt becomes active, before the first model step. This includes immediate subagent tool entries when they are enabled.</p>
  </details>

  <details class="faq-item">
    <summary>Can optional subagent branches be enabled per thread?</summary>
    <p>Yes. Optional subagent branches are controlled by environment flags (for example <code>true</code>, <code>1</code>, or <code>yes</code>) and can be enabled or disabled per thread instance.</p>
  </details>
</div>

## Who, When, and Where?

The Standard Agent Specification was published in 2026 by the FormKit and Standard Agent Builder team and is MIT licensed.

<div class="footer-cta">
  <a href="/0.1.0/specification/providers" class="cta-card primary">
    <svg class="cta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" fill="#9ca3af"><path d="M44.06,0v44.08H0v105.92h105.93v-44.07h44.07V0H44.06ZM19.09,130.91c-16.47-16.47-5.29-54.45,24.96-85.18v60.2h60.23c-30.73,30.27-68.71,41.47-85.2,24.98ZM105.93,104.29v-60.21h-60.21C76.46,13.8,114.42,2.6,130.91,19.09c16.51,16.49,5.31,54.47-24.98,85.2Z"/></svg>
    <span class="cta-label">Get Started</span>
    <span class="cta-title">Continue to the Specification</span>
    <span class="cta-description">Learn about providers, models, tools, and more.</span>
  </a>
  <a href="https://standardagentbuilder.com" class="cta-card">
    <svg class="cta-icon icon-lg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" fill="#9ca3af"><path opacity="0.5" d="M133.816,92.912L108.064,59.193C103.573,53.307 101.473,45.937 102.197,38.566L105.475,5.046L99.553,4.466L96.312,37.643C95.895,41.808 91.44,44.27 87.71,42.369L30.34,13.394L27.659,18.7L84.686,47.494C87.184,48.762 87.076,52.347 84.504,53.452L0.387,89.671L2.741,95.139L86.189,59.211C88.76,58.106 91.422,60.587 90.48,63.231L62.918,141.119L68.532,143.111L96.384,64.408C97.507,61.257 101.672,60.605 103.7,63.249L129.107,96.498L133.834,92.876L133.816,92.912Z"/><path d="M133.925,90.214L107.648,7.346C106.036,2.257 100.875,-0.821 95.624,0.193L32.64,12.344C29.959,12.869 27.605,14.408 26.066,16.6C25.523,17.36 25.07,18.211 24.744,19.117L0.622,86.284C-0.917,90.594 0.459,95.375 4.081,98.164L59.568,141.137C61.469,142.604 63.733,143.346 66.015,143.346C68.079,143.346 70.144,142.731 71.937,141.517L129.832,102.111C133.707,99.468 135.355,94.687 133.943,90.232L133.925,90.214ZM116.92,85.922L47.127,53.923C44.374,52.673 43.994,48.925 46.421,47.132L94.175,11.873C97.416,9.483 102.034,10.95 103.284,14.771C108.173,29.548 118.64,62.054 124.218,79.457C125.631,83.876 121.121,87.859 116.902,85.94L116.92,85.922ZM79.162,15.567L42.455,42.659C40.083,44.415 36.696,43.057 36.189,40.16L33.781,26.342C33.038,22.05 35.845,17.94 40.119,17.089C49.409,15.241 65.254,12.145 76.681,9.917C79.995,9.265 81.879,13.557 79.162,15.567ZM29.126,34.238L31.716,49.069C31.915,50.21 31.607,51.388 30.865,52.275L16.559,69.587C15.291,71.127 12.846,69.732 13.516,67.849L25.704,33.93C26.32,32.21 28.8,32.427 29.126,34.22L29.126,34.238ZM12.882,83.386L29.543,63.231C31.517,60.84 35.356,61.547 36.352,64.499L56.308,123.661C57.322,126.668 53.809,129.149 51.31,127.193C41.223,119.297 24.4,106.132 14.404,98.164C9.84,94.542 9.152,87.878 12.864,83.386L12.882,83.386ZM63.498,126.305L43.161,66.002C42.056,62.706 45.407,59.681 48.576,61.13L117.337,92.677C121.375,94.524 121.864,100.083 118.206,102.6C107.358,110.061 88.326,123.064 76.826,130.815C71.991,134.074 65.381,131.829 63.516,126.305L63.498,126.305Z"/></svg>
    <span class="cta-label">Build</span>
    <span class="cta-title">Try AgentBuilder</span>
    <span class="cta-description">Build your first Standard Agent. Free for local dev.</span>
  </a>
  <a href="https://discord.gg/GrdTtPZq7V" class="cta-card">
    <svg class="cta-icon icon-lg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9ca3af"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
    <span class="cta-label">Community</span>
    <span class="cta-title">Join the Discord</span>
    <span class="cta-description">Discuss the spec and connect with other builders.</span>
  </a>
</div>
