# Users

> **Status: draft proposal.** Not yet part of the frozen specification surface.

A **user** is a scope owned by a runtime principal. It comprises durable values, packaged HTTP endpoints, an event stream, and credential grants. Threads reference users; the surfaces in this section are addressable independently of any thread.

[MCP servers](/0.2.0/specification/mcp-servers) execute requests as the authenticated user and maintain a home thread per user and server.

## 1. Identity

1. A runtime MUST resolve every authenticated request to a stable user id.
2. A runtime with exactly one principal MUST resolve all requests to a single constant user id.
3. A thread MAY have no user. For such threads, `state.user()` MUST resolve `null` and every surface in this section MUST be unavailable.
4. The identity record exposes only the following fields. Credential material MUST NOT appear in it.

```typescript
interface UserIdentity {
  id: string
  username?: string | null
  email?: string | null
  display_name?: string | null
  avatar_url?: string | null
  role?: string | null
  roles?: string[]
  permissions?: string[] | null
}
```

### Application roles

`roles` is an optional list of opaque, case-sensitive application role strings
supplied by the runtime's trusted identity authority. It is distinct from the
runtime-defined `role` and `permissions` fields. An absent or empty list grants
no application roles. No role string implies a built-in runtime privilege, and
the specification defines no wildcard expansion or role hierarchy.

Applications may adopt names such as `reports:read` or `releases:canary` and
check them before protected operations. A name ending in `:*` has meaning only
when application code explicitly implements that convention. Clients and
user-writable values MUST NOT be accepted as the source of authoritative roles.
A runtime that supplies roles MUST expose them through `UserState.identity()`
and the identity returned by `ThreadState.user()`. Runtimes MUST document their
authorization freshness boundary; an identity may be a snapshot within one
request or execution. Applications should authorize each protected request or
execution instead of persisting a previously granted decision indefinitely.

## 2. UserState

User endpoints (§3) receive a `UserState`:

```typescript
interface UserState {
  userId: string
  identity(): Promise<UserIdentity>

  getValue<T = unknown>(key: string): Promise<T | null>
  setValue(key: string, value: unknown): Promise<void>
  listValues(options?: { prefix?: string; limit?: number; offset?: number }):
    Promise<{ entries: { key: string; value: unknown; updated_at: number }[]; total: number }>

  env(name: string): Promise<string>
  instanceEnv?(name: string): Promise<string | undefined>

  emit(event: string, data?: unknown): void
  clients(): Promise<UserRoomConnection[]>
  send(clientId: string, frame: unknown): Promise<boolean>
  roomAttachments?: UserRoomAttachments

  listThreads(options?: { agentId?: string; limit?: number; offset?: number }):
    Promise<{ threads: { id: string; agent_id: string; tags: string[]; created_at: number }[]; total: number }>

  fetch(grant: string, input: string | URL, init?: RequestInit): Promise<Response>

  /** Raise one of this user's threads at rest (see 2.2). */
  thread(threadId: string): Promise<ThreadState>
}
```

### 2.1 Serialization

1. A runtime MUST serialize user endpoint executions (§3) and `UserHandle.call()` invocations (§5) per user: at most one executes at a time, and each observes the completed writes of all prior executions for that user.
2. Value access outside user endpoints (`UserHandle.getValue`/`setValue`, pre-existing user-value APIs) is NOT serialized. Runtimes MUST NOT extend the §2.1.1 guarantee to those surfaces.

### 2.2 Reaching Threads

`thread(threadId)` resolves a `ThreadState` for a thread at rest — the same materialization [thread endpoints](/0.2.0/specification/threads/endpoints) receive (`state.execution` is `null`), without requiring the runtime to address itself over the network.

1. `thread()` MUST reject for threads not belonging to the user.
2. Operations on the resolved `ThreadState` execute in the thread scope; the §2.1 guarantee does not extend across them.
3. A runtime MUST fail — not deadlock — a reentrant user-scope invocation (`state.user().call()`) made from code reached through `thread()` within the same user execution.

### 2.3 Environment

`env(name)` resolves in this order, the tail of the [thread order](/0.2.0/specification/threads):

1. User-account environment variables
2. Runtime instance environment variables

