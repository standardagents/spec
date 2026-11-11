# MCP Servers

An **MCP server** binds one agent to a separately declared set of tools. This section specifies the Standard Agent layer over [Model Context Protocol revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28).

## 1. Scope

1. A runtime **MAY** support MCP servers.
2. A runtime that supports them **MUST** implement this section and the server requirements of MCP revision `2026-07-28` over Streamable HTTP.
3. A packed package **MAY** include MCP server definitions and their referenced agent and tools.
4. A runtime without this capability **MUST** ignore those definitions without failing to load the package on their account.

## 2. Definition

```typescript
interface McpServerDefinition {
  name: string
  title: string
  description: string
  agent: StandardAgentSpec.Agents
  scopes?: string[]
  tools?: { name: StandardAgentSpec.Tools; scopes?: string[] }[]
  conversation?: { scopes?: string[] }
}

defineMcpServer(definition: McpServerDefinition): McpServerDefinition
```

1. `name` **MUST** be unique among the runtime's server definitions and **MUST** be a nonempty URL path segment containing only ASCII letters, digits, `_`, `-`, or `.` other than `.` or `..`.
2. `title` and `description` **MUST** be nonempty strings.
3. `agent` **MUST** name exactly one resolvable agent definition.
4. Each `tools` entry **MUST** name a resolvable function tool definition.
5. Each scope required by a tool or by `conversation` **MUST** occur in `scopes`.
6. Scope names **MUST** be nonempty OAuth scope tokens and **MUST NOT** repeat within a list.
7. Tool names **MUST NOT** repeat or collide with the conversation tool names in §6.
8. A runtime **MUST** reject an invalid definition before exposing its endpoint.
9. Several server definitions **MAY** bind the same agent.
10. An agent without a server definition **MUST NOT** be reachable over MCP.

## 3. Routes

```text
POST {runtime_prefix}/mcp/{server}
GET  /.well-known/oauth-protected-resource{runtime_prefix}/mcp/{server}
```

