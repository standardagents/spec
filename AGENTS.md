# standardagentspec.com

Standard Agent Specification website - documentation for the Standard Agent Specification.

## Stack

- Astro v5, TypeScript
- Tailwind CSS v4
- React 19 (islands for interactive components)
- Cloudflare Pages (deploy via `wrangler pages deploy dist`)

## Commands

```bash
pnpm dev      # Start dev server
pnpm build    # Build for production (static)
pnpm preview  # Preview production build
pnpm deploy   # Deploy to Cloudflare Pages
```

`pnpm dev` and `pnpm build` clear Astro's generated caches first. This avoids stale content-store warnings in long-lived worktrees when content files are renamed or moved.

## Architecture

### Content Collections

Markdown files in `content/` are loaded via Astro's Content Layer API. Version folders (e.g., `0.1.0/`) contain grouped documentation.

```
content/
├── 0.1.0/            # published and immutable — do not edit
└── 0.2.0/            # current version ("sides are backings")
    ├── getting-started/
    │   └── examples.md
    ├── specification/
    │   ├── providers.md
    │   ├── models.md
    │   ├── tools.md
    │   ├── effects.md
    │   ├── prompts.md
    │   ├── handlers.md      # new in 0.2.0
    │   ├── agents.md
    │   ├── subagents.md     # new in 0.2.0
    │   ├── threads.md
    │   ├── threads/
    │   │   ├── messages.md
    │   │   ├── filesystem.md
    │   │   ├── code-execution.md
    │   │   ├── execution-state.md
    │   │   ├── decisions.md
    │   │   └── endpoints.md
    │   ├── hooks.md
    │   └── type-registry.md
    ├── infrastructure/
    │   ├── providers.md
    │   └── runtime.md
    └── distribution/
        └── packaging.md
```

The homepage at `/` is the Overview of every current version and lives in
`src/data/home.md`, outside the version folders. Only specification pages are
versioned. Archived versions keep their own Overview. Homepage and Community
links to specification pages use `/latest/`, which resolves to the latest
version at build time. The Community page at `/community`, which includes
governance, lives in `src/data/community.md`, and every version's navigation links to it.

Older version folders are archived, immutable content. Edit only the current
version's folder; the version selector and `llms.txt` derive the latest
version automatically from the folder names.

Do not add per-version changelog pages. Document behavior in the relevant
specification pages.

Keep specification contracts provider- and runtime-neutral. Application logging
is an implementation concern; document AgentBuilder logging and provider-native
conversion examples in their own package documentation, not this specification.

### Source Structure

