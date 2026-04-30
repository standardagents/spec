# Thread Endpoints

Thread endpoints expose HTTP APIs for thread-specific operations. They automatically look up threads by ID and provide a `ThreadState` instance to the handler.

For the rest of the `ThreadState` surface, see [Threads](/0.1.0/specification/threads).

## 1. Defining Thread Endpoints

```typescript
import { defineThreadEndpoint } from '@standardagents/spec';

export default defineThreadEndpoint(async (req, state, params) => {
  const { messages, total } = await state.getMessages({ limit: 10 });
  return Response.json({
    threadId: state.threadId,
    messageCount: total,
    params,
  });
});
```

## 2. File-Based Routing

Thread endpoints are file-based. Runtimes mount endpoint files beneath the requested thread ID:

```text
{runtime_prefix}/{threadId}/{endpoint_path}
```

The runtime chooses the prefix. The endpoint path is derived from the endpoint file path using these rules:

| File path | Method | Endpoint path |
|-----------|--------|---------------|
| `foo.ts` | GET | `/foo` |
| `bar.post.ts` | POST | `/bar` |
| `index.ts` | GET | `/` |
| `foobar/index.ts` | GET | `/foobar` |
| `foobar/other.ts` | GET | `/foobar/other` |
| `foobar/[id].ts` | GET | `/foobar/{id}` |
| `foobar/[*].ts` | GET | `/foobar/{*}` |

Files without a method suffix are GET endpoints. A method suffix is the final filename segment before `.ts`; runtimes MUST support at least `.get.ts`, `.post.ts`, `.put.ts`, `.patch.ts`, and `.delete.ts`. Method suffix matching is case-insensitive.

`index.ts` maps to the containing directory path. Static routes take precedence over dynamic routes. Dynamic routes take precedence over catch-all routes.

A dynamic segment is written `[name]` and captures exactly one path segment into `params.name`. A catch-all segment is written `[*]` and captures zero or more remaining path segments into `params['*']`. The catch-all value includes `/` separators when the match spans multiple segments.

Packed thread endpoints use the same route namespace as local thread endpoints. They are still addressed beneath the runtime's thread ID prefix, not beneath a package-specific URL prefix:

```text
{runtime_prefix}/{threadId}/{endpoint_path}
```

## 3. Handler Signature

Thread endpoint handlers receive:

| Parameter | Type | Description |
|-----------|------|-------------|
| `req` | `Request` | The incoming HTTP request |
| `state` | `ThreadState` | Thread state for the requested thread |
| `params` | `Record<string, string>` | Route parameters captured from dynamic or catch-all endpoint path segments |

The handler **MUST** return a `Response` object.

## 4. Endpoint Context

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

## 5. Error Handling

Thread endpoints automatically handle common errors:

| Condition | Response |
|-----------|----------|
| Thread not found | 404: `{ error: "Thread not found: {threadId}" }` |
| Missing thread ID | 400: `{ error: "Thread ID required" }` |

## 6. Examples

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
