# Packaging

Standard Agents can be packaged into self-contained npm packages, making them installable and distributable. Each packed agent includes all its dependencies (prompts, tools, models, hooks, handlers, effects) in a single module.

A package **MUST** include the handlers referenced by its agents. Packers discover a tool's named invocation dependencies from its `uses` declaration. A package **MUST** include the required tool dependencies declared there.

## Portability requirements

A packed agent's required behavior must be expressible through surfaces defined
by this specification. Packed definitions MUST NOT require private runtime
RPCs, implementation-specific storage schemas or bindings, undocumented
events, sidecar services that substitute for runtime behavior, or
`_notPackableRuntimeContext`.

Runtime-specific enhancements MAY be capability-detected and optional, but the
package's declared agents and required dependencies MUST execute correctly when
those enhancements are absent. When an agent category needs a new runtime
primitive, that primitive belongs in the specification and its conformance
surface rather than in a product-private package/runtime agreement.

Authentication, billing, deployment, and branded client services may remain
outside an agent package. They MUST NOT be necessary for the installed agent's
core execution semantics unless the package explicitly declares the external
service as part of the agent's purpose rather than as a replacement for a
missing runtime capability.

## Entry Point Exports

The package entry point exports named registries for each definition type, plus a `__meta` export with package metadata:

```typescript
import type {
  AgentDefinition,
  HandlerDefinition,
  PromptDefinition,
  ToolDefinition,
  ModelDefinition,
  PackedMeta,
} from '@standardagents/spec';

type DefinitionLoader<T> = () => Promise<T>;

export const agents = {
  my_agent: async (): Promise<AgentDefinition> => ({
    name: 'my_agent',
    title: 'My Agent',
    sideA: { prompt: 'main_prompt' },
    sideB: { human: true },
  }),
} as const;

export const handlers = {} as Record<string, DefinitionLoader<HandlerDefinition>>;

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

export const hooks = {
  limit_messages: async () => ({
    hook: 'filter_messages' as const,
    id: 'limit_messages',
    execute: async (state: any, messages: any[]) => messages.slice(-50),
  }),
} as const;

export const effects = {
  send_digest: async () => ([
    'Send a digest email',
    null,
    async (state: any) => {
      // effect work
    },
  ]),
} as const;

export const __meta: PackedMeta = {
  packageId: 'standardagent-my-workflow',
  version: '0.3.1',
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
  handlers: Record<string, DefinitionLoader<HandlerDefinition>>;
  prompts: Record<string, DefinitionLoader<PromptDefinition>>;
  tools: Record<string, DefinitionLoader<ToolDefinition>>;
  models: Record<string, DefinitionLoader<ModelDefinition>>;
  hooks: Record<string, DefinitionLoader<HookDefinitionResult<HookName>>>;
  effects?: Record<string, DefinitionLoader<EffectDefinition<any, any>>>;
  threadEndpoints?: Record<string, DefinitionLoader<MarkedThreadEndpoint | Controller>>;
  __meta: PackedMeta;
}
```

## package.json Requirements

Packed agents are identified by the `standardagent` field in `package.json`:

```json
{
  "name": "standardagent-my-workflow",
  "version": "0.3.1",
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
    "entryAgents": ["my_agent"],
    "effects": ["send_digest", "cleanup"],
    "threadEndpoints": ["status.get", "admin/sync.post"]
  },
  "peerDependencies": {
    "@standardagents/spec": ">=0.2.0"
  }
}
```

The `standardagent` field marks this as a Standard Agent package. Its sub-fields:

- `entryAgents` declares callable entry agents.
- `effects` (optional) lists packed effect names.
- `threadEndpoints` (optional) lists packed thread endpoint keys.
- `parentHooks` (optional) duplicates required parent-hook disclosures keyed by
  entry agent so a marketplace or installer can show composition effects
  without importing executable package code.