```
src/
├── components/
│   ├── Header.tsx         # React island (mobile menu, version selector, theme)
│   ├── Sidebar.astro      # Static navigation, fixed to the viewport's left edge
│   ├── TableOfContents.astro # Floating "On this page" card
│   ├── DocColumn.astro    # Body column of a documentation page
│   ├── AgentStory.tsx     # Canvas story on the homepage
│   ├── PageActions.astro  # Latest-version doc actions (copy/view markdown)
│   ├── LogoMark.astro     # Icon-only SVG
│   └── mdx/
│       └── Callout.astro  # Tip/Note/Warning callouts
├── layouts/
│   ├── BaseLayout.astro   # Main HTML layout with theme script
│   └── DocLayout.astro    # Header, sidebar, contents card, and footer around a page
├── diagrams/              # Inline SVG diagrams for documentation pages
├── lib/
│   ├── content.ts         # Navigation helpers using getCollection
│   ├── nav-icons.ts       # Sidebar group icons
│   ├── file-viewer-client.js      # Small script that file viewers inline
│   ├── rehype-file-viewers.mjs    # Builds file viewers from code fences
│   ├── rehype-inline-diagrams.mjs # Inlines src/diagrams files at build time
│   └── remark-faux-threads.mjs    # Renders ```thread fences as static threads
├── pages/
│   ├── index.astro                    # Homepage, rendered from src/data/home.md
│   ├── index.md.ts                    # Homepage raw markdown
│   ├── community.astro                # Community page, rendered from src/data/community.md
│   ├── community.md.ts                # Community raw markdown
│   ├── [...slug].md.ts                # Raw markdown endpoint
│   ├── llms.txt.ts                    # Latest-version markdown doc index for LLMs
│   ├── models.md.ts                   # Live curated models markdown endpoint
│   ├── api/navigation/[version].json.ts
│   └── [version]/
│       ├── index.astro                # Redirect to default page
│       └── [...slug].astro            # Dynamic doc pages
├── data/
│   ├── home.md             # Version-independent homepage content
│   ├── community.md        # Version-independent community and governance content
│   └── models.md           # Curated live model guidance consumed by /models.md
├── styles/
│   └── global.css         # Tailwind + prose styles
└── content.config.ts      # Content collections definition
```

### Diagrams, File Viewers, and Faux Threads

Each section of the Examples page shows a diagram, then a file viewer, then its
write-up. The page's raw Markdown endpoint keeps every code block and file path.
Without script, every link still jumps to its file and every file stays readable.

- **Diagrams:** `<figure data-diagram="name" aria-label="..."></figure>` in
  Markdown inlines `src/diagrams/name.html` through
  `src/lib/rehype-inline-diagrams.mjs`. A missing file fails the build. The
  `aria-label` is the diagram's description, and the raw Markdown keeps it. Each
  file defines its nodes once in `<defs>`, and its wide and narrow layouts place
  them. Use flat `.dg-*` classes in `global.css`, because Firefox does not match
  descendant selectors inside `<use>` clones. See the comment in
  `src/diagrams/issue-triage.html` for links to files.
- **File viewers:** `<div data-file-viewer>` around a section's fences builds one
  viewer through `src/lib/rehype-file-viewers.mjs`. Each code fence must start with
  a comment that names its path. A viewer holds every file its section needs to run
  and no other file, so a file may repeat across viewers. A section's links open
  files only in that section's viewer. A file in a folder outside `agents/`, such
  as a CI workflow, has its own group in the tree. A YAML fence names its path with a
  `#` comment. A file with no folder, such as `package.json`, sits at the tree's top
  level.
  Its client code is `src/lib/file-viewer-client.js`, and it must stay small and
  free of dependencies.
