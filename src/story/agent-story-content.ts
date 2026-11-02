// Started from standardagentbuilder.com app/data/marketing-content.ts; this copy is edited for the specification site.

export interface StoryBullet {
  text: string
  swatch?: "gold" | "rules" | "hooks" | "prompts" | "files" | "exec" | "provider"
}

export interface StoryBeat {
  /** Scene id — see app/utils/agent-story-scenes.ts */
  id: string
  /** The slide's headline. `**…**` marks the gold accent, `_…_` italics. */
  headline: string
  /** Smaller display line under the headline, optional. Same inline marks.
      A blank line (`\n\n`) splits it into paragraphs. */
  subhead?: string
  /** Regular page copy; an array renders as a bullet list, and a blank line
      (`\n\n`) inside a string splits it into paragraphs. Optional. */
  body?: string | (string | StoryBullet)[]
  /** Recording timestamp(s) of quoted words / a reproduced slide, where the
      copy still follows the talk. */
  cite?: string
}

export const agentStory = {
  headline: "How do we create a world where **composable, shareable** agents are the norm?",

  beats: [
    {
      id: "definition",
      headline: "Start with the basics.",
      subhead: "As a **baseline** every agent needs:",
      body: [
        "A model to power it",
        "A system prompt to steer it",
        "Tools for it to describe actions",
        "And an ongoing conversation for context",
      ],
    },
    {
      id: "context",
      headline: "Expand the capabilities.",
      subhead: "Today agents rely on **MCP** servers and **skills** to do real-world work.\n\nBut there’s a problem…",
    },
    {
      id: "inheritance",
      headline: "Context **isn’t free**.",
      subhead: "The larger the scope of your agent, the more expensive the model required to power it. Even the largest, most expensive frontier models eventually hit their limit.\n\nStacking every responsibility into a single entity is **inheritance**, and it inevitably breaks down.",
    },
    {
      id: "composition",
      headline: "But we already know the solution.",
      subhead: "Effective engineering has always been about **composition** over inheritance.",
    },
    {
      id: "specialist",
      headline: "So let’s scope our agents.",
      subhead: "By focusing each agent on a **specific domain**, we will create many agents, each with its own specialty.\n\nWe can then leverage cheaper models, taking advantage of their jaggedness, and limit them to only the capabilities necessary for their work.",
    },
    {
      id: "team",
      headline: "And compose them into effective teams.",
      subhead: "If our agents are built to the same **open standard**, then coordination between them is easy.",
    },
    {
      id: "ideal",
      /* The space is U+00A0, non-breaking: the balancer split "standard"
         from "agent" across two lines, and the pair names the thing the
         whole section is about. Same treatment the intro headline gives
         "domain-specific" with U+2011. */
      headline: "What does a **standard agent** look like?",
      // Each swatch is the accent the illustration hatches that same part
      // with, so a line here pairs with a slab over there.
      body: [
        { text: "**Rules** for limits like how many turns an agent gets.", swatch: "rules" },
        { text: "**Hooks** to inject, compact, and alter context.", swatch: "hooks" },
        { text: "**Sub-prompts** to swap prompt and model for one action.", swatch: "prompts" },
        { text: "**Sub-agents** to hand off tasks to their proper domain.", swatch: "gold" },
        { text: "The exact **provider and model** to guarantee efficacy.", swatch: "provider" },
        { text: "**Storage** for long-lived assets and memory.", swatch: "files" },
        { text: "**Code execution** to (safely) run arbitrary code.", swatch: "exec" },
      ],
    },
    {
      id: "fractal",
      headline: "Agents are made of **agents**.",
      body: "Standard agents are invoked by other agents like any other tool call. Each standard agent maintains its own complete isolated context.\n\nCoding agents can produce standard agents quickly because every architecture and runtime decision is predecided in the open specification.",
    },
    {
      id: "package",
      headline: "**Sharing** becomes easy.",
      body: "Because the _entire_ agent stack is defined in code, packaging and sharing agents is trivial.\n\nEvery standard agent is guaranteed to run in any spec-compliant runtime.",
    },
    {
      id: "registry",
      headline: "An **open marketplace** of agents can flourish.",
      body: "A wide array of community-built agents suddenly becomes just an install command away.\n\nEach agent executes exactly as its original author intended.\n\nAgents can be installed, unpacked, modified, and republished at will, allowing you to adjust them to your specific needs.",
    },
  ] as StoryBeat[],
}
