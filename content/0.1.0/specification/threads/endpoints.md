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

Requests beneath the thread endpoint prefix that do not match any local or packed thread endpoint route MUST return HTTP 404.

## 3. Handler Signature

Thread endpoint handlers receive:

| Parameter | Type | Description |
|-----------|------|-------------|
| `req` | `Request` | The incoming HTTP request |
| `state` | `ThreadState` | Thread state for the requested thread |
| `params` | `Record<string, string>` | Route parameters captured from dynamic or catch-all endpoint path segments |
| `auth` | `ThreadEndpointAuth` | The request's authentication context (see [Access and Authentication](#4-access-and-authentication)) |

The supplied `ThreadState` includes the standard thread surface, including `runCode`. Handlers that do not consume trailing parameters may omit them.

The handler **MUST** return a `Response` object.

## 4. Access and Authentication

Every endpoint has an access level, declared at definition time:

```typescript
import { defineThreadEndpoint } from '@standardagents/spec';

export default defineThreadEndpoint(
  async (req, state, params, auth) => {
    return Response.json({
      threadId: state.threadId,
      authorized: auth.threadAccess,
    });
  },
  { access: 'public' }
);
```

| Access level | Requirements |
|--------------|-------------|
| `authenticated` (default) | The runtime **MUST** authenticate the request and enforce its thread access policy before invoking the handler. Requests that fail authentication or authorization **MUST** be rejected without invoking the handler. |
| `public` | The runtime **MUST** invoke the handler regardless of the request's authentication state. The runtime **MUST** still attempt caller resolution: a request presenting credentials the runtime can verify is attributed to that caller; any other request is treated as anonymous rather than rejected. |

When no access level is declared, the access level is `authenticated`. The declaration is attached to the handler itself, so packed thread endpoints carry their access level with them and are subject to the same requirements as local thread endpoints.

The fourth handler argument is the authentication context:

| Property | Type | Requirements |
|----------|------|-------------|
| `caller` | `ThreadUser \| null` | **MUST** be the authenticated identity when the request presented credentials the runtime verified, and `null` otherwise. For an endpoint whose access level is `authenticated`, `caller` is always non-null. |
| `threadAccess` | `boolean` | **MUST** be `true` if and only if the runtime's thread access policy grants the resolved caller access to the requested thread. **MUST** be `false` when `caller` is `null`. For an endpoint whose access level is `authenticated`, `threadAccess` is always `true`. |

`caller` uses the same `ThreadUser` identity shape as `state.user()` — identity fields only, never credentials. Note that `caller` identifies who is making the request, while `state.userId` identifies who owns the thread; the two frequently differ.

The mechanism by which a runtime authenticates requests (sessions, API keys, or otherwise) is implementation-defined. This specification defines only the identity contract observable by endpoint code.

## 5. Endpoint Context

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

## 6. Error Handling

Thread endpoints automatically handle common errors:

| Condition | Response |
|-----------|----------|
| Thread not found | 404: `{ error: "Thread not found: {threadId}" }` |
| Missing thread ID | 400: `{ error: "Thread ID required" }` |
| No matching thread endpoint route under the thread endpoint prefix | 404 |

## 7. Examples

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
