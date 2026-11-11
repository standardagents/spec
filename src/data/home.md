# The Standard Agent Specification is an <span class="accent"><span class="no-break">open-source</span> standard</span> for creating portable, composable, <span class="no-break">domain-specific</span> agents.

Agents built with this standard can be freely published, installed, and composed with other Standard Agents — and are guaranteed to execute faithfully in all spec-compliant runtimes.

The current version of the specification is {latestVersion}.

## Core Principles

<p class="section-intro">Agents are <em>deterministic</em> software that harnesses the non-deterministic results produced by models in pursuit of a desired objective.</p>

1. Agents should be vendor-agnostic.
2. Agents should be domain-specific.
3. Agents should be coupled to a model.
4. Agents should be composable.
5. Agents should be portable.

## Why Standard Agents?

<p class="section-intro">Because everyone is building agents, but none of us can share them. We believe agents need a standards movement led by practitioners like you — much like the one that grew the early web into the rich ecosystem that we all enjoy today.</p>

<div data-agent-story></div>

## Anatomy of the Specification

<!-- Card icons are from Lucide (https://lucide.dev), ISC License, Copyright (c) Lucide Icons and Contributors. -->

<p class="section-intro">This specification covers every aspect of Standard Agents and the requirements for their runtime. Every part of a Standard Agent is defined in code, allowing your agents to be versioned, packaged, shared, and installed.</p>

### Core Definitions

<div class="component-cards">
  <a class="component-card" href="/latest/specification/providers">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22v-5"/><path d="M15 8V2"/><path d="M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"/><path d="M9 8V2"/></svg>Providers</h4>
    <p>Adapters that translate requests into a provider’s native format and transform responses back.</p>
  </a>
  <a class="component-card" href="/latest/specification/models">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4"/><path d="M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294"/><path d="M17.996 5.125a4 4 0 012.526 5.77"/><path d="M18 18a4 4 0 002-7.465"/><path d="M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517"/><path d="M6 18a4 4 0 01-2-7.465"/><path d="M6.004 5.125a4 4 0 00-2.526 5.77"/></svg>Models</h4>
    <p>The LLM to use, with its capabilities, pricing, and fallback chain.</p>
  </a>
  <a class="component-card" href="/latest/specification/tools">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></svg>Tools</h4>
    <p>Capabilities that a model can call: functions, prompts, and agents.</p>
  </a>
  <a class="component-card" href="/latest/specification/effects">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>Effects</h4>
    <p>Scheduled side effects, such as delayed notifications and background cleanup, that run outside normal tool execution.</p>
  </a>
  <a class="component-card" href="/latest/specification/prompts">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg>Prompts</h4>
    <p>System instructions, a model reference, available tools, and behavior for each model request.</p>
  </a>
  <a class="component-card" href="/latest/specification/handlers">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3"/><path d="M9 11.2h5.7"/></svg>Handlers</h4>
    <p>Functions that take one side’s turns by running code in place of a model.</p>
  </a>
  <a class="component-card" href="/latest/specification/agents">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>Agents</h4>
    <p>Two sides in a conversation, each backed by a human, a prompt, or a handler, with rules for when turns and sessions stop.</p>
  </a>
  <a class="component-card" href="/latest/specification/subagents">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>Subagents</h4>
    <p>Agents composed as children, each running in its own isolated thread.</p>
  </a>
  <a class="component-card" href="/latest/specification/threads">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"/></svg>Threads</h4>
    <p>Instances of an agent, each with its own identity, storage, and lifecycle.</p>
  </a>
  <a class="component-card" href="/latest/specification/users">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>Users (Draft)</h4>
    <p>A proposed scope for durable values, endpoints, event streams, and credential grants owned by a runtime principal.</p>
  </a>
  <a class="component-card" href="/latest/specification/hooks">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/></svg>Hooks</h4>
    <p>Interception points in the execution lifecycle for validation, transformation, and side effects.</p>
  </a>
  <a class="component-card" href="/latest/specification/type-registry">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/></svg>Type Registry</h4>
    <p>Type-safe references to models, prompts, agents, and tools through TypeScript declaration merging.</p>
  </a>
</div>

### Thread Capabilities

<div class="component-cards">
  <a class="component-card" href="/latest/specification/threads/messages">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>Messages</h4>
    <p>The ordered, persistent conversation history of a thread.</p>
  </a>
  <a class="component-card" href="/latest/specification/threads/filesystem">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"/><path d="M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.92-.6H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"/><path d="M3 5a2 2 0 0 0 2 2h3"/><path d="M3 3v13a2 2 0 0 0 2 2h3"/></svg>File System</h4>
    <p>Isolated thread storage for files and images that persists across executions.</p>
  </a>
  <a class="component-card" href="/latest/specification/threads/code-execution">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>Code Execution</h4>
    <p>On-demand JavaScript or TypeScript in an isolated sandbox with explicitly bridged capabilities.</p>
  </a>
  <a class="component-card" href="/latest/specification/threads/runtime-streams">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"/></svg>Runtime Streams</h4>
    <p>An optional capability for live byte streams between agent code and its host.</p>
  </a>
  <a class="component-card" href="/latest/specification/threads/execution-state">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>Execution State</h4>
    <p>Step counts, cancellation, and run status while a thread is active.</p>
  </a>
  <a class="component-card" href="/latest/specification/threads/decisions">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/></svg>Decisions</h4>
    <p>Named, typed questions evaluated against context without advancing the conversation.</p>
  </a>
  <a class="component-card" href="/latest/specification/threads/endpoints">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>Thread Endpoints</h4>
    <p>HTTP APIs for operations on a specific thread.</p>
  </a>
</div>

### Infrastructure and Distribution

<div class="component-cards">
  <a class="component-card" href="/latest/infrastructure/runtime">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>Runtime</h4>
    <p>The execution environment that assembles context, executes tools, enforces stop conditions, and persists state.</p>
  </a>
  <a class="component-card" href="/latest/distribution/packaging">
    <h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg>Packaging</h4>
    <p>Self-contained npm packages that make agents installable and distributable.</p>
  </a>
</div>

## Frequently Asked Questions

<div class="faq-list">
  <details class="faq-item" name="faq">
    <summary>What language are Standard Agents written in?</summary>
    <p>Agents, prompts, models, tools, and hooks are all written in <strong>TypeScript</strong>. It is the default language of the web, it has types, and it can run anywhere, which makes it a strong fit for tools.</p>
    <p>This defined execution environment lets tools run directly in the runtime and access thread state, with no separate server to operate. Tools install with their agent through a package manager and behave the same way in every spec-compliant runtime.</p>
  </details>

  <details class="faq-item" name="faq">
    <summary>Does a Standard Agents runtime need to be written in TypeScript?</summary>
    <p><strong>No.</strong> A runtime can be written in any language, as long as it can execute TypeScript.</p>
  </details>

  <details class="faq-item" name="faq">
    <summary>Why not skills or MCP?</summary>
    <p>Skills and MCP have real uses and can add value to an agent. On their own, they do not make an agent composable or shareable. The specification defines the complete agent, including its model, prompt, tools, and hooks, so that it can be packaged, installed, and composed with other agents.</p>
  </details>
</div>

## Get Started

<a href="/runtimes" class="cta-card runtime-cta">
  <svg class="cta-icon icon-lg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/></svg>
  <span class="cta-label">Runtimes</span>
  <span class="cta-title">Choose a runtime to build with</span>
  <span class="cta-description">A runtime executes Standard Agents. Choose one to create a project and build your first agent. An agent that follows the specification runs the same way in each runtime.</span>
  <span class="runtime-cta-action">View available runtimes<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span>
</a>

<div class="footer-cta">
  <a href="https://discord.gg/GrdTtPZq7V" class="cta-card">
    <svg class="cta-icon icon-lg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9ca3af"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
    <span class="cta-label">Community</span>
    <span class="cta-title">Join the Discord</span>
    <span class="cta-description">Discuss the spec and connect with other builders.</span>
  </a>
  <a href="https://github.com/standardagents/spec/issues" class="cta-card">
    <svg class="cta-icon icon-lg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9ca3af"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
    <span class="cta-label">Contribute</span>
    <span class="cta-title">Open an Issue or PR</span>
    <span class="cta-description">Propose changes to the specification on GitHub.</span>
  </a>
  <a href="/latest/specification/providers" class="cta-card">
    <svg class="cta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" fill="#9ca3af"><path d="M44.06,0v44.08H0v105.92h105.93v-44.07h44.07V0H44.06ZM19.09,130.91c-16.47-16.47-5.29-54.45,24.96-85.18v60.2h60.23c-30.73,30.27-68.71,41.47-85.2,24.98ZM105.93,104.29v-60.21h-60.21C76.46,13.8,114.42,2.6,130.91,19.09c16.51,16.49,5.31,54.47-24.98,85.2Z"/></svg>
    <span class="cta-label">Read</span>
    <span class="cta-title">Continue to the Specification</span>
    <span class="cta-description">Learn about providers, models, tools, and more.</span>
  </a>
</div>
