# Packaging

Standard Agents can be packaged into self-contained npm packages, making them installable and distributable. Each packed agent includes all its dependencies (prompts, tools, models, hooks) in a single TypeScript module.

## Package Format

Packed agents use a single entry point architecture with lazy-loaded definitions:

```
standardagent-my-workflow/
├── src/
│   └── index.ts          # All definitions inline
├── dist/
│   ├── index.js          # Compiled JavaScript
│   └── index.d.ts        # Type definitions
├── package.json          # npm metadata + standardagent field
└── tsconfig.json         # Build configuration
```

### Entry Point Structure

The `src/index.ts` exports named registries for each definition type:

```typescript
// Packed agent: my-workflow
import type {
  AgentDefinition,
  PromptDefinition,
  ToolDefinition,
  ModelDefinition,
  PackedMeta,
} from '@standardagents/spec';

export const agents = {
  my_agent: async (): Promise<AgentDefinition> => ({
    name: 'my_agent',
    type: 'ai_human',
    title: 'My Agent',
    sideA: { prompt: 'main_prompt' },
  }),
} as const;

export const prompts = {
  main_prompt: async (): Promise<PromptDefinition> => ({
    name: 'main_prompt',
    model: 'gpt_4o',
    prompt: 'You are a helpful assistant...',
    tools: ['search'],
  }),
} as const;

export const tools = {
  search: async (): Promise<ToolDefinition> => ({
    description: 'Search for information',
    execute: async (state, args) => {
      return { status: 'success', result: 'Found results' };
    },
  }),
} as const;

export const models = {
  gpt_4o: async (): Promise<ModelDefinition> => ({
    name: 'gpt_4o',
    model: 'gpt-4o',
    provider: 'openai',
  }),
} as const;

export const hooks = {} as const;

export const __meta: PackedMeta = {
  packageId: 'standardagent-my-workflow',
  version: '1.0.0',
  entryAgents: ['my_agent'],
  packedAt: 1705012800000,
};
```

### Lazy Loading

Every definition is wrapped in an async function (`DefinitionLoader<T>`) that returns a Promise. This enables:

- **Tree-shaking**: Unused definitions aren't loaded
- **Startup performance**: Only load what's needed
- **Memory efficiency**: Large tool implementations load on demand

```typescript
type DefinitionLoader<T> = () => Promise<T>;

// Usage
const searchTool = await tools.search();
```

## Package Metadata

### PackedMeta Export

The `__meta` export provides package information, replacing the legacy `manifest.json`:

```typescript
export interface PackedMeta {
  /** Unique package identifier (npm name or local identifier) */
  packageId: string;
  /** Package version (semver) */
  version: string;
  /** Entry agents exposed as tools (visible from outside) */
  entryAgents: string[];
  /** When the package was packed (timestamp in milliseconds) */
  packedAt: number;
  /** Optional description */
  description?: string;
}
```

### package.json Configuration

Packed agents are identified by the `standardagent` field in `package.json`:

```json
{
  "name": "standardagent-my-workflow",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "keywords": ["standardagent"],
  "standardagent": {
    "entryAgents": ["my_agent"]
  },
  "files": ["dist"],
  "peerDependencies": {
    "@standardagents/spec": ">=0.1.0"
  }
}
```

The `standardagent` field marks this as a Standard Agent package and declares which agents are entry points.

## Namespace Isolation

Packed agents operate in isolated namespaces, preventing conflicts with the host application and other packages.

### Namespace Contexts

```typescript
// Global namespace - unpacked code
interface GlobalNamespaceContext {
  type: 'global';
}

// Packed namespace - code inside a package
interface PackedNamespaceContext {
  type: 'packed';
  packageId: string;
}
```

### Visibility Rules

| From \ To | Unpacked | Same Package | Entry Agents | Other Package Internals |
|-----------|----------|--------------|--------------|------------------------|
| **Global** | Yes | - | Yes | No |
| **Packed** | No | Yes | Yes | No |

- **Global code** sees unpacked definitions and packed entry points
- **Packed code** sees only its own package contents plus other entry points
- **Internal tools/prompts** in a package are hidden from outside

### Package Signature

