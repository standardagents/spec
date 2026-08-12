# Tools

Tools are callable capabilities exposed to models during execution.

## 1. Tool Categories

| Type | Description | Where Defined |
|------|-------------|---------------|
| Function tool | Custom executable logic | `defineTool()` |
| Prompt tool | Nested prompt invocation | `definePrompt({ exposeAsTool: true })` |
| Agent tool | Agent callable (handoff or subagent) | `defineAgent({ exposeAsTool: true })` |

Function tools that evaluate model- or user-authored JavaScript or TypeScript **SHOULD** do so through [`state.runCode`](/0.1.0/specification/threads/code-execution) rather than `eval` or `new Function`. The sandbox enforces isolation, memory caps, and caller-initiated termination.

## 2. Function Tool Definition

```typescript
defineTool({
  description: 'Search indexed docs',
  args: z.object({ query: z.string() }),
  execute: async (state, args) => {
    const vectorStoreId = await state.env('VECTOR_STORE_ID');
    return { status: 'success', result: '...' };
  },
  variables: [
    {
      name: 'VECTOR_STORE_ID',
      type: 'text',
      required: true,
      description: 'Vector store identifier',
    },
  ],
});
```

## 3. Variable Declarations

Tool and prompt definitions can declare required variables:

```typescript
interface VariableDefinition {
  name: string;
  type: 'text' | 'secret';
  required: boolean;
  scoped?: boolean;
  description: string;
}
```

Semantics:
- `required: true` means execution cannot continue until a value resolves.
- `type: 'secret'` indicates sensitive values that should be encrypted at rest.
- `scoped: true` blocks inheritance from parent thread env for that variable name.
- Scoped variables still flow downward from the thread where they are declared/provided to descendants in that subtree.

## 4. Prompt Tool Configuration

When a prompt is used as a tool, callers can configure return shaping and initial input mapping:

```typescript
interface SubpromptConfig {
  name: string;
  includeTextResponse?: boolean;
  includeToolCalls?: boolean;
  includeErrors?: boolean;
  initUserMessageProperty?: string;
  initAttachmentsProperty?: string;
}
```

## 5. Subagent Tool Configuration

When `dual_ai` agents are used as tools, use `SubagentToolConfig`:

```typescript
interface SubagentToolConfig {
  name: string;
  agent?: string;
  blocking?: boolean;
  initUserMessageProperty?: string;
  initAttachmentsProperty?: string;
  initAgentNameProperty?: string;
  immediate?: boolean | {
    nameEnv?: string;
    descriptionEnv?: string;
    scopedEnv?: string[];
  };
  optional?: string;
  resumable?: false | {
    receives_messages: 'side_a' | 'side_b';
    maxInstances?: number;
    parentCommunication?: 'implicit' | 'explicit';
  };
  parentCommunication?: 'implicit' | 'explicit';
  hidden?: boolean;
}
```

Behavioral summary:
- `name`: the exposed tool name — the name the model invokes the subagent by. When `agent` is absent, it MUST reference a `dual_ai` agent with `exposeAsTool: true` directly.
- `agent`: the `dual_ai` agent the tool invokes when it is exposed under a name other than the agent's own. Defaults to `name`. The same agent may be exposed under different tool names by different prompts. Everything model-facing — the tool schema, instance registries, and lifecycle tool references — uses the exposed `name`; runtimes resolve the implementing agent internally as `agent ?? name`.
- non-resumable: direct tool-call semantics.
- resumable: runtime lifecycle tooling with persistent references.
- `immediate: true`: execute as soon as the prompt becomes active, before the first model step.
- `immediate: { ... }`: immediate execution with explicit per-instance env relationships.
- `immediate.nameEnv` / `immediate.descriptionEnv`: the only per-instance env values that a runtime may expose to an internal bootstrap model when deriving initial child args.
- `immediate.scopedEnv`: per-instance env values copied into the child thread; these remain runtime-only.
- `optional: 'FLAG_NAME'`: branch is enabled only when that environment flag resolves to `true`, `1`, or `yes` (case-insensitive).
- `resumable.parentCommunication`: `implicit` auto-queues child completion to the parent; `explicit` requires tools/hooks to call runtime thread APIs such as `state.notifyParent()` or `state.stopSession()`.
- top-level `parentCommunication`: the same modes for **non-resumable** subagents. `implicit` (default) auto-queues the child's completion to the parent, which triggers a parent turn; `explicit` suppresses the auto-queued completion entirely so the parent is not woken — for background children that deliver results through another channel (for example the parent's thread key-value store) to be picked up on the parent's next natural turn. When both are present, `resumable.parentCommunication` takes precedence.
- `hidden: true`: the subagent relationship stays declared — runtime code (hooks calling `invokeTool`/`queueTool`) can still spawn the child — but the tool MUST NOT be included in any LLM request's tool list. For infrastructure children the model must never invoke itself (for example a background context-compaction agent).

