<div align="center">
  <img src="public/favicon.svg" alt="Standard Agents logo" width="72">
  <h1>Standard Agent Specification</h1>
  <p>An open standard for portable, composable, domain-specific agents.</p>
  <p>
    <a href="https://standardagentspec.org/">Specification</a> ·
    <a href="https://standardagentspec.org/runtimes">Runtimes</a> ·
    <a href="https://standardagentspec.org/community">Community</a>
  </p>
</div>

## About

The Standard Agent Specification defines agents and the requirements for their runtimes. It covers agent components, execution, and packaging. Agents built with the specification can be published, installed, and composed with other Standard Agents. The specification is for people and coding agents building or reviewing agents, runtimes, and tools.

This repository contains the specification text in `content/` and the Astro site that publishes it. The current specification version is 0.2.0.

## Documentation

Read the [overview](https://standardagentspec.org/) for the principles and structure of the specification. The documentation includes [examples](https://standardagentspec.org/0.2.0/getting-started/examples), [agent definitions](https://standardagentspec.org/0.2.0/specification/agents), [runtime requirements](https://standardagentspec.org/0.2.0/infrastructure/runtime), and [packaging](https://standardagentspec.org/0.2.0/distribution/packaging). The [documentation index for coding agents](https://standardagentspec.org/llms.txt) links to the current specification pages.

## Runtimes

A runtime executes Standard Agents. An agent package that follows the specification runs the same way in each runtime.

| Runtime | Description |
| --- | --- |
| [Standard Agents Builder](https://standardagents.ai) | A runtime and builder interface from Standard Agents. It runs on Cloudflare Workers. |
| Your runtime | The list is open to every runtime that implements the specification. [Submit yours](https://standardagentspec.org/runtimes#submit-a-runtime). |

To add a runtime, open a pull request that adds it to `src/data/runtimes.md`, or post its details in [Discord](https://discord.gg/GrdTtPZq7V). The [runtimes page](https://standardagentspec.org/runtimes#submit-a-runtime) lists what an entry needs.

## Contributing

Propose a change through a GitHub [issue](https://github.com/standardagents/spec/issues) or [pull request](https://github.com/standardagents/spec/pulls). Maintainers review proposals and publish accepted changes in a new specification version. The [community page](https://standardagentspec.org/community) describes governance and links to Discord for discussion.

## Local development

Install dependencies with pnpm:

```sh
pnpm install
```

Start the local development server:

```sh
pnpm dev
```

Build the static site with `pnpm build`. Run `pnpm test` to build the site and run its tests.

## License

The specification is published under the MIT License.
