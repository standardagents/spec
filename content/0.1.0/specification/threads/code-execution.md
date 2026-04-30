# Code Execution

Code execution lets an agent run JavaScript or TypeScript source on demand inside an isolated sandbox. The sandbox has **no global access** to its host — every capability (`fs`, `fetch`, `console`, custom business logic) is explicitly bridged in through `imports` and `globals`. Results flow back via the export selected by `options.execute` or through bridged "report" callbacks.

This page is the caller-facing contract: how to invoke `runCode`, what options it accepts, what shape the result has, and the **limitations** agent authors need to know when writing code that will run inside the sandbox. For the runtime-side mechanics (isolate setup, enforcement, implementation approaches), see [Runtime §13 Code Execution Runtime](/0.1.0/infrastructure/runtime#13-code-execution-runtime).

## 1. What You Get

When you call `state.runCode(source, options)`:

- The source runs as an ES module in a fresh sandbox with no host capabilities.
- Anything you pass through `options.imports` is resolvable as a bare-specifier import inside the sandbox.
- Anything you pass through `options.globals` is resolvable as a free identifier inside the sandbox.
- `options.execute` chooses which module export to run and which arguments to pass. It defaults to `{ fn: 'default', args: [] }`.
- The call returns a [`CodeExecution` handle](#22-codeexecution-handle) — awaitable, terminatable, with a live `reports` view.
- The spec does not mandate a wall-clock timeout; callers impose their own by calling `handle.terminate()`.

Code execution is not a Node.js runtime, a web runtime, or a Worker runtime. It is a plain ECMAScript evaluator. The surface is identical across host platforms.

## 2. API Surface

Code execution is invoked through `ThreadState.runCode()`, which returns a `CodeExecution` handle. The handle is awaitable and exposes a `terminate()` method for caller-initiated cancellation.

### 2.1 Signature

```typescript
runCode(
  source: string,
  options?: CodeExecutionOptions,
): CodeExecution;
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | `string` | JavaScript or TypeScript source text. Treated as an ECMAScript module. |
| `options` | `CodeExecutionOptions` | Export selection, imports, globals, memory cap, and language hints. |

### 2.2 CodeExecution Handle

```typescript
interface CodeExecution extends PromiseLike<CodeExecutionResult> {
  /** Stop the run. Idempotent. Settles the handle with `status: 'terminated'`. */
  terminate(reason?: string): void;
  /** `true` until the handle settles. */
  readonly running: boolean;
  /** Snapshot of values emitted via the `report` bridge so far, in call order. */
  readonly reports: readonly unknown[];
}
```

- The handle is a `PromiseLike<CodeExecutionResult>`; `await run` yields the final result.
- `terminate(reason?)` stops the run. Subsequent calls are no-ops. When `reason` is provided, it surfaces in `result.error.message`.
- `running` flips to `false` once the handle settles.
- `reports` is a live, append-only view of values emitted via the `report` bridge. The same values appear in `CodeExecutionResult.reports` when the run ends.

Callers that need a time budget layer one on themselves:

```typescript
const run = state.runCode(source, options);
const budget = setTimeout(() => run.terminate('30s budget'), 30_000);
const result = await run;
clearTimeout(budget);
```

### 2.3 Example

```typescript
const run = state.runCode(
  `
    import { readFile } from 'fs';
    import { report } from 'supervisor';

    const message = await getMessage();
    if (/username/.test(message)) {
      report({ topic: 'username', message });
    }

    export async function scan() {
      return { scanned: true };
    }
  `,
  {
    execute: { fn: 'scan', args: [] },
    imports: {
      fs: {
        readFile: async (path: string) => state.readFile(path),
      },
      supervisor: {
        report: (payload: unknown) => {
          // host-side sink
        },
      },
    },
    globals: {
      console: { log: (...args: unknown[]) => {} },
      getMessage: async () => 'latest user message',
    },
  },
);

const result = await run;

if (result.status === 'success') {
  // result.result is the resolved scan() return value: { scanned: true }
}
```

## 3. CodeExecutionOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `execute` | `{ fn?: string; args?: unknown[] }` | `{ fn: 'default', args: [] }` | Export to execute and arguments to pass if the export is a function. Use `fn: 'default'` for the default export. |
| `imports` | `Record<string, Record<string, unknown>>` | `{}` | Map of module specifier → named exports exposed to the sandbox. Resolves bare-specifier imports only. |
| `modules` | `Record<string, string>` | `{}` | Additional relative ES modules available to the sandbox, keyed by relative specifier such as `'./helpers.js'`. |
| `globals` | `Record<string, unknown>` | `{}` | Map of identifier → value installed on the sandbox's module scope. |
| `language` | `'javascript' \| 'typescript'` | `'typescript'` | Source language. TypeScript source is stripped of types before evaluation; no type checking is performed. |
| `memoryLimitBytes` | `number` | runtime-defined | Maximum sandbox heap in bytes. Exceeding this settles the handle with `status: 'memory'`. |
| `filename` | `string` | `'<runCode>'` | Label used in stack traces and error sources. |
| `report` | `(value: unknown) => void` | — | Optional host-side sink invoked for every value emitted through the built-in `report` bridge. Collected values are also exposed on the handle's live `reports` array and in the final `CodeExecutionResult.reports`. |

Unknown keys on `options` are rejected.

Deadlines are **not** an option. The caller implements their own budget by calling `handle.terminate()` ([§2.2](#22-codeexecution-handle)).

### 3.1 Execute

`execute` selects the module export that becomes `CodeExecutionResult.result`.

```typescript
const run = state.runCode(
  `
    export function increment(n: number): number {
      return n + 1;
    }

    export default function fallback() {
      return 123;
    }
  `,
  {
    execute: { fn: 'increment', args: [100] },
  },
);
```

Rules:

- When `execute` is omitted, the runtime behaves as if `{ fn: 'default', args: [] }` was supplied.
- `fn` names the export to execute. Use `'default'` for the default export.
- If the selected export is a function, the runtime calls it with `args` inside the sandbox and awaits any returned thenable.
- If the selected export is not a function, `args` MUST be omitted or empty and the export value itself becomes the result.
- Missing selected exports fail the run with `status: 'link_error'`.
- `args` use the same marshaling rules as other sandbox boundary values.

### 3.2 Imports

`imports` maps a bare specifier to an object of named exports.

```typescript
imports: {
  fs: {
    readFile: async (path) => { /* ... */ },
    writeFile: async (path, data) => { /* ... */ },
  },
}
```

Inside the sandbox:

```typescript
import { readFile, writeFile } from 'fs';
import * as fs from 'fs';          // namespace import of the same object
```

The default export of a bridged module is the value at key `default`:

```typescript
imports: { greeter: { default: (name) => `hi, ${name}` } }
// inside: import greet from 'greeter';
```

Rules:

- Only **bare specifiers** are resolvable (`'fs'`, `'supervisor'`, `'@scope/pkg'`). Relative (`'./x'`) and URL (`'https://…'`) specifiers fail at module link time.
- Specifiers are not resolved from any host package resolver, node_modules, CDN, or virtual module registry — only from `options.imports`.
- Importing an unknown specifier fails linkage.
- Named-export mismatches (`import { x }` where `x` is missing) fail linkage.

### 3.3 Modules

`modules` provides local relative ES modules to the sandbox.

```typescript
const run = state.runCode(
  `
    import { add } from './math.js';
    export const result = add(1, 2);
  `,
  {
    execute: { fn: 'result' },
    modules: {
      './math.js': 'export const add = (a, b) => a + b;',
    },
  },
);
```

Rules:

- Keys MUST be relative specifiers such as `'./helpers.js'` or `'./lib/math.js'`.
- Values are JavaScript or TypeScript module source and are evaluated inside the same sandbox.
- `modules` are not host filesystem reads and do not grant package, URL, CDN, or `node_modules` access.

### 3.4 Globals

`globals` installs identifiers at module scope. They are **not** installed on `globalThis`.

```typescript
globals: {
  console: { log: (...args) => {} },
  getMessage: async () => '...',
}
```

Inside the sandbox:

```typescript
console.log('hi');              // works
const m = await getMessage();   // works
globalThis.console;             // undefined — globals are not on globalThis
```

This distinction matters for the [limitations](#6-limitations) — sandbox code cannot enumerate bridged capabilities via `Object.keys(globalThis)`.

### 3.5 Bridged Value Marshaling

Values cross the sandbox boundary in both directions (host → sandbox via `imports`/`globals`, sandbox → host via call arguments and return values).

| Host value | Sandbox view | Notes |
|-----------|--------------|-------|
| `string`, `number`, `boolean`, `null`, `undefined`, `bigint` | Same primitive | Cloned by value. |
| Plain object / array / `Map` / `Set` / `Date` / typed array | Structured clone | Deep copy; no shared reference. |
| `Function` | Callable proxy | Calls forward serialized args to host; return value (or resolved promise) marshaled back. |
| `Promise` | `Promise` | Resolves/rejects asynchronously inside sandbox. |
| `ArrayBuffer` / `Uint8Array` | Same binary view | Cloned. |
| Class instance, `WeakMap`, `WeakRef`, symbol with host identity | **Not transferable** | May throw a `SerializationError`. |

Bridged functions do not expose host `this` or host closure state to the sandbox beyond their explicit arguments.

Asynchronous bridges are supported: a bridged function may return a `Promise`, and the sandbox's `await` unwraps it.

## 4. CodeExecutionResult

```typescript
interface CodeExecutionResult {
  status: 'success' | 'error' | 'memory' | 'terminated' | 'link_error';
  result?: unknown;
  reports: unknown[];
  logs: CodeExecutionLog[];
  error?: CodeExecutionError;
  durationMs: number;
  memoryUsedBytes?: number;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | Outcome classification. See [§4.1](#41-status-values). |
| `result` | `unknown` | Resolved selected export, after optionally calling it with `execute.args` and awaiting top-level promises. Omitted on non-success outcomes. |
| `reports` | `unknown[]` | Values emitted through the `report` bridge, in call order. Empty array if unused. |
| `logs` | `CodeExecutionLog[]` | Captured `console.*` calls when the runtime installs a capturing `console`. Empty when the caller supplies its own. |
| `error` | `CodeExecutionError` | Present iff `status` is not `'success'`. |
| `durationMs` | `number` | Wall-clock execution time in milliseconds, from `runCode()` invocation to handle settlement. |
| `memoryUsedBytes` | `number` | Peak sandbox heap in bytes when the engine exposes heap-usage measurement; omitted otherwise. |

### 4.1 Status Values

| Status | Meaning |
|--------|---------|
| `success` | Module evaluated; selected export resolved. |
| `error` | Uncaught runtime error inside the sandbox. |
| `memory` | `memoryLimitBytes` exceeded. |
| `terminated` | Caller called `handle.terminate()`, or the runtime's own safety cap fired. `error.message` distinguishes the two (including any `reason` the caller passed). |
| `link_error` | Module graph failed to link (unknown specifier, missing named export, parse error). |

### 4.2 CodeExecutionError

```typescript
interface CodeExecutionError {
  name: string;
  message: string;
  stack?: string;
  /** Module specifier that failed to link, when applicable. */
  specifier?: string;
  /** Source filename associated with line and column, when available. */
  filename?: string;
  /** 1-based line in source, when available. */
  line?: number;
  /** 1-based column in source, when available. */
  column?: number;
}
```

Errors raised by bridged functions are reflected into the sandbox as a regular thrown error. Host-side stack traces do not leak into the sandbox result.

### 4.3 CodeExecutionLog

```typescript
interface CodeExecutionLog {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  args: unknown[];
  timestamp: number;
}
```

Only populated when the runtime installs a capturing `console` (typically when the caller does not provide one via `options.globals`).

## 5. Result Channels

The sandbox has **two** channels for returning data. They coexist and can both be used in the same run.

### 5.1 Configured Export

The canonical success result is the module export selected by `options.execute`. By default this is the module's default export:

```typescript
export default { summary: 'ok', matches: 3 };
```

After module evaluation, the runtime resolves the configured export as follows:

1. Read `module.namespace[execute.fn]`, where `execute.fn` defaults to `'default'`.
2. If it is a function (including an async function), **call it with `execute.args`** inside the sandbox. The result of that call is then processed by step 3.
3. If the current candidate is a `Promise` (or thenable), **await it**. Repeat this step until the value is no longer a thenable.
4. Marshal the final value into `CodeExecutionResult.result`.

All four of these produce the same surface for callers:

```typescript
export default 42;                          // result === 42
export default async () => 42;              // result === 42
export default () => Promise.resolve(42);   // result === 42
export default Promise.resolve(42);         // result === 42
```

Named exports are selected with `execute.fn`:

```typescript
export function increment(n: number) {
  return n + 1;
}

// state.runCode(source, { execute: { fn: 'increment', args: [100] } })
// result === 101
```

If the selected export is missing, the run settles with `status: 'link_error'`. If the selected export is not a function and `execute.args` is non-empty, the run settles with `status: 'error'`. If the selected export function throws (or its returned promise rejects), the run settles with `status: 'error'` and the thrown value in `error.message` — identical to any other uncaught runtime error.

### 5.2 Bridge Reports

For streaming or multi-value output, pass a `report` callback into the sandbox as a bridged function:

```typescript
const run = state.runCode(source, {
  imports: {
    supervisor: {
      report: (payload) => telemetry.push(payload),
    },
  },
});
```

Every `report(x)` call runs the host sink synchronously (or returns its promise).

When `options.report` is supplied, the runtime installs a built-in `report` global that forwards values to it, and pushes each reported value into `CodeExecutionResult.reports` in call order.

Use whichever channel fits: configured export for "this code computes one answer"; reports for "this code scans and flags N things."

## 6. Limitations

These are the things your sandboxed source code **cannot** do. They are a design property of code execution, not a configuration knob.

### 6.1 No Host Capabilities on `globalThis`

The sandbox's `globalThis` contains only ECMAScript intrinsics (`Object`, `Array`, `Promise`, `Math`, `JSON`, `Map`, `Set`, `Date`, `RegExp`, `Error`, typed arrays, `BigInt`, `Symbol`, `Reflect`, `Proxy`, `structuredClone`) plus `globalThis`, `undefined`, `NaN`, `Infinity`.

It does **not** contain `process`, `global`, `window`, `self`, `document`, `require`, `Deno`, `Bun`, `fetch`, `Request`, `Response`, `URL`, `URLSearchParams`, `WebSocket`, `WebAssembly`, `crypto`, `setTimeout`, `setInterval`, `setImmediate`, `performance`, `atob`, `btoa`, `TextEncoder`, or `TextDecoder` — unless the caller explicitly installed one via `globals`.

If your code needs any of those, bridge them in.

### 6.2 No Dynamic Code Loading

Inside the sandbox:

- `eval` is absent or throws.
- `Function`, `AsyncFunction`, and `GeneratorFunction` constructors throw when called with source strings.
- Dynamic `import(...)` only resolves specifiers present in `options.imports` or `options.modules`; URL imports reject.

### 6.3 No Shared Memory With the Host

- No `SharedArrayBuffer`, no `Atomics`, no postMessage-style channels.
- Bridged values cross the boundary by **deep clone** ([§3.5](#35-bridged-value-marshaling)). A sandbox mutation of a received object does not affect the host-side source object.

### 6.4 No Runtime-Imposed Deadline

The spec does not enforce a wall-clock timeout. `handle.terminate()` signals the sandbox to stop at the next yield point — usually a few milliseconds, but a pure-synchronous tight loop may run until the runtime's own safety cap fires.

Callers **SHOULD**:

- wrap untrusted code with their own `setTimeout` + `handle.terminate()`, as shown in [§2.2](#22-codeexecution-handle); and
- where the run may be CPU-bound, treat the platform safety cap as the worst-case upper bound.

### 6.5 Memory Is Capped

If you set `memoryLimitBytes`, exceeding it settles the handle with `status: 'memory'`. If you omit it, a runtime-defined default applies. Plan allocations accordingly.

### 6.6 Timers Are Not Bridged Automatically

The sandbox has a working microtask queue — `Promise`, `await`, and `queueMicrotask` behave normally. But `setTimeout` / `setInterval` are absent unless the caller bridges them.

### 6.7 Nondeterministic Intrinsics Are Present

`Date.now()` and `Math.random()` work inside the sandbox and are nondeterministic. If you need determinism, bridge deterministic replacements through `globals`.

### 6.8 Each Run Is Fresh

Every call to `runCode` gets its own isolate. State — module caches, intrinsic mutations, top-level variables — does **not** carry over between runs. If you need persistence, write to thread storage through a bridged function.

## 7. TypeScript Support

When `language` is `'typescript'` (the default):

- The runtime accepts TypeScript source.
- Types are erased before evaluation. Type errors are ignored — only syntax errors block linkage.
- `import type`, `export type`, `satisfies`, `as`, generics, enums, and namespaces are all accepted at the erasure layer.
- `tsconfig.json` is **not** consulted. No path aliases, no `paths`, no `baseUrl`.

When `language` is `'javascript'`, the source is parsed as standard ECMAScript modules with no transformation.

## 8. Module Semantics

- Source is evaluated as an **ES module**. `import`, `export`, and top-level `await` are available.
- There is one entry module per `runCode` call plus any caller-supplied `options.modules`.
- `imports` entries are synthetic modules: their namespace is a frozen copy of the host-provided object.
- `modules` entries are source-backed ES modules available by relative specifier.
- `import.meta` exposes only `{ url: string }` where `url` is a synthetic `sandbox:<filename>` URL. Host paths are not exposed.

## 9. Interaction With Thread State

`runCode` is a method on `ThreadState`. It runs on behalf of a thread, but the sandbox **does not** receive `state` implicitly. If you want the sandbox to read thread messages, files, or env, bridge the specific capabilities you want to expose:

```typescript
await state.runCode(source, {
  imports: {
    thread: {
      readFile: (path) => state.readFile(path),
      getMessages: (opts) => state.getMessages(opts),
      emit: (event, data) => state.emit(event, data),
    },
  },
});
```

This is intentional: bridges are a capability boundary. Leaking `state` would let sandboxed code invoke arbitrary tools, mutate thread env, or terminate the thread — the opposite of what isolation means.

Bridged functions run on the host side and can await thread operations, schedule effects, emit events, or call tools.

## 10. Usage Patterns

### 10.1 Single-Value Computation

```typescript
const { result } = await state.runCode(
  `
    const n = input.reduce((a, b) => a + b, 0);
    export default n;
  `,
  { globals: { input: [1, 2, 3] } },
);
// result === 6
```

### 10.2 Flagging Multiple Items

```typescript
const result = await state.runCode(
  `
    import { report } from 'supervisor';
    for (const row of rows) {
      if (row.flagged) report(row.id);
    }
  `,
  {
    globals: { rows: await loadRows() },
    imports: {
      supervisor: { report: (id) => flaggedIds.add(id) },
    },
  },
);
```

### 10.3 Running Model-Authored Code With a Deadline

```typescript
const userCode = llmResponse.code; // untrusted, produced by an LLM
const run = state.runCode(userCode, {
  memoryLimitBytes: 64 * 1024 * 1024,
  globals: {
    input: await state.readFile('/data/input.json'),
  },
});

const deadline = setTimeout(() => run.terminate('2s budget'), 2_000);
const result = await run;
clearTimeout(deadline);

if (result.status !== 'success') {
  // surface result.error to the model as a tool error
}
```

### 10.4 Composing With Tools

Custom tools can be thin wrappers around `runCode`:

```typescript
export default defineTool({
  description: 'Evaluate an expression against thread data',
  args: z.object({ code: z.string() }),
  execute: async (state, { code }) => {
    const run = state.runCode(code, {
      imports: {
        thread: { readFile: (p) => state.readFile(p) },
      },
    });
    const deadline = setTimeout(() => run.terminate('2s budget'), 2_000);
    const result = await run;
    clearTimeout(deadline);
    return result.status === 'success'
      ? { status: 'success', result: JSON.stringify(result.result) }
      : { status: 'error', error: result.error?.message ?? 'run failed' };
  },
});
```

## 11. Security Considerations

- **Untrusted source**. Source from an LLM or remote user is untrusted. The sandbox and its limitations ([§6](#6-limitations)) are the barriers against escape. Do not relax them based on source inspection.
- **Bridged callables are the attack surface**. Once a function crosses the boundary, the sandbox may call it repeatedly with any serializable arguments. Bridged functions **MUST** validate arguments against an explicit schema and **SHOULD** enforce their own call-rate budget when they perform expensive work.
- **Host-side data exposure**. Bridged functions run on the host and can reach any state the host closure captures. They **MUST NOT** return values that were not deliberately exposed — secrets, other threads' state, and unrelated environment variables **MUST NOT** be reachable through a bridge unless the caller explicitly passed them.
- **Runaway execution**. Callers evaluating untrusted code **MUST** enforce their own deadline via `setTimeout` + `handle.terminate()`. `terminate()` settles at the next yield point; for CPU-bound loops, the platform safety cap is the effective worst case.
- **Memory exhaustion**. Callers **SHOULD** set `memoryLimitBytes` explicitly when evaluating untrusted code.
- **Log redaction**. Captured `logs` may contain values derived from `globals`. Treat `logs` with the same confidentiality level as the most sensitive input passed into `globals` or `imports`.

## 12. TypeScript Reference

```typescript
interface CodeExecutionOptions {
  execute?: {
    fn?: string;
    args?: unknown[];
  };
  imports?: Record<string, Record<string, unknown>>;
  modules?: Record<string, string>;
  globals?: Record<string, unknown>;
  language?: 'javascript' | 'typescript';
  memoryLimitBytes?: number;
  filename?: string;
  report?: (value: unknown) => void;
}

interface CodeExecution extends PromiseLike<CodeExecutionResult> {
  terminate(reason?: string): void;
  readonly running: boolean;
  readonly reports: readonly unknown[];
}

interface CodeExecutionResult {
  status: 'success' | 'error' | 'memory' | 'terminated' | 'link_error';
  result?: unknown;
  reports: unknown[];
  logs: CodeExecutionLog[];
  error?: CodeExecutionError;
  durationMs: number;
  memoryUsedBytes?: number;
}

interface CodeExecutionLog {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  args: unknown[];
  timestamp: number;
}

interface CodeExecutionError {
  name: string;
  message: string;
  stack?: string;
  specifier?: string;
  filename?: string;
  line?: number;
  column?: number;
}
```
