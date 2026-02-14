# Tools

A tool is a capability that an LLM can invoke during execution. Tools enable agents to interact with external systems, perform computations, or access resources beyond the model's built-in knowledge.

## 1. Tool Definition

A tool is a capability presented to the LLM that it can invoke during execution. Each tool appears in the LLM's context with a name, description, and argument schema.

### 1.1 Tool Types

Standard Agents supports three types of tools:

| Type | Description | Specification |
|------|-------------|---------------|
| **Function** | Custom code that executes and returns a result | This document |
| **Sub-prompt** | A prompt invoked as a nested operation | [Prompts](/specification/prompts) |
| **Agent** | Handoff (`ai_human`) or subagent (`dual_ai`) invocation | [Prompts](/specification/prompts), [Subagents](/specification/subagents) |

This specification covers **function tools** defined using `defineTool()`. Sub-prompts and agent invocations are configured in prompt definitions and covered in the Prompts specification.

### 1.2 Subagent Tool Configuration

`dual_ai` agent tools support subagent-specific options in prompt tool lists:

```typescript
interface SubagentToolConfig {
  name: StandardAgentSpec.Callables;
  blocking?: boolean;
  initUserMessageProperty?: string;
  initAttachmentsProperty?: string;
  resumable?: false | {
    receives_messages: 'side_a' | 'side_b';
    maxInstances?: number;
  };
}
```

Use this form when you need asynchronous subagent execution, resumable child instances, or instance limits. See [Subagents](/specification/subagents) for behavior details.

## 2. Function Tool Definition

Function tools are custom implementations that interact with external systems, perform computations, or access resources. Each function tool has a description (visible to the LLM), an optional argument schema, and an implementation function.

### 2.1 Definition Structure

A tool definition is an object containing:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `description` | `string` | Yes | Tool description shown to the LLM |
| `args` | `ToolArgs` | No | Zod schema for argument validation |
| `execute` | `Tool` | Yes | Implementation function |
| `tenvs` | `ToolTenvs` | No | Thread environment variables required |

### 2.2 Tool Description

The tool description **MUST** be a non-empty string that clearly explains:
- What the tool does
- When the LLM should use it
- What information it returns

The description is included in the LLM's context and directly affects tool selection behavior.

## 3. Tool Arguments

### 3.1 Argument Schema

Tool arguments **MUST** be defined using a Zod object schema.

```typescript
z.object({
  query: z.string().describe('Search query'),
  limit: z.number().optional().describe('Maximum results to return'),
})
```

### 3.2 Allowed Argument Types

The following Zod types are allowed in tool argument schemas:

| Category | Types |
|----------|-------|
| Primitives | `z.string()`, `z.number()`, `z.boolean()`, `z.null()` |
| Literals | `z.literal(value)` |
| Enums | `z.enum([...])` |
| Wrappers | `z.optional()`, `z.nullable()`, `z.default()` |
| Collections | `z.array()`, `z.object()`, `z.record()` |
| Unions | `z.union([...])` |

### 3.3 Nesting Depth

Implementations **MUST** support argument schemas with nesting up to 7 levels deep.

### 3.4 Argument Validation

Tool implementations **MUST** validate all input arguments before use.

### 3.5 No Arguments

Tools that require no arguments **MUST** be defined without an `args` property:

```typescript
defineTool({
  description: 'Get current time',
  execute: async (state) => {
    return { status: 'success', result: new Date().toISOString() };
  },
});
```

## 4. Tool Results

### 4.1 Result Structure

Tool implementations **MUST** return a `ToolResult` object:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `status` | `'success' \| 'error'` | Yes | Execution status |
| `result` | `string` | No | Text representation of output |
| `error` | `string` | No | Error message if status is 'error' |
| `stack` | `string` | No | Stack trace for debugging |
| `attachments` | `Array<ToolAttachment \| AttachmentRef>` | No | File attachments (new or existing) |

### 4.2 Success Results

For successful executions, implementations **SHOULD**:

1. Set `status` to `'success'`
2. Provide a `result` string containing useful information for the LLM
3. Optionally include `attachments` for generated files

```typescript
return {
  status: 'success',
  result: JSON.stringify({ temperature: 72, conditions: 'sunny' }),
};
```

### 4.3 Error Results

For failed executions, implementations **SHOULD**:

1. Set `status` to `'error'`
2. Provide a clear `error` message describing what went wrong
3. Optionally include `stack` for debugging

```typescript
return {
  status: 'error',
  error: 'API rate limit exceeded. Please try again later.',
};
```

Error messages **SHOULD** be actionable - the LLM may use them to adjust its approach and retry.

Tools handling sensitive data **MUST NOT** include secrets in error messages or results. Implementations **SHOULD** sanitize outputs to prevent injection attacks.

## 5. Tool Attachments

### 5.1 Attachment Structure