It rejects when neither defines the name. A value configured once for the
instance is therefore visible to user endpoints and user hooks as it is to
threads, and a user-account value overrides it for that user.

The optional `instanceEnv(name)` capability reads exclusively from the runtime
instance. It must not consider user values. It returns `undefined` when the key
is not configured and rejects when the runtime cannot read its instance
environment. Use it when a value establishes a trust boundary, such as a
service endpoint and the credential sent to that endpoint. Consumers that
require this boundary must feature-detect the method and fail closed if the
capability is unavailable or the required instance value is missing.

## 3. User Endpoints

User endpoints expose HTTP APIs for user-scoped operations. They resolve the authenticated caller's user and provide a `UserState` instance to the handler.

### 3.1 Defining User Endpoints

```typescript
// users/quota.post.ts
import { defineUserEndpoint } from '@standardagents/spec';

export default defineUserEndpoint(async (req, user, params) => {
  const used = (await user.getValue<number>('quota.used')) ?? 0;
  const limit = Number(await user.getValue('quota.limit')) || 0;
  const { amount } = await req.json();
  if (used + amount > limit) {
    return Response.json({ ok: false, used, limit }, { status: 429 });
  }
  await user.setValue('quota.used', used + amount);
  user.emit('quota_changed', { used: used + amount, limit });
  return Response.json({ ok: true, used: used + amount, limit });
});
```

### 3.2 File-Based Routing

User endpoint files live in the project or package `users/` directory — a resource directory parallel to thread endpoints, tools, and hooks. Routing follows the thread-endpoint rules ([Thread Endpoints](/0.2.0/specification/threads/endpoints) §2) — method suffixes, nested directories, `[param]` and `[*]` segments — mounted at:

```text
{runtime_prefix}/users/me/{endpoint_path}
```

Nested directories namespace endpoints; packages SHOULD root their user endpoints in a directory named for the package so installed packages coexist by convention:

```text
users/standardcode/lease_acquire.post.ts  →  {runtime_prefix}/users/me/standardcode/lease_acquire
```

