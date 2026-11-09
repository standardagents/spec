# Thread Client API

The **thread client API** is the set of HTTP routes and the WebSocket stream through which a client lists agents, creates, reads, renames, deletes, messages, stops, and observes threads, and reads the files that messages reference. The runtime defines it. Packages do not.

[Thread endpoints](/0.2.0/specification/threads/endpoints) are a separate surface: routes that a package defines beneath a thread. The in-process forms of the operations in this section are specified by [`ThreadState`](/0.2.0/specification/threads) and [`UserState`](/0.2.0/specification/users).

## 1. Scope

1. A runtime **SHOULD** expose the thread client API.
2. A runtime that exposes it **MUST** implement every route in §2 as specified in this section.
3. A runtime **MAY** define routes, query parameters, request fields, response fields, and stream frame types beyond those specified here.
4. A client **MUST** ignore response fields and stream frame types it does not recognize.
5. Sign-in, which is how a caller obtains a credential, is implementation-defined.
6. Thread retention is runtime-defined.

## 2. Routes

```text
POST   {runtime_prefix}/auth/websocket-ticket
GET    {runtime_prefix}/agents
POST   {runtime_prefix}/threads
GET    {runtime_prefix}/threads
GET    {runtime_prefix}/threads/{threadId}
PATCH  {runtime_prefix}/threads/{threadId}
DELETE {runtime_prefix}/threads/{threadId}
GET    {runtime_prefix}/threads/{threadId}/messages
POST   {runtime_prefix}/threads/{threadId}/messages
DELETE {runtime_prefix}/threads/{threadId}/messages/{messageId}
GET    {runtime_prefix}/threads/{threadId}/fs/{path}
POST   {runtime_prefix}/threads/{threadId}/stop
GET    {runtime_prefix}/threads/{threadId}/stream        (WebSocket upgrade)
```

1. The runtime chooses `{runtime_prefix}`.
2. [Thread endpoints](/0.2.0/specification/threads/endpoints) are mounted beneath the same `{runtime_prefix}/threads/{threadId}/` prefix. The endpoint paths `messages`, `fs`, `stop`, and `stream`, and every path beneath `messages/` and `fs/`, are reserved for this API. A package **SHOULD NOT** define thread endpoints at those paths.

## 3. Common Requirements

### 3.1 Authentication and access

1. Every route **MUST** require an authenticated caller.
2. The runtime **MUST** accept a credential presented in the request header `Authorization: Bearer {credential}` on every HTTP route.
3. The runtime **MUST** accept a stream ticket (§4) on the thread stream upgrade (§16).
4. The runtime **MUST NOT** accept a long-lived credential in a URL.
5. A runtime **MAY** accept other credential transports, such as a session cookie.
6. A route addressed to a thread **MUST** enforce the runtime's thread access policy for the resolved caller before it reads or changes the thread.

### 3.2 Bodies and errors

1. Request and response bodies **MUST** be JSON, except the file response in §14.
2. Property names are case-sensitive and **MUST** be spelled exactly as given in this section.
3. A failed request **MUST** return a non-2xx status with the body `{ "error": string }`. The `error` text is informational.
4. For each condition in the table below, the runtime **MUST** return the corresponding status.
5. For an internal failure or temporary unavailability, the runtime **MUST** return a `5xx` status. It **MUST NOT** report such a failure with a status from the table.

| Status | Condition |
|--------|-----------|
| `400` | The request is malformed or fails validation |
| `401` | The caller is not authenticated |
| `403` | The caller is denied access to the thread |
| `404` | The addressed thread, message, or file, or the agent named in a create request, does not exist |
| `423` | The thread is terminated |

### 3.3 Timestamps

| Value | Unit |
|-------|------|
| Thread `created_at`, `last_activity_at`, `last_message_at` | Seconds since the Unix epoch |
| Message `created_at` | Microseconds since the Unix epoch |
| `ThreadStatus.since` | Microseconds since the Unix epoch |
| `event` frame `timestamp` | Milliseconds since the Unix epoch |

## 4. Stream Tickets

```text
POST {runtime_prefix}/auth/websocket-ticket
```

A **stream ticket** is a short-lived, single-use credential that authorizes one WebSocket upgrade.

```typescript
interface StreamTicketRequest {
  pathname: string        // path of the WebSocket URL, including {runtime_prefix}
}

interface StreamTicketResponse {
  ticket: string
  expires_in: number      // seconds
}
```