Tools can generate file attachments (e.g., images, documents):

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | File name |
| `mimeType` | `string` | Yes | MIME type |
| `data` | `string` | Yes | Base64-encoded content |
| `width` | `number` | No | Width in pixels (images) |
| `height` | `number` | No | Height in pixels (images) |

### 5.2 Attachment Storage

Implementations **MUST**:

1. Store new attachments (those with `data`) under the `/attachments/` directory of the thread's file system

Implementations **SHOULD**:

1. Link attachments to the tool result message
2. NOT apply downsampling to tool-generated attachments (unlike user uploads)
3. Validate file paths to prevent directory traversal attacks

### 5.3 Existing File References

Tools can also return references to files already stored in the thread filesystem using `AttachmentRef`:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `type` | `'file'` | Yes | Attachment type |
| `path` | `string` | Yes | Path in thread file system |
| `name` | `string` | Yes | File name |
| `mimeType` | `string` | Yes | MIME type |
| `size` | `number` | Yes | File size in bytes |
| `width` | `number` | No | Width in pixels (images) |
| `height` | `number` | No | Height in pixels (images) |
| `description` | `string` | No | AI-generated description |

This is useful for sub-prompts that need to pass through attachments from nested tool executions without re-storing them.

### 5.4 Example with Attachment

```typescript
defineTool({
  description: 'Generate chart',
  args: z.object({ data: z.array(z.number()) }),
  execute: async (state, args) => {
    const chart = await generateChart(args.data);
    return {
      status: 'success',
      result: 'Chart generated successfully',
      attachments: [{
        name: 'chart.png',
        mimeType: 'image/png',
        data: chart.toBase64(),
        width: 800,
        height: 600,
      }],
    };
  },
});
```

## 6. Content Types

### 6.1 Text Content

Text content represents plain text output:

```typescript
interface TextContent {
  type: 'text';
  text: string;
}
```

### 6.2 Image Content

Image content represents inline images:

```typescript
interface ImageContent {
  type: 'image';
  data: string;      // Base64-encoded
  mimeType: string;  // e.g., 'image/png'
}
```

### 6.3 Content Union

The `ToolContent` type is a union of supported content types:

```typescript
type ToolContent = TextContent | ImageContent;
```

## 7. Execution Context

### 7.1 ThreadState Parameter

