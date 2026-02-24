# Tools

Tools are callable capabilities exposed to models during execution.

## 1. Tool Categories

| Type | Description | Where Defined |
|------|-------------|---------------|
| Function tool | Custom executable logic | `defineTool()` |
| Prompt tool | Nested prompt invocation | `definePrompt({ exposeAsTool: true })` |
| Agent tool | Agent callable (handoff or subagent) | `defineAgent({ exposeAsTool: true })` |

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

## 3. ToolResult

```typescript
interface ToolResult {
  status: 'success' | 'error';
  result?: string;
  error?: string;
  stack?: string;
  attachments?: Array<ToolAttachment | AttachmentRef>;
}
```

Attachments may be:
- new files (`ToolAttachment` with base64 data)
- existing files (`AttachmentRef` with filesystem path)

## 4. Prompt Tool Configuration

When prompts are used as tools, callers can configure return shaping and initial input mapping:

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
  blocking?: boolean;
  initUserMessageProperty?: string;
  initAttachmentsProperty?: string;
  initAgentNameProperty?: string;
  resumable?: false | {
    receives_messages: 'side_a' | 'side_b';
    maxInstances?: number;
  };
}
```

Behavioral summary:
- non-resumable: direct tool-call semantics
- resumable: runtime lifecycle tooling with persistent references

See [Subagents](/specification/subagents) for lifecycle and communication rules.

## 6. Resumable Lifecycle Tools

For resumable subagents, runtimes provide built-in lifecycle tools:

- `subagent_create`
- `subagent_message`

These tools are runtime-injected and scoped to what is currently allowed for that prompt/thread state.

## 7. Attachment Semantics Across Threads

When tool-driven subagent communication crosses thread boundaries:
- parent -> child attachment paths must be copied to child-local paths
- child -> parent attachment paths must be copied to parent-local paths

Returned attachment references must always be valid for the receiving thread filesystem.

## 8. Conformance Notes

Implementations MUST:
- validate tool args against schema
- execute local tools sequentially in returned order
- persist tool results as messages
- surface tool errors as tool results (not hard-crash the run)