1. A successful request **MUST** return `200` with a `StreamTicketResponse` and the response header `Cache-Control: no-store`.
2. The runtime **MUST** return `400` when `pathname` is absent, is not a normalized path beneath `{runtime_prefix}`, or contains a query or fragment.
3. A client presents the ticket as the query parameter `ticket` on the WebSocket upgrade request.
4. The runtime **MUST** authenticate an upgrade that presents a valid ticket as the caller who requested the ticket.
5. A ticket **MUST** be valid only for an upgrade whose path equals `pathname`.
6. A ticket **MUST** be valid for at most one upgrade.
7. A ticket **MUST** expire no later than `expires_in` seconds after it is issued. `expires_in` **SHOULD NOT** exceed `60`.
8. The runtime **MUST** reject an upgrade that presents an unknown, expired, used, or mismatched ticket with `401`.

## 5. Listing Agents

```text
GET {runtime_prefix}/agents
```

```typescript
interface AgentList {
  agents: AgentListEntry[]
}

interface AgentListEntry {
  id: string                      // the value a create request passes as agent_id
  name: string
  title: string
  description: string | null
  icon: string | null
  primary: boolean
  side_a_backing: 'human' | 'prompt' | 'handler'
  side_b_backing: 'human' | 'prompt' | 'handler'
}
```

