# standardagentspec.com

Standard Agent Specification website - documentation and manifesto for the Standard Agents spec.

## Stack

- React 19, Vite, TypeScript
- Tailwind CSS v4
- Cloudflare Pages (deploy via `wrangler pages deploy dist`)

## Commands

```bash
pnpm dev      # Start dev server
pnpm build    # Build for production
pnpm deploy   # Deploy to Cloudflare Pages
```

## Architecture

### Content-Driven Pages

Markdown files in `content/` are the **source of truth** for page content. They're imported as raw strings via Vite's `?raw` suffix and rendered with `react-markdown`.

```
content/
├── manifesto-0.1.0.md    # Manifesto content
└── ...                   # Future spec pages
```

### Source Structure

```
src/
├── components/
│   ├── Logo.tsx          # LogoMark and Logo SVG components
│   └── Markdown.tsx      # Markdown renderer with custom styling
├── pages/
│   └── Manifesto.tsx     # Imports and renders markdown
├── App.tsx
└── main.tsx
```

### Markdown Rendering

The `<Markdown>` component provides:
- **Lede styling**: First paragraph gets larger, muted text
- **Custom typography**: Consistent heading, list, and link styles
- **Code blocks**: Syntax-highlighted with dark theme

Import markdown files with `?raw`:
```tsx
import content from '../../content/page.md?raw'
<Markdown>{content}</Markdown>
```

### Adding New Pages

1. Create markdown in `content/`
2. Create page component in `src/pages/` that imports it
3. Add route in `App.tsx` (when routing is added)

## Logo Components

From `src/components/Logo.tsx`:
- `<LogoMark />` - Icon only (the "standard chart" symbol)
- `<Logo />` - Full wordmark with icon

Both use `fill="currentColor"` so they inherit text color via Tailwind classes like `text-gray-900`.