Tool implementations receive a `ThreadState` instance as their first parameter. See the [Threads specification](/specification/threads#13-typescript-reference) for the complete interface.

### 7.2 Execution State

During tool execution, `state.execution` is always present and provides:

```typescript
if (state.execution) {
  // Access execution properties
  const step = state.execution.stepCount;
  const side = state.execution.currentSide;

  // Check for cancellation
  if (state.execution.abortSignal.aborted) {
    return { status: 'error', error: 'Execution cancelled' };
  }
}
```

## 8. Naming Conventions

### 8.1 Tool Names

Tool names **MUST** be unique string identifiers. Names **SHOULD**:

- Use `snake_case` format
- Be descriptive and action-oriented
- Be between 1 and 64 characters

### 8.2 Valid Names

Examples of valid tool names:
- `search_knowledge_base`
- `create_ticket`
- `send_email`
- `calculate_total`

### 8.3 Name Validation

Implementations **SHOULD** warn but not reject tools with non-conforming names.

## 9. Thread Environment Variables (Tenvs)

### 9.1 Overview

Thread environment variables (tenvs) are runtime configuration values required by tools. They flow from prompts → agents → threads, with later values overriding earlier ones. Tenvs are commonly used for:

- API credentials or identifiers (e.g., vector store IDs)
- User-specific configuration (e.g., location preferences)
- Runtime context that varies per thread

### 9.2 Tenv Schema

Tenvs are defined using a Zod object schema, following the same pattern as tool arguments:

```typescript
z.object({
  vectorStoreId: z.string().describe('OpenAI Vector Store ID'),
  userLocation: z.string().optional().describe('User location for results'),
})
```

### 9.3 Required vs Optional Tenvs

- **Required tenvs**: Fields without `.optional()` must be provided before thread creation
- **Optional tenvs**: Fields with `.optional()` may be omitted

Thread creation **MUST** fail if any required tenvs are missing after merging prompt, agent, and thread values.

### 9.4 Tenv Merging

Tenvs are merged in order, with later values winning:

```
prompt.tenvs → agent.tenvs → thread.tenvs
```

This allows defaults to be set at the prompt level and overridden at runtime.

### 9.5 Defining Tools with Tenvs

The `defineTool` function accepts an optional `tenvs` property for tenv requirements:

```typescript
defineTool({
  description: 'Search through uploaded files',
  args: z.object({ query: z.string() }),
  execute: async (state, args) => ({ status: 'success', result: '...' }),
  tenvs: z.object({
    vectorStoreId: z.string().describe('Vector store to search'),
  }),
});
```

### 9.6 Accessing Tenvs

Tool implementations access tenvs via `state.tenvs`:

```typescript
async (state, args) => {
  const storeId = state.tenvs.vectorStoreId;
  // Use storeId for the operation...
}
```

## 10. TypeScript Reference

```typescript
/**
 * Text content item.
 */
interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content item.
 */
interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

/**
 * Union of content types.
 */
type ToolContent = TextContent | ImageContent;

/**
 * File attachment generated by a tool.
 */
interface ToolAttachment {
  name: string;
  mimeType: string;
  data: string;
  width?: number;
  height?: number;
}

/**
 * Reference to an existing file.
 */
interface AttachmentRef {
  id: string;
  type: 'file';
  path: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  description?: string;
}

/**
 * Result returned by tool execution.
 */
interface ToolResult {
  status: 'success' | 'error';
  result?: string;
  error?: string;
  stack?: string;
  attachments?: Array<ToolAttachment | AttachmentRef>;
}

/**
 * Tool argument schema (Zod object).
 */
type ToolArgs = z.ZodObject<ToolArgsRawShape>;

/**
 * Thread environment variable schema (Zod object).
 * Defines which tenvs a tool requires at runtime.
 */
type ToolTenvs = z.ZodObject<TenvRawShape>;

/**
 * Tool function signature.
 * Tools receive ThreadState as their first parameter.
 */
type Tool<Args extends ToolArgs | null = null> =
  Args extends ToolArgs
    ? (state: ThreadState, args: z.infer<Args>) => Promise<ToolResult>
    : (state: ThreadState) => Promise<ToolResult>;

/**
 * Tool definition object.
 */
interface ToolDefinition<
  Args extends ToolArgs | null = null,
  Tenvs extends ToolTenvs | null = null,
> {
  description: string;
  args: Args;
  execute: Tool<Args>;
  tenvs: Tenvs;
}

/**
 * Options for defining a tool.
 */
interface DefineToolOptions<
  Args extends ToolArgs | null = null,
  Tenvs extends ToolTenvs | null = null,
> {
  description: string;
  args?: Args;
  execute: Tool<Args>;
  tenvs?: Tenvs;
}

/**
 * Define a tool with the given options.
 */
function defineTool<
  Args extends ToolArgs | null = null,
  Tenvs extends ToolTenvs | null = null,
>(options: DefineToolOptions<Args, Tenvs>): ToolDefinition<Args, Tenvs>;
```

## 11. Examples

### 11.1 Basic Tool with Arguments

```typescript
import { defineTool } from '@standardagents/spec';
import { z } from 'zod';

export default defineTool({
  description: 'Search the knowledge base for relevant information',
  args: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().default(10).describe('Max results'),
  }),
  execute: async (state, args) => {
    const results = await searchKnowledgeBase(args.query, args.limit);
    return {
      status: 'success',
      result: JSON.stringify(results),
    };
  },
});
```

### 11.2 Tool without Arguments

```typescript
import { defineTool } from '@standardagents/spec';

export default defineTool({
  description: 'Get the current server time in ISO format',
  execute: async (state) => {
    return {
      status: 'success',
      result: new Date().toISOString(),
    };
  },
});
```

### 11.3 Tool with Error Handling

```typescript
import { defineTool } from '@standardagents/spec';
import { z } from 'zod';

export default defineTool({
  description: 'Fetch data from external API',
  args: z.object({ endpoint: z.string() }),
  execute: async (state, args) => {
    try {
      // Use abort signal for cancellation support
      const response = await fetch(args.endpoint, {
        signal: state.execution?.abortSignal,
      });
      if (!response.ok) {
        return {
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      const data = await response.json();
      return {
        status: 'success',
        result: JSON.stringify(data),
      };
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      };
    }
  },
});
```

### 11.4 Tool with Attachments

```typescript
import { defineTool } from '@standardagents/spec';
import { z } from 'zod';

export default defineTool({
  description: 'Generate a PNG image from the given prompt',
  args: z.object({
    prompt: z.string().describe('Image generation prompt'),
    width: z.number().default(512),
    height: z.number().default(512),
  }),
  execute: async (state, args) => {
    const image = await generateImage(args.prompt, args.width, args.height);
    return {
      status: 'success',
      result: `Generated image for: "${args.prompt}"`,
      attachments: [{
        name: `generated-${Date.now()}.png`,
        mimeType: 'image/png',
        data: image.toBase64(),
        width: args.width,
        height: args.height,
      }],
    };
  },
});
```

### 11.5 Tool with Thread Environment Variables

```typescript
import { defineTool } from '@standardagents/spec';
import { z } from 'zod';

export default defineTool({
  description: 'Search through uploaded files using vector embeddings',
  args: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async (state, args) => {
    // Access tenvs from state
    const vectorStoreId = state.tenvs.vectorStoreId;
    const results = await searchVectorStore(vectorStoreId, args.query);
    return {
      status: 'success',
      result: JSON.stringify(results),
    };
  },
  // tenvs property: tenv requirements
  tenvs: z.object({
    vectorStoreId: z.string().describe('OpenAI Vector Store ID'),
  }),
});
```