1. A successful request **MUST** return `200` with an `AgentList`.
2. The runtime **MUST** accept every listed `id` as the `agent_id` of a create request (§6) from the same caller.
3. `title` **MUST** be the agent's `title`, or its `name` when the agent defines no title.
4. `primary` **MUST** be `false` when the [agent definition](/0.2.0/specification/agents#22-optional) sets `primary: false`, and `true` otherwise.
5. `side_a_backing` and `side_b_backing` **MUST** report the [backing](/0.2.0/specification/agents) of each side.

## 6. Creating a Thread

```text
POST {runtime_prefix}/threads
```

```typescript
interface CreateThreadRequest {
  agent_id: string                  // an AgentListEntry id
  tags?: string[]
  env?: Record<string, string>      // thread-level environment values
}

interface CreateThreadResponse {
  threadId: string
  agent_id: string
}
```

1. The runtime **MUST** set the owner of the new thread from the authenticated caller. The request **MUST NOT** be able to name a different owner.
2. Creating a thread **MUST NOT** start an execution.
3. A successful request **MUST** return `200` with a `CreateThreadResponse`.
4. The runtime **MUST** return `400` when `agent_id` is absent or `tags` is not an array of strings.
5. The runtime **MUST** return `404` when no agent is identified by `agent_id`.

## 7. Listing Threads

```text
GET {runtime_prefix}/threads
```

| Query parameter | Default | Meaning |
|-----------------|---------|---------|
| `limit` | `50` | Maximum number of threads returned |
| `offset` | `0` | Number of threads skipped |
| `agent_id` | — | Restricts the result to threads of the named agent |

```typescript
interface ThreadList {
  threads: ThreadListEntry[]
  total: number
  hasMore: boolean
}

interface ThreadListEntry {
  id: string
  agent_id: string
  user_id: string | null              // owner; null when the thread has none
  tags: string[]
  parent: string | null               // parent thread id; null for a root thread
  terminated: number | null           // termination time; null while the thread is open
  created_at: number
  last_activity_at: number
  last_message_preview: string | null
  last_message_at: number | null
  status: ThreadRunState              // 'idle' | 'running' | 'failed'
  status_reason: string | null        // failure reason while status is 'failed', else null
  agent: {
    name: string
    title: string
    description?: string
    icon?: string
    side_a_backing?: 'human' | 'prompt' | 'handler'
    side_b_backing?: 'human' | 'prompt' | 'handler'
  }
}
```

1. A successful request **MUST** return `200` with a `ThreadList`.
2. A caller without administrative rights **MUST** receive only threads that the caller owns.
3. The runtime **MUST** return threads in descending `last_activity_at` order unless the request selects another order through a runtime-defined parameter.
4. `total` **MUST** be the number of threads matching the request before `limit` and `offset` are applied.
5. `hasMore` **MUST** be `true` if and only if matching threads exist beyond the returned page.
6. `last_activity_at` **MUST** equal `created_at` for a thread with no later activity.
7. `last_message_preview` is a plain-text excerpt of a recent message in the thread, or `null`. Its source message and length are runtime-defined.
8. `agent.title` **MUST** be the agent's `name` when the agent defines no title or its definition is no longer available.
9. `ThreadListEntry.status` is the [run state](/0.2.0/specification/threads/execution-state#4-run-status) only. It is not a `ThreadStatus` object.

## 8. Reading a Thread

```text
GET {runtime_prefix}/threads/{threadId}
```

```typescript
interface ThreadRead {
  thread: {
    id: string
    agent_id: string
    user_id: string | null
    tags: string[]
    parent: string | null
    terminated: number | null
    created_at: number
  }
  agent: {
    id: string
    title: string
    description?: string
    icon?: string
    side_a_backing: 'human' | 'prompt' | 'handler'
    side_b_backing: 'human' | 'prompt' | 'handler'
  } | null
  status: ThreadStatus
}
```

1. A successful request **MUST** return `200` with a `ThreadRead`.
2. `status` **MUST** equal the [`ThreadStatus`](/0.2.0/specification/threads/execution-state#4-run-status) that `state.status()` resolves for the thread.
3. `agent` **MUST** be `null` when the thread's agent definition is no longer available.

## 9. Updating a Thread

```text
PATCH {runtime_prefix}/threads/{threadId}
```

```typescript
interface UpdateThreadRequest {
  tags?: string[]
}

interface UpdateThreadResponse {
  id: string
  agent_id: string
  user_id: string | null
  tags: string[]
  created_at: number
}
```

1. When `tags` is present, the runtime **MUST** replace the thread's tags with the given array.
2. A successful request **MUST** return `200` with an `UpdateThreadResponse` that reflects the update.
3. The runtime **MUST** return `400` when `tags` is not an array of strings, or when the request names no field the runtime updates.

## 10. Deleting a Thread

```text
DELETE {runtime_prefix}/threads/{threadId}
```

```typescript
interface DeleteThreadResponse {
  success: true
  threadId: string
  deletedThreadIds: string[]
  deletedCount: number
}
```

1. The runtime **MUST** delete the thread and every descendant thread, with their messages and files.
2. A successful request **MUST** return `200` with a `DeleteThreadResponse`. `deletedThreadIds` **MUST** list every deleted thread, including `threadId`.
3. After a successful request, every route addressed to a deleted thread **MUST** return `404`.

## 11. Reading Messages

```text
GET {runtime_prefix}/threads/{threadId}/messages
```

| Query parameter | Default | Meaning |
|-----------------|---------|---------|
| `limit` | `100` | Maximum number of messages returned |
| `offset` | `0` | Number of messages skipped from the start of the selection |
| `order` | `desc` | `desc` selects from the newest message backwards. `asc` selects from the oldest message forwards |
| `includeSilent` | `false` | `true` includes [silent](/0.2.0/specification/threads/messages#32-presentation-silent) messages |
| `depth` | `0` | Maximum message depth included |

```typescript
interface MessagesPage {
  messages: Message[]
  total: number
  hasMore: boolean
}
```

1. A successful request **MUST** return `200` with a `MessagesPage`.
2. Each entry of `messages` **MUST** be a [message record](/0.2.0/specification/threads/messages#1-message-structure) in its decoded form: `attachments` is an array or `null`, and `silent` is a boolean.
3. Under `order=desc`, the runtime **MUST** return the selected messages in ascending `created_at` order, so the newest selected message is last.
4. The runtime **MUST** exclude silent messages unless `includeSilent` is `true`.
5. The runtime **MUST** exclude messages whose `depth` exceeds the `depth` parameter.

## 12. Sending a Message

```text
POST {runtime_prefix}/threads/{threadId}/messages
```

```typescript
interface SendMessageRequest {
  role: 'user' | 'assistant' | 'system'
  content?: string
  attachments?: Attachment[]
}

interface Attachment {
  name: string          // file name
  mimeType: string
  data: string          // base64-encoded bytes
  width?: number        // images
  height?: number       // images
  thumbnail?: string    // base64-encoded bytes
}

interface SendMessageResponse {
  status: 'queued'
  messageId: string
}
```

1. The runtime **MUST** return `400` when `role` is absent or is not one of the three values above.
2. The runtime **MUST** return `400` when `content` is empty or absent and `attachments` is empty or absent.
3. The runtime **MUST** return `423` when the thread is terminated.
4. The runtime **MUST** store each attachment in the thread's [file system](/0.2.0/specification/threads/filesystem) and reference it from the message's `attachments` as an [`AttachmentRef`](/0.2.0/specification/threads/messages#12-attachment-references).
5. The runtime **MUST** accept the message durably and return `202` with a `SendMessageResponse` without waiting for the resulting execution.
6. The runtime **MUST NOT** return `202` for a message it did not accept durably. When acceptance fails, the runtime **MUST** return a `5xx` status (§3.2), and the message **MUST NOT** be delivered.
7. The runtime **MUST** deliver the accepted message with the semantics of [`queueMessage`](/0.2.0/specification/threads/messages#4-queueing-messages).
8. `messageId` **MUST** be the `id` of the message record once it is persisted.
9. The runtime **MUST** publish the accepted message to the thread stream (§16) as a `message_data` frame carrying that `messageId`. Until the message is persisted, the frame's record has `status: 'pending'`.

## 13. Deleting a Message

```text
DELETE {runtime_prefix}/threads/{threadId}/messages/{messageId}
```

1. The runtime **MUST** delete the message with the semantics of [`deleteMessage`](/0.2.0/specification/threads/messages#6-deleting-messages).
2. A successful request **MUST** return `200` with the body `{ "success": true }`.
3. The runtime **MUST** return `404` when the thread holds no message with that id.
4. This section defines no stream frame for a deletion.

## 14. Reading a File

```text
GET {runtime_prefix}/threads/{threadId}/fs/{path}
```

`{path}` is the file's path in the thread's [file system](/0.2.0/specification/threads/filesystem) without its leading `/`, with each path segment percent-encoded. The `path` of an [`AttachmentRef`](/0.2.0/specification/threads/messages#12-attachment-references) is such a path.

1. For a stored file, a successful request **MUST** return `200` with the file's bytes as the response body.
2. The response **MUST** carry the file's MIME type in `Content-Type` and the header `X-Content-Type-Options: nosniff`.
3. The runtime **MUST** send `Content-Disposition: attachment` for a file whose MIME type is `text/html`, `image/svg+xml`, or `application/xhtml+xml`.
4. The runtime **MUST** return `404` when no file exists at the path.
5. The response for a path that names a directory is implementation-defined.

## 15. Stopping Execution

```text
POST {runtime_prefix}/threads/{threadId}/stop
```

1. The request has no body.
2. The runtime **MUST** abort the execution in flight on the thread, if one exists. That run **MUST** settle as `idle` with reason `aborted_by_user`.
3. The route **MUST** be idempotent. A request addressed to a thread with no execution in flight **MUST** succeed.
4. A successful request **MUST** return `200` with the body `{ "status": "stopped" }`.

## 16. Thread Stream

```text
GET {runtime_prefix}/threads/{threadId}/stream        (WebSocket upgrade)
```

| Query parameter | Default | Meaning |
|-----------------|---------|---------|
| `ticket` | absent | A stream ticket (§4) |
| `depth` | `0` | Maximum message depth delivered on this connection |
| `includeSilent` | `false` | `true` delivers [silent](/0.2.0/specification/threads/messages#32-presentation-silent) messages on this connection |
| `reasoning` | absent | Any value other than the empty string, `0`, or `false` opts this connection in to `reasoning_chunk` frames |

1. The runtime **MUST** reject a request that is not a WebSocket upgrade with `400`.
2. The runtime **MUST** accept multiple concurrent connections to one thread.

### 16.1 Server frames

```typescript
type ThreadStreamFrame =
  | { type: 'thread_status'; status: ThreadStatus }
  | { type: 'message_data'; message_id: string; depth: number; data: Message }
  | { type: 'message_chunk'; message_id: string; depth: number; chunk: string }
  | { type: 'reasoning_chunk'; message_id: string; depth: number; chunk: string }
  | { type: 'event'; eventType: string; data: unknown; timestamp: number }
```

1. Every frame the runtime sends **MUST** be a text frame containing a JSON object with a string `type`. The heartbeat reply (§16.3) is the only exception.
2. `thread_status` carries the thread's [run status](/0.2.0/specification/threads/execution-state#4-run-status).
3. `message_data` carries a complete [message record](/0.2.0/specification/threads/messages#1-message-structure) in `data`. `message_id` **MUST** equal `data.id`.
4. In a `message_data` frame, the runtime **SHOULD** send the decoded form of the record. A client **MUST** also accept `data.attachments` as a JSON-encoded string of the array, and `data.silent` as `0` or `1`.
5. `message_chunk` carries a fragment of the visible content of the assistant message identified by `message_id`.
6. `reasoning_chunk` carries a fragment of model reasoning that accompanies the assistant message identified by `message_id`.
7. `event` carries one [`state.emit(eventType, data)`](/0.2.0/specification/threads#5-events) call.

### 16.2 Delivery

1. The first frame on every accepted connection **MUST** be a `thread_status` frame carrying the current run status.
2. The runtime **MUST** send a `thread_status` frame on every change of run status.
3. The runtime **MUST** send a `message_data` frame when a message is created and when a message is updated.
4. The runtime **MUST** send `message_chunk` frames for one `message_id` in generation order.
5. The runtime **MUST NOT** send a `reasoning_chunk` frame on a connection that did not opt in.
6. The runtime **MUST NOT** send a `message_data`, `message_chunk`, or `reasoning_chunk` frame whose `depth` exceeds the connection's `depth`.
7. The runtime **MUST NOT** send a `message_data` frame for a silent message on a connection that did not set `includeSilent`.
8. `thread_status` and `event` frames **MUST NOT** be filtered by `depth`.
9. Delivery is at-most-once. The stream carries no history and no acknowledgements.
10. A client **MUST** treat `message_data` as a replacement for any record it holds with the same `message_id`.
11. The content of a `message_data` frame is authoritative. It supersedes the `message_chunk` fragments received for the same `message_id`.
12. Reasoning fragments are not persisted. They are not part of the message record.

### 16.3 Heartbeat

1. A client **MAY** send the text frame `stream_ping`.
2. The runtime **MUST** answer `stream_ping` with the text frame `stream_pong`. Neither frame is JSON.
3. A heartbeat **MUST NOT** start or alter an execution.
4. All other client-to-server frames are implementation-defined.

## 17. Conformance

Requirements 2 to 12 apply to a runtime that exposes the thread client API.

| # | Requirement | Level |
|---|-------------|-------|
| 1 | Expose the thread client API (§1) | SHOULD |
| 2 | Every route in §2, mounted beneath `{runtime_prefix}` | MUST |
| 3 | Bearer credentials, stream tickets, and thread access enforcement (§3.1, §4) | MUST |
| 4 | Error statuses, `5xx` for internal failures, and the `{ "error": string }` body (§3.2) | MUST |
| 5 | Agent listing (§5) | MUST |
| 6 | Thread creation, listing, and reading (§6, §7, §8) | MUST |
| 7 | Thread update and deletion (§9, §10) | MUST |
| 8 | Message reading, filtering, and deletion (§11, §13) | MUST |
| 9 | Durable, asynchronous message sending (§12) | MUST |
| 10 | File reading (§14) | MUST |
| 11 | Idempotent stop (§15) | MUST |
| 12 | Stream frames, delivery, and heartbeat (§16) | MUST |

## Appendix A. Example (Non-normative)

```typescript
const base = 'https://runtime.example/api';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }).then((r) => r.json());

const { agents } = await fetch(`${base}/agents`, { headers }).then((r) => r.json());
const { threadId } = await post('/threads', { agent_id: agents[0].id });

const streamUrl = new URL(`${base}/threads/${threadId}/stream`);
const { ticket } = await post('/auth/websocket-ticket', { pathname: streamUrl.pathname });
streamUrl.protocol = 'wss:';
streamUrl.searchParams.set('ticket', ticket);

const drafts = new Map<string, string>();
const socket = new WebSocket(streamUrl);
socket.onmessage = ({ data }) => {
  if (data === 'stream_pong') return;
  const frame = JSON.parse(data);
  switch (frame.type) {
    case 'thread_status':
      console.log('run state:', frame.status.state);
      break;
    case 'message_chunk':
      drafts.set(frame.message_id, (drafts.get(frame.message_id) ?? '') + frame.chunk);
      break;
    case 'message_data':
      drafts.delete(frame.message_id);
      console.log(frame.data.role, frame.data.content);
      break;
  }
};

await post(`/threads/${threadId}/messages`, { role: 'user', content: 'Where is my order?' });
```
