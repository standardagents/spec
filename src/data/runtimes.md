# Runtimes

<p class="section-intro">A runtime executes Standard Agents. Anyone can build one, and an agent package that follows the specification runs the same way in each of them.</p>

The <a href="/latest/infrastructure/runtime">Runtime</a> page defines what a runtime must do. This page lists the runtimes you can use today.

## Available Runtimes

<div class="runtime-list">
  <a href="https://standardagents.ai" class="cta-card runtime-card">
    <svg class="runtime-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" fill="currentColor" role="img" aria-label="Standard Agents logo"><path d="M44.06,0v44.08H0v105.92h105.93v-44.07h44.07V0H44.06ZM19.09,130.91c-16.47-16.47-5.29-54.45,24.96-85.18v60.2h60.23c-30.73,30.27-68.71,41.47-85.2,24.98ZM105.93,104.29v-60.21h-60.21C76.46,13.8,114.42,2.6,130.91,19.09c16.51,16.49,5.31,54.47-24.98,85.2Z"/></svg>
    <span class="cta-label">Runtime</span>
    <span class="cta-title">Standard Agents Builder</span>
    <span class="cta-description">A runtime and builder interface from Standard Agents, the team that maintains this specification. It runs on Cloudflare Workers.</span>
  </a>
  <a href="#submit-a-runtime" class="cta-card runtime-card is-open">
    <span class="runtime-logo is-placeholder" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg></span>
    <span class="cta-label">Open</span>
    <span class="cta-title">Your runtime</span>
    <span class="cta-description">This list is meant to grow. Submit a runtime through Discord or by pull request.</span>
  </a>
</div>

Runtimes appear in alphabetical order. A listing is not an endorsement, and it does not certify conformance.

## Submit a Runtime

The list is open to every runtime that implements the specification, whoever builds it. An entry needs four things:

- The runtime's name.
- A link to its public home page or documentation.
- One factual sentence that describes it.
- A square logo as an SVG file. It must stay legible at 40 pixels in light and dark themes.

You can submit an entry in either of two ways:

- **Discord.** Post the four details in the [Discord](https://discord.gg/GrdTtPZq7V). Anyone can do this. A maintainer opens the pull request for you.
- **Pull request.** Open a pull request against the [specification repository](https://github.com/standardagents/standardagentspec.com) that adds a card with its logo to the list in `src/data/runtimes.md`, in alphabetical order. This needs access to the repository.

A listed runtime must be available for other people to use, and its entry must stay factual. The maintainers review an entry for accuracy only. They do not rank runtimes.
