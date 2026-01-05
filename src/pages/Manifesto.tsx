export function Manifesto() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <article className="prose prose-gray max-w-none">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Standard Agents
        </h1>

        <p className="mt-6 text-lg leading-8 text-gray-600">
          The Standard Agent Specification is an open-source standard for
          creating domain-specific agents that are fine-tuned, portable, and
          composable. Any agent that complies with this standard can be
          published directly to npm and installed by any execution environment
          that supports Standard Agents.
        </p>

        <p className="mt-6 text-gray-700">
          The core principles motivating the Standard Agents Specification are:
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-6 text-gray-700">
          <li>Agents should be the atomic unit of AI software — not models.</li>
          <li>Agents should be domain-specific.</li>
          <li>Agents should be vendor-agnostic.</li>
          <li>Agents should be composable.</li>
          <li>Agents should be portable.</li>
        </ol>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-gray-900">
          Why
        </h2>

        <p className="mt-4 text-gray-700">
          AI is advancing in two places: models and agents. Models are
          self-evident: the LLMs often heard about — GPT-5, Opus 4.5, or Kimi-K2.
          Agents are less discussed and more poorly defined — a confusion worth
          ending.
        </p>

        <p className="mt-4 text-gray-700">
          Agents are software responsible for utilizing one or more LLMs to
          achieve an objective given to it by its creator: coding, watering
          plants, or trading oil futures. Fundamentally, agents are
          deterministic software that harnesses the non-deterministic results
          produced by LLMs in pursuit of a business objective.
        </p>

        <p className="mt-4 text-gray-700">
          General-purpose agents, like ChatGPT, have limited utility. They
          cannot power the internal workings of a business without exposure to
          custom external tooling that interfaces with a business's surface
          area. Software engineers already use coding agents like Claude Code,
          Cursor, or Opencode (custom, domain-specific agents) even though the
          underlying model are often the same as ChatGPT or Claude.
        </p>

        <p className="mt-4 text-gray-700">
          The truth is purpose-built agents yield far better results in their
          given domain than general-purpose agents. Despite the religious fervor
          of those proclaiming AGI is close at hand domain-specific agents
          (DSAs) are here to stay. The obvious next question is one Standard
          Agents exists to answer: How do you create a domain-specific agent?
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-gray-900">
          How
        </h2>

        <p className="mt-4 text-gray-700">
          The Standard Agents Specification defines the minimal set of parts
          required to create any agent. Those parts are:
        </p>

        <ol className="mt-4 list-decimal space-y-1 pl-6 text-gray-700">
          <li>A model</li>
          <li>A prompt</li>
          <li>Agent rules</li>
        </ol>

        <p className="mt-4 text-gray-700">
          Typically, Standard Agents also implement:
        </p>

        <ol className="mt-4 list-decimal space-y-1 pl-6 text-gray-700" start={4}>
          <li>Tools</li>
          <li>Hooks</li>
          <li>Endpoints</li>
        </ol>

        <p className="mt-4 text-gray-700">
          These six constituent parts define all Standard Agents and are capable
          of creating any agentic system.
        </p>

        <p className="mt-4 text-gray-700">
          Standard Agents also defines a runtime: TypeScript. There is no need
          to run a full MCP server just to implement a custom tool. Models,
          prompts, rules, tools, hooks, and endpoints are all written in
          TypeScript. Defining a runtime has many benefits:
        </p>

        <ol className="mt-4 list-decimal space-y-1 pl-6 text-gray-700">
          <li>Tools can be executed directly.</li>
          <li>Type safety between component parts.</li>
          <li>Agents can be distributed via package manager.</li>
          <li>Agents can be easily written with coding agents.</li>
          <li>Tools can directly access the runtime state.</li>
        </ol>

        <p className="mt-4 text-gray-700">
          Combined these constraints provide us with a highly reproducible
          environment in which fine-tuned agents can be executed and interop
          with other agents.
        </p>

        <p className="mt-4 text-gray-700">
          Instead of installing an MCP server for Gmail and expecting a model to
          sort out all of those tools from all of the tools in the Shopify MCP
          server Standard Agents suggests having a purpose built Gmail Standard
          Agent that is purpose built to work with gmail. That allows all the
          tools, prompting, and model-specific configuration to be encapsulated,
          distributed, and composed with other agents.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-gray-900">
          Who, When, and Where
        </h2>

        <p className="mt-4 text-gray-700">
          The Standard Agent Specification was published in 2026 by the FormKit
          and Standard Agent Builder team and is MIT licensed.
        </p>

        <ul className="mt-4 list-disc space-y-1 pl-6 text-gray-700">
          <li>
            <a href="#" className="text-blue-600 hover:text-blue-800 underline">
              Continue to read the specification.
            </a>
          </li>
          <li>
            <a href="#" className="text-blue-600 hover:text-blue-800 underline">
              Try Standard Agent Builder yourself.
            </a>
          </li>
        </ul>

        <p className="mt-6 text-gray-700">
          To discuss the specification further, please join us on the{' '}
          <a href="#" className="text-blue-600 hover:text-blue-800 underline">
            Standard Agents discord server
          </a>
          .
        </p>

        <div className="mt-12">
          <a
            href="#"
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          >
            Explore the Specification
          </a>
        </div>
      </article>
    </main>
  )
}
