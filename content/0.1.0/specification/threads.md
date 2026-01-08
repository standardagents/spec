# Threads

[TK]

## 1. Thread Definition

A thread represents an execution context with isolated storage for messages and files. ThreadState is the unified interface for all thread operations. It provides a consistent API for interacting with threads regardless of context - whether from tools during execution, hooks, or HTTP endpoints.

### 1.1 Design Principles

| Principle | Description |
|-----------|-------------|
| **Unified Interface** | Same ThreadState interface used everywhere |
| **Context Awareness** | Execution state available when applicable |
| **Platform Agnostic** | No implementation-specific details exposed |
| **Minimal Surface** | Only essential operations included |

### 1.2 Access Contexts

ThreadState is provided in different contexts:

| Context | Execution State | Use Case |
|---------|-----------------|----------|
| Tools | Present | During agent execution |
| Hooks | Present | Lifecycle interception |
| Endpoints | Null | HTTP API access |

## 2. Thread Identity

### 2.1 Identity Properties

Thread identity is immutable after creation:

| Property | Type | Description |
|----------|------|-------------|
| `threadId` | `string` | Unique identifier |
| `agentId` | `string` | Owning agent name |
| `userId` | `string \| null` | Associated user (optional) |
| `createdAt` | `number` | Creation timestamp (microseconds) |

### 2.2 Thread Metadata

The `ThreadMetadata` type captures identity in a serializable format:

```typescript
interface ThreadMetadata {
  id: string;
  agent_id: string;
  user_id: string | null;
  created_at: number;
}
```

## 3. Messages

### 3.1 Message Structure

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique message ID |
| `role` | `'system' \| 'user' \| 'assistant' \| 'tool'` | Message role |
| `content` | `string \| null` | Message content |
| `name` | `string \| null` | Tool name (for tool results) |
| `tool_calls` | `string \| null` | JSON-encoded tool calls |
| `tool_call_id` | `string \| null` | Tool call ID (for results) |
| `created_at` | `number` | Creation timestamp |
| `parent_id` | `string \| null` | Parent message (sub-prompts) |
| `depth` | `number` | Nesting depth (0 = top-level) |
| `silent` | `boolean` | Hidden from UI |
| `metadata` | `Record<string, unknown>` | Custom metadata |

### 3.2 Reading Messages

```typescript
// Get recent messages
const { messages, total, hasMore } = await state.getMessages({
  limit: 50,
  order: 'desc',
});

// Get a single message
const message = await state.getMessage('msg-123');
```

### 3.3 Query Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | `number` | - | Max messages to return |
| `offset` | `number` | 0 | Messages to skip |
| `order` | `'asc' \| 'desc'` | `'desc'` | Sort order |
| `includeSilent` | `boolean` | false | Include silent messages |
| `maxDepth` | `number` | - | Max nesting depth |

### 3.4 Injecting Messages

Messages can be injected into the conversation:

```typescript
const message = await state.injectMessage({
  role: 'user',
  content: 'Additional context...',
  silent: true, // Hide from UI
  metadata: { source: 'tool' },
});
```

### 3.5 Updating Messages

Existing messages can be updated:

```typescript
const updated = await state.updateMessage('msg-123', {
  content: 'Updated content',
  metadata: { edited: true },
});
```

## 4. Resource Loading

### 4.1 Loading Definitions

ThreadState provides access to registered definitions:

```typescript
// Load a model definition
const model = await state.loadModel('gpt-4o');

// Load a prompt definition
const prompt = await state.loadPrompt('support-prompt');

// Load an agent definition
const agent = await state.loadAgent('customer-support');
```

### 4.2 Listing Resources

```typescript
// Get available resource names
const prompts = state.getPromptNames();
const agents = state.getAgentNames();
const models = state.getModelNames();
```

## 5. Tool Invocation

### 5.1 Queuing Tools

Queue a tool for asynchronous execution:

```typescript
// Queue a tool (non-blocking)
state.queueTool('send_email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Message content',
});
```

If the thread is currently executing, the tool is added to the queue. Otherwise, a new execution is started.

### 5.2 Direct Invocation

Invoke a tool and wait for the result:

```typescript
// Invoke directly (blocking)
const result = await state.invokeTool('get_weather', {
  location: 'San Francisco',
});

if (result.status === 'success') {
  console.log(result.result);
}
```

## 6. Events

### 6.1 Emitting Events

Send custom events to connected clients:

```typescript
state.emit('progress', {
  step: 3,
  total: 10,
  message: 'Processing data...',
});
```

Events are delivered via WebSocket to any connected clients.

### 6.2 Event Guidelines

- Event names **SHOULD** be lowercase with underscores
- Event data **MUST** be JSON-serializable
- Events **SHOULD NOT** contain sensitive information

## 7. Context Storage

### 7.1 Per-Execution Context

The `context` property provides temporary storage:

