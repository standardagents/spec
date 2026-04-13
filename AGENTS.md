# standardagentspec.com

Standard Agent Specification website - documentation for the Standard Agents spec.

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
└── 0.1.0/
    ├── getting-started/
    │   └── overview.md
    ├── guides/
    │   └── agent-guide.md
    ├── specification/
    │   ├── providers.md
    │   ├── models.md
    │   ├── tools.md
    │   ├── prompts.md
    │   ├── agents.md
    │   ├── subagents.md
    │   ├── threads.md
    │   ├── hooks.md
    │   └── type-registry.md
    ├── infrastructure/
    │   ├── providers.md
    │   └── runtime.md
    └── distribution/
        └── publishing.md
```

### Source Structure

```
src/
├── components/
│   ├── Header.tsx         # React island (mobile menu, version selector, theme)
│   ├── Sidebar.astro      # Static navigation
│   ├── Logo.astro         # Full wordmark SVG
│   ├── LogoMark.astro     # Icon-only SVG
│   └── mdx/
│       └── Callout.astro  # Tip/Note/Warning callouts
├── layouts/
│   └── BaseLayout.astro   # Main HTML layout with theme script
├── lib/
│   └── content.ts         # Navigation helpers using getCollection
├── pages/
│   ├── index.astro                    # Redirect to latest version
│   ├── [...slug].md.ts                # Raw markdown endpoint
│   ├── models.md.ts                   # Live curated models markdown endpoint
│   ├── api/navigation/[version].json.ts
│   └── [version]/
│       ├── index.astro                # Redirect to default page
│       └── [...slug].astro            # Dynamic doc pages
├── data/
│   └── models.md           # Curated live model guidance consumed by /models.md
├── styles/
│   └── global.css         # Tailwind + prose styles
└── content.config.ts      # Content collections definition
```

### React Islands

Only `Header.tsx` uses client-side React (`client:load` directive) for:
- Mobile menu toggle
- Version dropdown
- Theme toggle (calls `window.toggleTheme()`)

All other components are static Astro components rendered at build time.

### Theme System

Dark/light mode is handled via inline script in BaseLayout (no React context):
- Theme preference stored in localStorage
- `html.dark` class toggles styles
- `window.toggleTheme()` and `window.getTheme()` exposed globally

### Adding New Pages

1. Create markdown file in `content/{version}/{group}/`
2. First `# Heading` becomes the page title
3. File automatically available at `/{version}/{group}/{slug}`

Navigation order is controlled by the `NAV_ORDER` constant in `src/lib/content.ts`.

### Subagent Documentation Scope

Subagent behavior is documented across:
- `specification/subagents.md` (overview + lifecycle matrix + communication)
- `specification/agents.md` (`sessionStop`/`sessionFail`/`sessionStatus`)
- `specification/tools.md` (`SubagentToolConfig`, lifecycle tools)
- `specification/threads.md` (thread hierarchy + queue + termination surfaces)
- `infrastructure/runtime.md` (execution/copying semantics)

When subagent behavior changes, update all of these pages together.

### Callout Syntax

Use blockquote callouts in markdown:

```markdown
> Note: Regular information callout

> Tip: Helpful suggestion callout

> Warning: Important warning callout
```

These render as styled callout boxes via the Callout.astro component.