- **File links:** a Markdown link such as
  ``[`sessionStop`](agents/agents/issue_triage.ts#sessionStop)`` opens that file in
  the section's viewer and highlights the definition. A diagram node does the same
  with `data-file` and `data-mark`. A link to an unknown file or definition fails
  the build. Link only what a file declares. A default, a runtime status, or an
  injected tool stays static, even when a related line exists.
- **Faux threads:** a ` ```thread ` fence renders as an illustration of a
  conversation through `src/lib/remark-faux-threads.mjs`, which documents the line
  format. Inside a viewer, the thread is the first view and the default. A thread
  must show only behavior the specification defines. It reads as a conversation:
  a person's bubble, the model's text, one quiet line for each tool call or pause,
  and a row that opens a child thread. A message from a side that no person backs,
  or from a handler or an effect, shows its sender's name. A tool line aligns with
  the side that made the call, and a `tool b` line marks a call from side B. A child thread is its own view under Thread
  in the viewer, and the raw Markdown keeps it inside its parent's fence. The
  diagram and write-up explain rules and runtime behavior, so a thread has no such
  notes. A tool line's arguments and result stay behind a native disclosure.

The specification does not define a folder layout. The viewers show AgentBuilder's
layout with the `agents/` folder as their root, and one sentence in the page's
introduction says so. Code comments and file links keep the full path. Keep these
visuals free of captions, tags, and other meta notes.

Astro's content layer caches rendered Markdown. Restart `pnpm dev` after you edit
a diagram file, a plugin, or the viewer's client code.

### React Islands

The client-side React islands are:

- `Header.tsx` (`client:load`) for the mobile menu, version dropdown, and theme
  toggle.
- `InviteGate.tsx` (`client:load`) for Spec early-access validation.
- `AgentStory.tsx` (`client:visible`) for the canvas story on the homepage,
  placed at the `data-agent-story` marker in `src/data/home.md`. Its scene code lives in `src/story/` and was
  ported from `standardagentbuilder.com`, using this site's fonts and colors.

The production gate on `standardagentspec.org` accepts only Spec site-access codes from
`https://agents.standardagentbuilder.com/api/site-access/:code`. Standard Code
keys and Standard Agents Platform signup invites are separate products and do
not unlock the Spec. The unified admin's **Spec** action silently assigns a code
to a waitlist email, while **Mint Spec** creates unassigned codes for manual
handoff. Successful codes are stored in `localStorage` as `sab_spec_invite`.
Platform invitation emails include the separate Spec code and link here with
that code in the `?invite=` query parameter, which `InviteGate.tsx` validates
before storing it.

All other components are static Astro components rendered at build time.

### Client-side Navigation

The site stays fully static. `ClientRouter` in `BaseLayout.astro` swaps pages without
a document load, and it prefetches links on hover. Pages swap with no animation.

- The access wall comes first. The inline head script in `BaseLayout.astro` runs once
  and stays in place. It sets the gate state on each incoming document in
  `astro:before-swap`, so a swap cannot show content before `InviteGate` hydrates and
  checks access. Keep this logic in that head script.
- That script also carries the theme class, sidebar scroll position, and scroll
  behavior across swaps, because a swap replaces the attributes on `<html>`.
- Page scripts use `onPage(key, setup)` from `src/lib/page-lifecycle.ts`. The setup
  runs on every page view. It returns a cleanup function for anything attached to
  `document` or `window`. A bundled script runs only once, so do not put page setup at
  the top level of a script.
- Islands mount again with new props after each swap, and their effects must clean up.
- A file viewer's inline scripts use `data-astro-rerun`. The router handles viewer
  links as hash links, so it owns their history entries. The viewer restores the
  scroll position after the router's hash scroll.
- Links to non-HTML routes load normally, because the router falls back to a document
  load for them. Link to a page with `ClientRouter`, and avoid the redirect page at
  `/{version}`, which forces a document load.

### Theme System

Dark/light mode is handled via inline script in BaseLayout (no React context):
- Theme preference stored in localStorage
- `html.dark` class toggles styles
- `window.toggleTheme()` and `window.getTheme()` exposed globally

### Adding New Pages

1. Create markdown file in `content/{version}/{group}/`
2. First `# Heading` becomes the page title.
3. File automatically available at `/{version}/{group}/{slug}`

Navigation order is controlled by the `NAV_ORDER` constant in `src/lib/content.ts`.

### Subagent Documentation Scope

As of 0.2.0, subagent behavior lives on the dedicated
[Subagents](content/0.2.0/specification/subagents.md) page (a subagent is any
agent composed as a child via a side-declared relationship). Supporting docs:

- `specification/agents.md` — sides/backings, definition-time errors, human-in-the-loop composition, `parentHooks`
- `specification/subagents.md` — `SubagentRelationship`, ownership, lifecycle doctrine, lifecycle tools (`subagents`, `subagent_create`, `subagent_message`)
- `specification/handlers.md` — handler-backed sides and their child access
- `specification/threads.md` — thread hierarchy, queue, termination; `notifyParent` / `setStatus` / `stopSession`
- `infrastructure/runtime.md` — execution/copying semantics

When subagent behavior changes, update each of these together.

### Packability and Runtime Portability

A packed Standard Agent is an ordinary, shareable package, not a privileged
client of a particular runtime. Required agent behavior must be expressible
through the specification and must work without private runtime RPCs, storage
schemas, bindings, undocumented events, product sidecars that replace runtime
behavior, or `_notPackableRuntimeContext`.

When a reusable agent needs a missing runtime capability, specify the
runtime-neutral primitive and its conformance requirements before a product
depends on an implementation. Keep optional runtime enhancements explicitly
capability-detected and preserve a conforming baseline when they are absent.
Update the implementation types/JSDoc, scaffolded project documentation, and
all affected public specification pages together.

### Callout Syntax

Use blockquote callouts in markdown:

```markdown
> Note: Regular information callout

> Tip: Helpful suggestion callout

> Warning: Important warning callout
```

These render as styled callout boxes via the Callout.astro component.