Each packed definition receives a signature marking its package membership:

```typescript
interface PackageSignature {
  packageId: string;
  version: string;
  source: 'npm' | 'local';
  packedAt: number;
}
```

The signature is injected at load time (not baked into source), keeping the packed source clean.

## PackedExports Interface

For type-safe package consumption:

```typescript
import type { PackedExports } from '@standardagents/spec';

const pkg: PackedExports = await import('standardagent-my-workflow');
const meta = pkg.__meta;
const agent = await pkg.agents.my_agent();
```

Full interface:

```typescript
interface PackedExports {
  agents: Record<string, DefinitionLoader<AgentDefinition>>;
  prompts: Record<string, DefinitionLoader<PromptDefinition>>;
  tools: Record<string, DefinitionLoader<ToolDefinition>>;
  models: Record<string, DefinitionLoader<ModelDefinition>>;
  hooks: Record<string, DefinitionLoader<HookSignature>>;
  __meta: PackedMeta;
}
```

## Publishing to npm

### 1. Pack Your Agent

Use the builder CLI to analyze and pack an agent:

```bash
pnpm exec agents pack my_agent --output ./packed
```

This:
- Analyzes the agent's dependencies (prompts, tools, models, hooks)
- Generates `src/index.ts` with all definitions inline
- Creates `package.json` with `standardagent` field
- Compiles to `dist/`

### 2. Review the Package

Check the generated package structure:

```bash
ls -la ./packed/standardagent-my-agent/
# src/index.ts      - Source with all definitions
# dist/index.js     - Compiled output
# dist/index.d.ts   - Type definitions
# package.json      - npm metadata
```

### 3. Publish

```bash
cd ./packed/standardagent-my-agent
npm publish
```

## Installing Packed Agents

### From npm

```bash
pnpm add standardagent-my-workflow
```

The runtime automatically discovers packages with the `standardagent` keyword or field.

### From Local Path

For development or private packages, install from local path:

```bash
pnpm add ./packed/standardagent-my-workflow
```

## Versioning

Packed agents follow [semantic versioning](https://semver.org/):

- **MAJOR**: Breaking changes to agent behavior or API
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes

The version is stored in both `package.json` and `__meta.version`.

## Discovery

Runtimes discover packed agents by:

1. Scanning `node_modules` for packages with `"standardagent"` in `package.json`
2. Checking local `agents/packed/` directory for development packages
3. Importing each package and reading `__meta` for configuration

```typescript
// Discovery result
interface DiscoveredPackage {
  packageId: string;
  version: string;
  source: 'npm' | 'local';
  path: string;
  entryAgents: string[];
}
```

## Type Definitions

Packed agents include TypeScript definitions for type-safe consumption:

```typescript
// dist/index.d.ts
import type {
  AgentDefinition,
  PromptDefinition,
  ToolDefinition,
  ModelDefinition,
  PackedMeta,
} from '@standardagents/spec';

type DefinitionLoader<T> = () => Promise<T>;

export declare const agents: {
  readonly my_agent: DefinitionLoader<AgentDefinition>;
};

export declare const prompts: {
  readonly main_prompt: DefinitionLoader<PromptDefinition>;
};

export declare const tools: {
  readonly search: DefinitionLoader<ToolDefinition>;
};

export declare const models: {
  readonly gpt_4o: DefinitionLoader<ModelDefinition>;
};

export declare const hooks: {};

export declare const __meta: PackedMeta;
```

## Best Practices

### Naming Conventions

- Package names should start with `standardagent-`
- Agent/tool/prompt names use `snake_case`
- Use descriptive names that indicate purpose

### Entry Points

- Only expose agents that should be callable from outside
- Internal helper agents should not be entry points
- Use `exposeAsTool: true` on entry agents for tool-based invocation

### Dependencies

- Packed agents should be self-contained
- Avoid dependencies on global tools/prompts
- External npm dependencies are allowed (e.g., API clients)

### Testing

Before publishing, test your packed agent:

```bash
# Pack the agent
pnpm exec agents pack my_agent --output ./packed

# Install locally
pnpm add ./packed/standardagent-my-agent

# Test in your application
```
