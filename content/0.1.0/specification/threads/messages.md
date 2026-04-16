# Messages

Each thread owns an ordered, persistent list of messages — the conversation history the agent reasons over. Tools, hooks, and endpoints read, inject, queue, and update these messages through `ThreadState`.

This page documents the message record, the APIs for manipulating the list, and delivery semantics for queued messages. Thread identity, execution state, and everything else about threads live on the [Threads](/0.1.0/specification/threads) parent page.

> **Note:** The APIs on this page mutate persisted message storage. To modify, inject, or filter messages **non-destructively** — only for the current model call, with the stored history untouched — use [Hooks](/0.1.0/specification/hooks), specifically `filter_messages`, `prefilter_llm_history`, `before_create_message`, and `before_update_message`.

## 1. Message Structure

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
| `metadata` | `Record<string, unknown>` | Custom metadata (may include runtime status markers such as `status_kind`) |
| `subagent_id` | `string \| null` | Subagent reference UUID associated with the message |
| `subagent_name` | `string \| null` | Projected child agent name (when available) |
| `subagent_title` | `string \| null` | Projected child agent title (when available) |
| `subagent_description` | `string \| null` | Projected child description (when available) |
| `subagent_status` | `string \| null` | Projected child status (when available) |
| `subagent_resumable` | `boolean \| null` | Projected resumable flag (when available) |
| `subagent_blocking` | `boolean \| null` | Projected blocking flag (when available) |
| `subagent_thread_name` | `string \| null` | Projected human-friendly child instance name (when available) |
| `subagent_spawn_group_id` | `string \| null` | Projected spawn grouping identifier (when available) |

## 2. Reading Messages

```typescript
// Get recent messages
const { messages, total, hasMore } = await state.getMessages({
  limit: 50,
  order: 'desc',
});

// Get a single message
const message = await state.getMessage('msg-123');
```

### 2.1 Query Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | `number` | - | Max messages to return |
| `offset` | `number` | 0 | Messages to skip |
| `order` | `'asc' \| 'desc'` | `'desc'` | Sort order |
| `includeSilent` | `boolean` | false | Include silent messages |
| `maxDepth` | `number` | - | Max nesting depth |

## 3. Injecting Messages

Messages can be injected into the conversation:

```typescript
const message = await state.injectMessage({
  role: 'user',
  content: 'Additional context...',
  silent: true, // Hide from UI
  metadata: { source: 'tool' },
});
```

## 4. Queueing Messages

Messages can be queued for delivery on the next execution step:

```typescript
await state.queueMessage({
  role: 'user', // maps to side_b perspective
  content: 'Follow-up task',
  silent: true,
});
```

Queue semantics:
- If the thread is executing, queued messages are injected before the next LLM request.
- If the thread is idle, queueing forces a new turn.
- Queued messages are processed in order.

## 5. Updating Messages

Existing messages can be updated:

```typescript
const updated = await state.updateMessage('msg-123', {
  content: 'Updated content',
  metadata: { edited: true },
});
```

## 6. Deleting Messages

```typescript
const deleted = await state.deleteMessage('msg-123');
```

Returns `true` if the message was found and removed, `false` otherwise. Tool-result messages cascade with their parent assistant message.