Security rule:
- runtimes must not expose `immediate.scopedEnv` values to the model unless the same env name is explicitly designated by `nameEnv` or `descriptionEnv`.

See [Agents §7](/0.1.0/specification/agents#7-subagents) for full lifecycle and communication rules.

## 6. Resumable Lifecycle Tools

For resumable subagents, runtimes provide built-in lifecycle tools:

- `subagent_create`
- `subagent_message`
- `subagents`

These tools are runtime-injected and scoped to what is currently enabled and available for that prompt/thread state.

`subagents` is the pull-based child visibility surface: it takes no arguments and returns the model-visible registry snapshot — reference id, name, status, working-status text, and initial arguments — as a tool result on demand. When this query tool is available, runtimes MUST NOT additionally inject an ambient registry system message into request context: a registry block that mutates between requests invalidates provider prefix caches and reads as out-of-dialogue state to agentic-tuned models. Child completions still arrive as messages. Injected tool descriptions SHOULD direct the model to call `subagents` before `subagent_create` so existing instances are reused rather than duplicated.

`subagent_create` MUST require a non-empty `name` argument for the spawned child instance. Runtimes SHOULD persist this as a human-readable child thread display name, for example a `name:<value>` thread tag.

Lifecycle tools manage resumable relationships exclusively. Runtimes MUST reject a `subagent_create` invocation that targets a relationship without `resumable` configuration, without creating a child, and the rejection SHOULD direct the model to invoke that tool directly instead. Runtimes SHOULD constrain the injected tool's target argument to the exposed names of the prompt's resumable relationships. All lifecycle tool references use the relationship's exposed tool `name`, never an internal agent identifier that differs from it.

`subagent_create` SHOULD expose a structured `arguments` object whose schema is dictated by the receiving agent's `side_a` `requiredSchema` — the child side that receives parent messages. Runtimes MUST validate it against that schema, persist the validated arguments for the life of the child thread, and make them available to both child sides for later turns (including future resumptions) through `ThreadState.arguments` and prompt variable interpolation on every activation (see [Agents §7.8](/0.1.0/specification/agents#78-persistent-invocation-arguments)). When required arguments are missing, runtimes MUST return a structured `subagent_arguments_required` error instead of spawning the child.

If `subagent_create` cannot proceed because required scoped variables are missing, runtimes should return a structured bootstrap error (for example `subagent_env_required`) including a request ID and a temporary variables endpoint:

- `GET /threads/{parent_thread_id}/variables/{request_id}`
- `POST /threads/{parent_thread_id}/variables/{request_id}`

The `POST` flow stores the provided values and immediately boots the deferred subagent instance.

## 7. Attachment Semantics Across Threads

When tool-driven subagent communication crosses thread boundaries:
- parent -> child attachment paths must be copied to child-local paths
- child -> parent attachment paths must be copied to parent-local paths

Returned attachment references must always be valid for the receiving thread filesystem.

## 8. Progress Reporting

A function tool **MAY** declare a `progressArgument` naming an argument whose value is a short, human-readable description of what the tool call is doing — for example `fixing index.html`.

```typescript
defineTool({
  description: 'Write a file to the workspace',
  progressArgument: 'description',
  args: z.object({
    description: z.string().describe('e.g. "writing index.html"'),
    path: z.string(),
    content: z.string(),
  }),
  execute: async (state, args) => {
    return { status: 'success', result: '...' };
  },
});
```

Semantics:
- `progressArgument` controls when the [`tool_call_started`](/0.1.0/specification/hooks#51-tool_call_started) hook and the matching `tool_call_started` thread event fire.
- When set, the runtime **SHOULD** wait until *just this argument* has finished streaming from the model — not the whole tool call — and surface its value as `progress`. This lets a UI show what a tool is about to do before a large argument (such as a file's `content`) finishes generating.
- When unset, `tool_call_started` fires as soon as the tool call appears in the model stream: its name is known, but its arguments **MAY** still be incomplete and `progress` is `undefined`.
- The named argument **SHOULD** be declared early in the `args` schema and kept short so it completes quickly.
- If the model never emits the named argument, `tool_call_started` still fires once the tool call finishes, with `progress` undefined.

## 9. Conformance Notes

Implementations **MUST**:

- validate tool args against the declared schema.
- execute local tools sequentially in the order they were returned.
- persist tool results as messages before advancing.
- persist tool errors as tool result messages rather than halting execution.
