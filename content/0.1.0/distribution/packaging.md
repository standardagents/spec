# Packaging

Standard Agents can be packaged into self-contained npm packages, making them installable and distributable. Each packed agent includes all its dependencies (prompts, tools, models, hooks) in a single module.

## Entry Point Exports

The package entry point exports named registries for each definition type, plus a `__meta` export with package metadata:

```typescript
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

Every definition is wrapped in an async function (`DefinitionLoader<T>`) that returns a Promise. This enables tree-shaking, faster startup, and on-demand loading of large tool implementations.

```typescript
type DefinitionLoader<T> = () => Promise<T>;

// Usage
const searchTool = await tools.search();
```

### PackedExports Interface

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

## package.json Requirements

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
  "peerDependencies": {
    "@standardagents/spec": ">=0.1.0"
  }
}
```

The `standardagent` field marks this as a Standard Agent package and declares which agents are entry points. The `keywords` array **MUST** include `"standardagent"` for discovery.

### PackedMeta

The `__meta` export provides package information at runtime:

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

## Namespace Isolation

Packed agents operate in isolated namespaces, preventing conflicts with the host application and other packages.

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

## Discovery

Runtimes discover packed agents by:

1. Scanning `node_modules` for packages with `"standardagent"` in `package.json`
2. Checking local `agents/packed/` directory for development packages
3. Importing each package and reading `__meta` for configuration

## Naming Conventions

- Package names **SHOULD** start with `standardagent-`
- Agent, tool, and prompt names use `snake_case`
- Only expose agents that should be callable from outside as entry points
- Internal helper agents **SHOULD NOT** be entry points