```typescript
// Store data during execution
state.context.userData = { id: 123, name: 'Alice' };

// Retrieve in another tool call
const user = state.context.userData;
```

### 7.2 Context Limitations

| Aspect | Behavior |
|--------|----------|
| **Scope** | Single execution only |
| **Persistence** | Lost after execution ends |
| **Type** | `Record<string, unknown>` |
| **Size** | No enforced limit |

For persistent storage, use the file system or external storage solutions.

## 8. File System

Each thread has access to an isolated file system for storing files, images, and other binary data.

### 8.1 File Record

Files are represented by the `FileRecord` type:

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | File path (relative to thread root) |
| `name` | `string` | File name |
| `mimeType` | `string` | MIME type |
| `storage` | `string` | Implementation-defined storage identifier |
| `size` | `number` | File size in bytes |
| `isDirectory` | `boolean` | Whether this is a directory |
| `metadata` | `Record<string, unknown>` | Custom metadata |
| `width` | `number` | Image width in pixels (if applicable) |
| `height` | `number` | Image height in pixels (if applicable) |

### 8.2 Writing Files

```typescript
// Write a text file
const record = await state.writeFile(
  '/data/config.json',
  JSON.stringify({ key: 'value' }),
  'application/json'
);

// Write a binary file with metadata
const imageRecord = await state.writeFile(
  '/images/photo.jpg',
  imageBuffer,
  'image/jpeg',
  { width: 1920, height: 1080 }
);
```

### 8.3 Reading Files

```typescript
// Read file content
const data = await state.readFile('/data/config.json');
if (data) {
  const text = new TextDecoder().decode(data);
  const config = JSON.parse(text);
}

// Get file metadata without reading content
const info = await state.statFile('/images/photo.jpg');
if (info) {
  console.log(`Size: ${info.size} bytes`);
}
```

### 8.4 Directory Operations

```typescript
// Create a directory
await state.mkdirFile('/documents');

// List directory contents
const { entries } = await state.readdirFile('/documents');
for (const entry of entries) {
  console.log(`${entry.isDirectory ? 'DIR' : 'FILE'}: ${entry.name}`);
}

// Remove an empty directory
await state.rmdirFile('/documents');

// Delete a file
await state.unlinkFile('/data/config.json');
```

### 8.5 Search Operations

```typescript
// Search file contents
const grepResults = await state.grepFiles('error');
for (const result of grepResults) {
  console.log(`${result.path}:`);
  for (const match of result.matches) {
    console.log(`  Line ${match.line}: ${match.content}`);
  }
}

// Find files by glob pattern
const { paths } = await state.findFiles('**/*.json');
console.log('JSON files:', paths);
```

### 8.6 File Statistics

```typescript
const stats = await state.getFileStats();
console.log(`Files: ${stats.fileCount}`);
console.log(`Directories: ${stats.directoryCount}`);
console.log(`Total size: ${stats.totalSize} bytes`);
```

### 8.7 Image Thumbnails

```typescript
// Get thumbnail for an image
const thumbnail = await state.getFileThumbnail('/images/photo.jpg');
if (thumbnail) {
  // Use thumbnail data
}
```

### 8.8 Streaming Files

For large files, `readFileStream` provides memory-efficient access by yielding data in chunks.

#### Method

```typescript
readFileStream(
  path: string,
  options?: ReadFileStreamOptions
): Promise<AsyncIterable<FileChunk> | null>
```

#### Options

| Property | Type | Description |
|----------|------|-------------|
| `signal` | `AbortSignal` | Optional abort signal for cancellation |

#### FileChunk

| Property | Type | Description |
|----------|------|-------------|
| `data` | `Uint8Array` | Raw binary data for this chunk |
| `index` | `number` | 0-based index of this chunk |
| `totalChunks` | `number` | Total number of chunks |
| `isLast` | `boolean` | Whether this is the final chunk |

#### Behavior

1. **File Not Found**: Returns `null` if the file does not exist.

2. **External Files**: Returns `null` for files stored externally (S3, R2, URL). External files must be fetched using their storage location.

3. **Small Files**: Files under the chunk threshold are yielded as a single chunk with `index: 0`, `totalChunks: 1`, and `isLast: true`.

4. **Chunked Files**: Large files yield multiple chunks in sequential order (0, 1, 2...).

5. **Ordering Guarantee**: Chunks are always yielded in sequential order. Implementations **MUST NOT** yield chunks out of order.

6. **Abort Signal**: When triggered, the stream stops yielding new chunks. Already-yielded chunks remain valid.

#### Example: Processing Large File

```typescript
const stream = await state.readFileStream('/uploads/video.mp4');
if (!stream) {
  throw new Error('File not found');
}

for await (const chunk of stream) {
  console.log(`Progress: ${chunk.index + 1}/${chunk.totalChunks}`);
  // Process chunk.data without loading entire file into memory
}
```