1. `me` routes MUST require the authenticated caller to be the addressed user.
2. A runtime MUST serve the same endpoints beneath `users/{id}/` to callers authorized to administer that user.
3. The runtime MUST identify the caller channel to the handler via the `X-Standard-Agents-Caller` request header — `user` (the user's own HTTP request), `admin` (administrative addressing), or `thread` (a runtime-internal `UserHandle.call()`) — and MUST overwrite any inbound value on public routes so the channel cannot be forged. Endpoints enforcing runtime-only semantics (entitlements, quotas) gate mutations on the `thread` channel.
4. Requests beneath the user endpoint prefix that match no route MUST return HTTP 404.
5. A `ThreadState` MUST NOT be available to user endpoint handlers.
6. Packed user endpoints share the route namespace with local user endpoints, exactly as packed thread endpoints do.

## 4. Event Stream

```
GET {runtime_prefix}/users/me/stream        (WebSocket upgrade)
GET {runtime_prefix}/users/{id}/stream      (administrative callers)
```

1. `emit(event, data)` MUST deliver the frame `{ "event": string, "data": unknown }` to every socket attached to that user's stream and every admitted, identified room connection (§7.1), in emit order per user. This room delivery is a room broadcast; pending room attachments are excluded.
2. Delivery is at-most-once. The stream carries no history and no acknowledgements.
3. A runtime MUST accept multiple concurrent sockets per user, and MUST serve the stream beneath `users/{id}/` to callers authorized to administer that user.
4. Event names are package-defined. Packages SHOULD namespace event names.

## 5. UserHandle

`ThreadState.user()` resolves to a `UserHandle` — the `UserIdentity` fields plus:

```typescript
interface UserHandle extends UserIdentity {
  call(endpoint: string, payload?: unknown): Promise<Response>
  getValue<T = unknown>(key: string): Promise<T | null>
  setValue(key: string, value: unknown): Promise<void>
  emit(event: string, data?: unknown): void
  fetch(grant: string, input: string | URL, init?: RequestInit): Promise<Response>
}
```

1. `call(endpoint, payload)` MUST invoke the named user endpoint for the thread's user under the §2.1 guarantee, and MUST NOT require the runtime to address itself over the network.
2. `endpoint` is a path relative to the user's packaged endpoint namespace. A runtime MUST reject dot segments (`.` or `..`), including percent-encoded or backslash variants, and MUST NOT allow URL normalization to address a route outside that namespace.
3. `call()` MUST reject for user-less threads.
4. The additions to the `state.user()` return value are additive; the identity fields are unchanged.

## 6. Credential Grants

A grant is a named, user-scoped credential with a declared use policy.

```typescript
interface CredentialGrant {
  name: string
  kind: 'bearer' | 'header' | 'query' | 'basic' | 'signing'
  origins: string[]                  // exact origins or suffix wildcards
  inject?: { header?: string; format?: string; query?: string }
  allow?: { tools?: string[]; endpoints?: string[]; userEndpoints?: string[]; userRooms?: string[]; agents?: string[] }
  metadata?: Record<string, unknown>
}
```

1. Secret material is write-only: it MUST NOT be readable by packaged code, models, or clients. Only `metadata` and grant existence are readable.
2. `fetch(grant, input, init)` MUST inject the credential per the grant's `kind` and `inject` policy on the runtime side.
3. The runtime MUST reject a `fetch` whose destination origin is not covered by `origins`.
4. The runtime MUST reject a `fetch` from a caller not covered by `allow`. An absent `allow` denies all callers.
5. The runtime MUST NOT expose injected material through errors, logs, or traces reachable by packaged code.
6. Deleting a grant MUST cause subsequent `fetch` calls to fail with an error distinguishable from a network failure.
7. For `kind: 'signing'`, the runtime exposes signatures produced with the credential; the key itself is subject to §6.1.

## 7. Lifecycle Hooks

A runtime SHOULD support the following user-scope hooks. They execute in the user scope, receive a `UserState`, are observational, and MUST NOT block the triggering operation.

| Hook | Signature |
|------|-----------|
| `user_client_attached` | `(user: UserState, client: { id: string; kind?: string }) => void` |
| `user_client_detached` | `(user: UserState, client: { id: string; kind?: string }) => void` |
| `user_value_changed` | `(user: UserState, key: string) => void` |

User-scope hooks are defined like [thread hooks](/0.2.0/specification/hooks) — a file in the `hooks/` directory exporting `defineHook` — but their scoping differs. Thread hooks attach to agents or prompts (Hooks §1.3); the user scope has neither, so a user-scope hook is **project-scoped**: it is active for every user of the project whenever its definition is present. Any number of definitions of the same hook type may exist; all of them execute, in an order the runtime does not guarantee.

```typescript
// hooks/track_presence.ts
import { defineHook } from '@standardagents/spec';

export default defineHook({
  hook: 'user_client_attached',
  id: 'track_presence',
  execute: async (user, client) => {
    user.emit('presence_changed', { attached: client.id, kind: client.kind });
  },
});
```

### 7.1 User Rooms and Attachment Admission

A runtime MAY support one packaged user room per project. A room definition is
exported with `defineUserRoom` from a `users/<package>/room.ts` module, which
MUST NOT also be routed as an HTTP endpoint. Room frames and presence callbacks
execute under the same per-user serialization guarantee as user endpoints.
Application authentication policy and proof formats belong to the room. If
multiple modules declare rooms, the runtime MUST refuse room upgrades and room
delivery until the ambiguity is resolved; it MUST NOT select one by import
order. Independent user endpoints and event streams remain available.

#### Transport and frame contract

```text
GET {runtime_prefix}/users/me/hub        (WebSocket upgrade)
GET {runtime_prefix}/users/{id}/hub      (administrative callers)
```

The `me` form MUST resolve the authenticated user's identity. The administrative
form MUST require authorization to administer the addressed user. Non-upgrade
requests return HTTP 426. An accepted socket receives `{ "type": "hub_ready" }`;
this acknowledges transport attachment, not application authentication.

The URL query parameters `client_id` and optional `client_kind` are self-declared
text, never credentials. Each is trimmed and truncated to 256 UTF-16 code units;
empty values are absent. Explicit admission requires a nonempty `client_id`
after normalization, otherwise the upgrade returns HTTP 400. Automatic mode
MAY accept an unidentified hub socket for runtime coordination, but it is not
a room connection: it is absent from `clients()`, receives no room broadcasts,
and its frames do not invoke `onFrame`.

Only text frames containing a JSON object with `type: 'room'` and a nonempty
string `id` of at most 256 UTF-16 code units invoke `onFrame`. Other frames do
not invoke the room. The `id` is chosen by the client to correlate replies;
application replies SHOULD echo it. Other fields belong to the application
protocol. The runtime does not automatically acknowledge a room frame.
When no room is defined, an identified connection's valid room frame receives
`{ type: 'room', id, error: 'no_room' }`. Runtimes MAY impose frame size, rate
and delivery budgets, closing connections that exceed them.

Supersession sends `{ type: 'superseded' }` and closes the replaced socket
with code 4001. Clients SHOULD stop automatic reconnection after this signal.
Other runtime close codes are implementation-defined, except for codes
explicitly requested through `roomAttachments.close`.

Room attach/detach uses `onPresence`; it does not also raise the §7
`user_client_attached` / `user_client_detached` hooks. Those hooks describe the
independent user event stream. A room's optional `endpoint` gives the policy
name used for `CredentialGrant.allow.userEndpoints`. Without it, the registry
path (for example `package/room`) is checked against `allow.userRooms`, or
against `allow.userEndpoints` when `userRooms` is absent. An empty `userRooms`
list denies room callers without falling back.
`valuePrefix` reserves all value keys beginning with that prefix from
client-writable value routes and suppresses `user_value_changed` for writes to
those keys. Serialized application code may still read and write them.

```typescript
interface UserRoomConnection {
  clientId: string
  clientKind: string | null
  since: number                  // attachment time, not a unique identity
  attachmentId?: string          // opaque physical attachment identity
}
interface UserRoomAttachments {
  send(attachmentId: string, frame: unknown): Promise<boolean>
  admit(attachmentId: string): Promise<boolean>
  close(attachmentId: string, code?: number, reason?: string): Promise<boolean>
}
interface UserRoomDefinition {
  admission?: 'automatic' | 'explicit'
  endpoint?: string
  valuePrefix?: string
  onFrame(user: UserState, connection: UserRoomConnection,
    frame: { type: 'room'; id: string; [key: string]: unknown }): Promise<void>
  onPresence?(user: UserState, event: {
    kind: 'attached' | 'detached'; connection: UserRoomConnection; at: number
  }): Promise<void>
}
```

`UserState.clients()` lists live admitted room connections, one per client id,
oldest attachment first. `UserState.send(clientId, frame)` targets the admitted
connection for that id and returns false if none exists. Neither method queues
traffic for an absent connection. Ordinary room admission is automatic: a new
connection with the same client id replaces the previous one. Automatic-mode
presence MAY coalesce reconnects within a bounded grace period. A socket retired
for rate, size or send failure MUST also produce a detached event after that
grace period unless an admitted replacement remains.

Explicit admission is an optional capability exposed as
`UserState.roomAttachments?: UserRoomAttachments`. A consumer requiring it MUST
check that this capability and `connection.attachmentId` exist and fail closed
when unavailable. This capability is available during serialized room and user
endpoint executions; observational hooks do not receive it. A runtime
supporting `admission: 'explicit'` MUST implement all the following requirements:

1. A new physical attachment starts pending. Its self-declared client id MUST
   NOT displace an admitted connection. Pending attachments MUST NOT receive
   client-id-targeted traffic, room broadcasts, or runtime wake traffic, and
   MUST NOT appear in `clients()` or count as a reachable execution client.
   This does not change independently authorized user event stream access.
2. `onFrame` receives pending frames so an application can exchange challenges.
   `roomAttachments.send` addresses exactly the named live attachment, including
   a pending attachment. It MUST NOT fall back to another attachment or a client
   id, and MUST return false for detached, superseded, unknown or foreign-user
   attachments. The runtime delivers the supplied frame unchanged, at most once.
3. After verifying its own application proof, the room calls `admit`. Admission
   MUST atomically promote that live attachment and supersede only the previous
   admitted connection for the same client id under the per-user serialization
   guarantee. Other pending attachments remain pending. Repeated admission of
   the same live admitted attachment is idempotent. A stale admission MUST
   return false and MUST NOT affect the current admitted connection.
4. Attachment identities MUST be opaque and unique per physical connection,
   including connections created in the same clock tick. A reconnect MUST get
   a new identity. Hibernation retaining the physical socket MUST retain its
   identity and admission state. A restored legacy socket lacking admission
   state MUST start pending in explicit mode.
5. Detached or superseded attachments MUST NOT be resurrected by delayed
   callbacks or queued frames. A queued frame whose attachment ceased to be
   live before execution MUST NOT invoke the room handler.
6. Explicit-mode presence reports each physical attach and detach, including
   pending and superseded attachments, without a reconnect grace period.
   Callbacks carry the attachment identity so an application can discard
   attachment-specific challenges. Application state remains responsible for
   its own challenge expiry and restart recovery.
7. A room is declared when a module at a room path exports a `defineUserRoom`
   definition. Other modules at that path remain ordinary user endpoints. If
   loading a room path fails, the runtime MUST reject new room upgrades and
   MUST treat existing room attachments as not admitted while its admission
   policy is unknown. The failure MUST NOT affect user endpoints, the §4 event
   stream, wake delivery to stream sockets, or detach handling for any socket.
   A runtime SHOULD retry loading on a later call instead of caching the
   failure. It MUST NOT silently enable automatic admission. Existing
   automatic-mode consumers retain their behavior when they do not opt in.
8. `roomAttachments.close` closes exactly the named live attachment, pending or
   admitted, and reports its detach as in item 6 in explicit mode; automatic
   mode uses its normal reconnect grace period. It uses the same addressing
   rules as `send`, returning false for unknown, detached, superseded or
   foreign-user attachments without affecting another socket. The default
   code is 1000 and reason is empty. A supplied code MUST be 1000 or an integer
   in 3000–4999, and the reason MUST contain at most 123 UTF-8 bytes; invalid
   arguments MUST reject without retiring the live attachment. A subsequent
   `send`, `admit` or `close` for the retired attachment returns false.
9. A runtime MAY bound the number of pending attachments per user or per client
   id, and the time an attachment may remain pending. It MUST close an
   attachment that exceeds a bound and report the detach per item 6. Exact
   bounds are implementation-defined.

These are transport admission guarantees; they prescribe no application
credentials, cryptographic handshake, or machine identity model.

## 8. Conformance

| # | Requirement | Level |
|---|-------------|-------|
| 1 | Stable user id per principal; constant id on single-principal runtimes (§1) | MUST |
| 2 | `UserState` value surface (§2) | MUST |
| 3 | Per-user serialized execution of user endpoints and `call()` (§2.1) | MUST |
| 4 | User endpoint routing and authorization (§3) | MUST |
| 5 | Event stream semantics (§4) | MUST |
| 6 | `UserHandle` on `state.user()` (§5) | MUST |
| 7 | Grant policy enforcement (§6) when grants are supported | MUST |
| 8 | Grant support (§6) | SHOULD |
| 9 | Lifecycle hooks (§7) | SHOULD |
| 10 | Administrative addressing of endpoints and stream beneath `users/{id}/` (§3.2, §4) | MUST |
| 11 | Attachment admission semantics (§7.1), when explicit rooms are supported | MUST |

## Appendix A. Notes (Non-normative)

- **Serialization rationale.** Quotas, leases, counters, and registries require read-modify-write atomicity; §2.1 places it on user endpoints so plain value writes stay cheap.
- **Reference mapping.** The Cloudflare runtime implements the user scope on its per-user Durable Object: serialized execution is native, stream sockets attach to the object, and `call()` is object-to-object RPC.
- **Out of scope.** Authentication flows, account and billing records, and identity semantics are runtime concerns. Products project their results into values, env, or grants.
- **Motivating consumers.** Cross-device registries and presence; entitlement gating with live occupancy events; per-user integrations consumed by tools via `user.fetch(grant, …)` without secret exposure.
- **Room conformance guidance.** Exercise unverified duplicate client ids while
  preserving the admitted socket and its routed traffic, attachment-only
  replies and rejection, atomic promotion, stale admission and queued frames
  after detach, physical disconnect notifications, hibernation with pending
  and admitted sockets, legacy restoration, and automatic-mode compatibility.
