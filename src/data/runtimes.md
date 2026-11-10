# Runtimes

<p class="section-intro">A runtime executes Standard Agents. Anyone can build one, and an agent package that follows the specification runs the same way in each of them.</p>

The <a href="/latest/infrastructure/runtime">Runtime</a> page defines what a runtime must do. This page lists the runtimes you can use today.

## Available Runtimes

<div class="runtime-list">
  <a href="https://standardagents.ai" class="cta-card runtime-card">
    <span class="cta-label">Runtime</span>
    <span class="cta-title">Standard Agents Builder</span>
    <span class="cta-description">A runtime and builder interface from Standard Agents, the team that maintains this specification. It runs on Cloudflare Workers.</span>
  </a>
  <a href="#submit-a-runtime" class="cta-card runtime-card is-open">
    <span class="cta-label">Open</span>
    <span class="cta-title">Your runtime</span>
    <span class="cta-description">This list is meant to grow. Submit a runtime through Discord or by pull request.</span>
  </a>
</div>

Runtimes appear in alphabetical order. A listing is not an endorsement, and it does not certify conformance.

## Submit a Runtime

The list is open to every runtime that implements the specification, whoever builds it. An entry needs three things:

- The runtime's name.
- A link to its public home page or documentation.
- One factual sentence that describes it.

You can submit an entry in either of two ways:

- **Discord.** Post the three details in the [Discord](https://discord.gg/GrdTtPZq7V). Anyone can do this. A maintainer opens the pull request for you.
- **Pull request.** Open a pull request against the [specification repository](https://github.com/standardagents/standardagentspec.com) that adds a card to the list in `src/data/runtimes.md`, in alphabetical order. This needs access to the repository.

A listed runtime must be available for other people to use, and its entry must stay factual. The maintainers review an entry for accuracy only. They do not rank runtimes.