#### Example: HTTP Streaming Response

```typescript
const stream = await state.readFileStream('/uploads/large-file.bin');
if (!stream) {
  return new Response('Not Found', { status: 404 });
}

const readable = new ReadableStream({
  async start(controller) {
    for await (const chunk of stream) {
      controller.enqueue(chunk.data);
    }
    controller.close();
  }
});

return new Response(readable, {
  headers: { 'Content-Type': 'application/octet-stream' }
});
```

## 9. Execution State

### 9.1 Availability

The `execution` property is:
- **Present** during active execution (tools, hooks)
- **Null** when accessing at rest (endpoints)

```typescript
if (state.execution) {
  console.log(`Step ${state.execution.stepCount}`);
}
```

### 9.2 Execution Properties

| Property | Type | Description |
|----------|------|-------------|
| `flowId` | `string` | Unique execution ID |
| `currentSide` | `'a' \| 'b'` | Active side (dual_ai) |
| `stepCount` | `number` | Total LLM request/response cycles |
| `sideAStepCount` | `number` | Side A steps |
| `sideBStepCount` | `number` | Side B steps |
| `stopped` | `boolean` | Execution stopped |
| `stoppedBy` | `'a' \| 'b' \| undefined` | Who stopped |
| `messageHistory` | `Message[]` | Current history |
| `abortSignal` | `AbortSignal` | Cancellation signal |

### 9.3 Controlling Execution

```typescript
// Force next turn to a specific side (dual_ai only)
state.execution.forceTurn('b');

// Stop execution after current operation
state.execution.stop();

// Use abort signal for cancellation
fetch(url, { signal: state.execution.abortSignal });
```

## 10. Thread Endpoints

Thread endpoints expose HTTP APIs for thread-specific operations. They automatically look up threads by ID and provide a `ThreadState` instance.

### 10.1 Defining Thread Endpoints

```typescript
import { defineThreadEndpoint } from '@standardagents/spec';

export default defineThreadEndpoint(async (req, state) => {
  const { messages, total } = await state.getMessages({ limit: 10 });
  return Response.json({
    threadId: state.threadId,
    messageCount: total,
  });
});
```

### 10.2 Handler Signature

Thread endpoint handlers receive:

| Parameter | Type | Description |
|-----------|------|-------------|
| `req` | `Request` | The incoming HTTP request |
| `state` | `ThreadState` | Thread state for the requested thread |

The handler **MUST** return a `Response` object.

### 10.3 Endpoint Context

When accessing a thread via an endpoint, `state.execution` is always `null` because the thread is not actively executing:

```typescript
export default defineThreadEndpoint(async (req, state) => {
  // Execution is always null in endpoints
  if (state.execution === null) {
    // Thread is at rest, not executing
  }
  return Response.json({ threadId: state.threadId });
});
```

### 10.4 Error Handling

Thread endpoints automatically handle common errors:

| Condition | Response |
|-----------|----------|
| Thread not found | 404: `{ error: "Thread not found: {threadId}" }` |
| Missing thread ID | 400: `{ error: "Thread ID required" }` |

### 10.5 Thread Endpoint Examples

**Get Thread Messages:**
```typescript
import { defineThreadEndpoint } from '@standardagents/spec';

export default defineThreadEndpoint(async (req, state) => {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const result = await state.getMessages({ limit, offset, order: 'desc' });
  return Response.json(result);
});
```

**Export Thread Data:**
```typescript
import { defineThreadEndpoint } from '@standardagents/spec';

export default defineThreadEndpoint(async (req, state) => {
  const { messages } = await state.getMessages({ order: 'asc' });

  return Response.json({
    exportedAt: new Date().toISOString(),
    thread: {
      id: state.threadId,
      agent: state.agentId,
      user: state.userId,
      createdAt: state.createdAt,
    },
    messages,
  });
});
```

**List Thread Files:**
```typescript
import { defineThreadEndpoint } from '@standardagents/spec';

export default defineThreadEndpoint(async (req, state) => {
  const { entries } = await state.readdirFile('/');
  return Response.json({ files: entries });
});
```

## 11. Conformance Requirements

### 11.1 Thread Lifecycle

1. **Creation**: Thread created with metadata
2. **Execution**: Agent processes messages
3. **At Rest**: Thread accessible via endpoints
4. **Resumption**: New execution on next message

### 11.2 Platform Independence

ThreadState is an abstract interface. Implementations **MUST NOT** expose:
- Storage implementation details
- Platform-specific bindings
- Internal state management

### 11.3 Error Handling

Methods that return promises **SHOULD** throw on:
- Resource not found (loadModel, loadPrompt, loadAgent)
- Invalid parameters
- Storage errors

Methods **SHOULD NOT** throw on:
- Empty results (return empty arrays/null instead)
- Missing optional data
