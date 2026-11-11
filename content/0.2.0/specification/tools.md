# Tools

Tools are callable capabilities exposed to models during execution.

## 1. Tool Categories

| Type | Description | Where Defined |
|------|-------------|---------------|
| Function tool | Custom executable logic | `defineTool()` |
| Prompt tool | Nested prompt invocation | `definePrompt()`, named in another prompt's `tools` |
| Agent tool | Agent handoff callable | `defineAgent({ exposeAsTool: true })` |

Function tools that evaluate model- or user-authored JavaScript or TypeScript **SHOULD** do so through [`state.runCode`](/0.2.0/specification/threads/code-execution) rather than `eval` or `new Function`. The sandbox enforces isolation, memory caps, and caller-initiated termination.

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

### 2.1 Tool Dependencies

A function tool **MAY** declare `uses` as an array of names of tools, prompts, or agents it may invoke by name through `state.invokeTool()` or `state.queueTool()`. Names may be local or [qualified](/0.2.0/distribution/packaging#qualified-names).

```typescript
uses: ['validate_input', 'format_output'] as const
```

A packed tool **MUST** declare the targets it invokes by name. A package **MUST** include its required tool dependencies. When a `uses` list is supplied, the runtime **MUST** reject an invocation of a target outside the list. `queueTool()` throws an error for an undeclared target. `invokeTool()` returns an error result for an undeclared target. An empty list permits no targets. When `uses` is omitted, this restriction does not apply.

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

## 5. Subagent Composition

Subagent relationships are **not tool configuration**; a prompt `tools` entry attempting to configure one is a definition-time error.

Relationships are declared on the owning agent *side* (`SideConfig.subagents`), and the lifecycle tools (`subagents`, `subagent_create`, `subagent_message`) are runtime-injected for a prompt-backed side's non-hidden relationships. The relationship names `subagents`, `subagent_create`, and `subagent_message` are reserved in the tool namespace.

See [Subagents](/0.2.0/specification/subagents) for the `SubagentRelationship` type, ownership rules, lifecycle tool contracts, and cross-thread semantics.

## 6. Attachment Semantics Across Threads

When tool-driven subagent communication crosses thread boundaries:
- parent -> child attachment paths must be copied to child-local paths
- child -> parent attachment paths must be copied to parent-local paths

Returned attachment references must always be valid for the receiving thread filesystem.

## 7. Progress Reporting

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
- `progressArgument` controls when the [`tool_call_started`](/0.2.0/specification/hooks#51-tool_call_started) hook and the matching `tool_call_started` thread event fire.
- When set, the runtime **SHOULD** wait until *just this argument* has finished streaming from the model — not the whole tool call — and surface its value as `progress`. This lets a UI show what a tool is about to do before a large argument (such as a file's `content`) finishes generating.
- When unset, `tool_call_started` fires as soon as the tool call appears in the model stream: its name is known, but its arguments **MAY** still be incomplete and `progress` is `undefined`.
- The named argument **SHOULD** be declared early in the `args` schema and kept short so it completes quickly.
- If the model never emits the named argument, `tool_call_started` still fires once the tool call finishes, with `progress` undefined.

## 8. Annotations

A function tool **MAY** declare `annotations`: an object of implementation-specific hints, keyed by the runtime or tool that reads them.

```typescript
type ToolAnnotations = Record<string, unknown>;

defineTool({
  description: 'Run a TypeScript module in a sandbox',
  args: z.object({ code: z.string() }),
  annotations: {
    agentbuilder: { codemode: { codeArgument: 'code', language: 'typescript' } },
  },
  execute: async (state, args) => {
    return { status: 'success', result: '...' };
  },
});
```

Semantics:
- Annotations are non-normative. This specification defines no annotation keys, and their meaning belongs to whoever owns the key.
- `defineTool()` **MUST** return `annotations` unchanged on the tool definition.
- A runtime **MAY** read keys it understands, typically to choose how it displays a tool call, and **MUST** ignore keys it does not.
- Annotations **MUST NOT** change argument validation, execution, the tool's results, or what is sent to the model. A tool behaves identically in a runtime that ignores them.

## 9. Conformance Notes

Implementations **MUST**:

- validate tool args against the declared schema.
- execute local tools sequentially in the order they were returned.
- persist tool results as messages before advancing.
- persist tool errors as tool result messages rather than halting execution.
- preserve tool `annotations` and never let them affect execution.