1. The runtime chooses `{runtime_prefix}` as in the [Thread Client API](/0.2.0/specification/threads/client-api#2-routes); an empty prefix is permitted.
2. `{server}` **MUST** be the definition's `name`.
3. The externally visible absolute endpoint URL **MUST** be the server's canonical resource URI.
4. The metadata route **MUST** serve the protected resource metadata for that URI, with `resource` equal to the canonical URI and `authorization_servers` naming at least one authorization server.
5. The metadata URL in an authentication challenge **MUST** identify that metadata route on the canonical URI's origin.
6. An MCP endpoint **MUST** use MCP and OAuth error bodies, not the error body defined by [Thread Client API §3.2](/0.2.0/specification/threads/client-api#32-bodies-and-errors).

## 4. Authorization

1. The runtime **MUST** act as the OAuth resource server for each endpoint.
2. The runtime **MUST** reject an access token unless its audience identifies only that server's canonical resource URI.
3. The runtime **MUST** resolve the authenticated user from the token and execute each request as that user.
4. An absent or invalid credential **MUST** produce `401` with a Bearer `WWW-Authenticate` challenge containing `resource_metadata`.
5. A call lacking any required scope **MUST** produce `403` with a Bearer challenge containing `error="insufficient_scope"`, the required `scope`, and `resource_metadata`.
6. A declared tool requires all scopes in its entry; every conversation tool requires all scopes in `conversation`.
7. An omitted or empty scope list requires no additional scope for that tool.
8. Token issuance, client registration, sign-in, and consent are outside this section; an authorization server **MAY** be separate from the runtime.

## 5. Tool Exposure and Threads

1. The MCP tool list **MUST** contain exactly the declared function tools and, when `conversation` is present, the tools in §6.
2. The runtime **MUST NOT** expose the bound agent's prompts, tool list, subagents, or thread internals through MCP unless explicitly declared as tools.
3. A declared tool's MCP name, description, and input schema **MUST** derive from its definition.
4. The runtime **MUST** validate arguments against the tool's schema and execute the tool as the authenticated user with the home thread's state.
5. A declared tool call **MUST NOT** initiate a model turn.
6. The runtime **MUST** return the tool's result as MCP content: a string result as text, and any other JSON-serializable result as JSON text; it **MUST** report execution failure as a tool error.
7. For each user and server pair, the runtime **MUST** create one durable home thread of the bound agent on first tool use and reuse it on later calls.
8. Home thread creation **MUST** be atomic for concurrent first uses and set the authenticated user as owner.
9. Conversation tools **MUST** use the home thread when `threadId` is omitted.
10. A named thread **MUST** be accessible to the authenticated user and belong to the bound agent; otherwise the tool **MUST** return `not found` without distinguishing the reason.
11. Thread selection **MUST** use the explicit `threadId` argument or the home thread; MCP supplies no conversation identifier.
12. The runtime **MUST** serialize declared tool execution with other work on the home thread under the runtime's thread execution rules.

## 6. Conversation Tools

When `conversation` is present, the server exposes the following tools. Their arguments are JSON objects; optional fields may be omitted. Unknown fields **MUST** be rejected as tool input errors. Results below are JSON objects returned in MCP `structuredContent` and as JSON text in a text content block.

| Tool | Arguments | Result |
|------|-----------|--------|
| `thread_send` | `{ content: string, threadId?: string }` | `SendResult` |
| `thread_reply` | `{ messageId: string, threadId?: string }` | `SendResult` |
| `thread_create` | `{}` | `{ threadId: string }` |
| `thread_list` | `{}` | `{ threads: { threadId: string }[] }` |

```typescript
interface ReplyMessage {
  id: string
  role: 'assistant'
  content: string | null
}

type SendResult =
  | { status: 'pending'; threadId: string; messageId: string }
  | { status: 'completed'; threadId: string; messageId: string; messages: ReplyMessage[] }
  | { status: 'failed'; threadId: string; messageId: string }
```

1. `thread_create` **MUST** create a root thread of the bound agent owned by the authenticated user without starting execution.
2. `thread_list` **MUST** return all and only threads accessible to the user whose agent is the bound agent.
3. `thread_send` **MUST** reject empty or whitespace-only `content` as a tool input error.
4. `thread_send` **MUST** accept a `user` message durably and deliver it with the queueing semantics of [Thread Client API §12](/0.2.0/specification/threads/client-api#12-sending-a-message), including its stream publication requirements.
5. `messageId` **MUST** identify that accepted message and remain usable by `thread_reply` after the request ends.
6. The runtime **MUST** associate with a send the non-silent assistant messages persisted after its delivery and before the next queued message is delivered or the execution settles, whichever occurs first, in persistence order.
7. A send **MUST** be `completed` when that boundary is reached successfully, even when it produced no assistant messages.
8. A send **MUST** be `failed` when execution fails, is aborted, or the thread terminates before that boundary.
9. If the send has not reached a terminal status before the runtime ends the request, `thread_send` **MUST** return `pending` without cancelling the accepted work.
10. `thread_reply` **MUST** return the current status and, on completion, the same ordered messages for the identified send without enqueueing another message.
11. An unknown send, a send belonging to another user or server, or a send outside the selected thread **MUST** produce the same `not found` tool error.
12. The runtime **MUST** retain the send's status and reply for at least as long as the thread and accepted message exist.
13. A terminated thread or failed acceptance **MUST** produce a tool error without reporting a send as accepted.
14. A tool input or execution failure **MUST** use an MCP tool result with `isError: true`; malformed protocol requests and unknown tools **MUST** use MCP JSON-RPC errors.

## 7. Conformance Summary

| Scenario | Required result |
|----------|-----------------|
| No MCP capability | Package loads while server definitions are ignored |
| Token for another server | Request rejected |
| Undeclared tool | Tool absent from list and unavailable to call |
| Concurrent first use | One home thread for the user and server |
| Inaccessible or wrong-agent thread | `not found` tool error |
| Send outlives request | `pending` receipt can be retrieved with `thread_reply` |

## Appendix A. Example (Non-Normative)

```typescript
defineMcpServer({
  name: 'support',
  title: 'Support',
  description: 'Support tools and conversation',
  agent: 'support_agent',
  scopes: ['support:read', 'support:chat'],
  tools: [{ name: 'search_docs', scopes: ['support:read'] }],
  conversation: { scopes: ['support:chat'] },
})
```
