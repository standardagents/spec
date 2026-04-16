# Thread Endpoints

Thread endpoints expose HTTP APIs for thread-specific operations. They automatically look up threads by ID and provide a `ThreadState` instance to the handler.

For the rest of the `ThreadState` surface, see [Threads](/0.1.0/specification/threads).

## 1. Defining Thread Endpoints

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

## 2. Packed Endpoint Routing

When thread endpoints are loaded from packed packages, runtimes should mount them under a package namespace to avoid route collisions between packages and local endpoints.

Example mount pattern:

```text
/api/packages/{packageId}/threads/{threadId}/...
```

## 3. Handler Signature

Thread endpoint handlers receive:

| Parameter | Type | Description |
|-----------|------|-------------|
| `req` | `Request` | The incoming HTTP request |
| `state` | `ThreadState` | Thread state for the requested thread |

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