The `keywords` array **MUST** include `"standardagent"` for discovery.

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
  /** Required parent-hook disclosures keyed by entry agent */
  parentHooks?: Record<string, ParentHookRequirement[]>;
}
```

Packers **MUST** include every hook referenced by an entry agent's
`parentHooks`, even when no prompt or agent `hooks` array references it, and
**MUST** reproduce those declarations in both `__meta.parentHooks` and
`package.json.standardagent.parentHooks`. Hook code remains inert after package
installation; the declarations activate only when a host composes the entry
agent into an enabled direct child relationship.

## Namespace Isolation

Each packed agent's definitions are isolated by package ID, preventing name collisions with host code or with other packages.

### Visibility Rules

| From \ To | Unpacked | Same Package | Entry Agents | Other Package Internals |
|-----------|----------|--------------|--------------|------------------------|
| **Global** | Yes | - | Yes | No |
| **Packed** | No | Yes | Yes | No |

- **Global code** sees unpacked definitions and packed entry agents
- **Packed code** sees only its own package contents plus other entry points
- **Internal tools/prompts** in a package are hidden from outside

### Qualified Names

A qualified name has the form `{packageId}/{name}`. Code outside a package uses a qualified name for a packed definition. The [Visibility Rules](#visibility-rules) determine which qualified names resolve.

A scoped package ID contains a slash. For a scoped package, the second slash separates the package ID from the definition name. For example, `@scope/pkg/agent` has package ID `@scope/pkg` and name `agent`. The name `@scope/name` has one slash and is unqualified.

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

Signatures are injected at load time, not embedded in source, so packed definitions remain portable.

## Discovery

Runtimes discover packed agents by:

1. Scanning `node_modules` for packages with `"standardagent"` in `package.json`
2. Checking local `agents/packed/` directory for development packages
3. Importing each package and reading `__meta` for configuration

## Naming Conventions

- Package names **SHOULD** start with `standardagent-`
- Agent, tool, prompt, hook, and effect names use `snake_case`
- Only expose agents that should be callable from outside as entry points
- Internal helper agents **SHOULD NOT** be entry points

## Packed Thread Endpoints

Packed thread endpoints are exported under `threadEndpoints` using endpoint keys like `status.get` or `admin/sync.post`.

Runtimes mount packed thread endpoints beneath the same thread ID prefix used for local thread endpoints. Packed endpoints do not introduce a package-specific URL prefix.

```text
{runtime_prefix}/{threadId}/{endpoint_path}
```

Requests beneath the thread endpoint prefix that do not match any local or packed thread endpoint route MUST return HTTP 404.

## Type Definitions

Packed agents include TypeScript definitions for type-safe consumption:

```typescript
// dist/index.d.ts
import type {
  AgentDefinition,
  HandlerDefinition,
  PromptDefinition,
  ToolDefinition,
  ModelDefinition,
  Controller,
  EffectDefinition,
  HookDefinitionResult,
  MarkedThreadEndpoint,
  PackedMeta,
} from '@standardagents/spec';

type DefinitionLoader<T> = () => Promise<T>;

export declare const agents: {
  readonly my_agent: DefinitionLoader<AgentDefinition>;
};

export declare const handlers: Record<string, DefinitionLoader<HandlerDefinition>>;

export declare const prompts: {
  readonly main_prompt: DefinitionLoader<PromptDefinition>;
};

export declare const tools: {
  readonly search: DefinitionLoader<ToolDefinition>;
};

export declare const models: {
  readonly gpt_4o: DefinitionLoader<ModelDefinition>;
};

export declare const hooks: {
  readonly limit_messages: DefinitionLoader<HookDefinitionResult>;
};

export declare const effects: {
  readonly send_digest: DefinitionLoader<EffectDefinition<any, any>>;
};

export declare const threadEndpoints: {
  readonly "status.get": DefinitionLoader<MarkedThreadEndpoint | Controller>;
};

export declare const __meta: PackedMeta;
```
