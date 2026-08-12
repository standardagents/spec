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
| `silent` | `boolean` | Client-presentation flag. Ordinary UI lists hide the message. The message remains eligible for model context and history projection hooks. |
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
| `includeSilent` | `boolean` | false | Include silent messages in this query. This option affects read APIs only. |
| `maxDepth` | `number` | - | Max nesting depth |

## 3. Injecting Messages

Messages can be injected into the conversation:

```typescript
const message = await state.injectMessage({
  role: 'user',
  content: 'Additional context...',
  silent: true, // Hide from ordinary UI lists
  metadata: { source: 'tool' },
});
```

### 3.1 Persistence and lifecycle

`injectMessage()` creates a persisted conversation message. The same contract applies during active execution and at rest.

- Implementations **MUST** invoke `before_create_message` and `after_create_message` for every successful injection. See [Hooks §4](/0.1.0/specification/hooks#4-message-lifecycle-hooks).
- The returned promise **MUST** resolve after the message is persisted and available through thread message APIs (`getMessage`, `getMessages`).
- `injectMessage()` **MUST NOT** recursively restart history projection hooks (`filter_messages`, `prefilter_llm_history`).

### 3.2 Presentation (`silent`)

`silent` is a client-presentation flag.

- Clients **MUST** hide silent messages from ordinary message lists unless the caller sets `includeSilent: true`.
- Silent messages **MUST** remain eligible for model context.
- Silent messages **MUST** participate in the ordinary history projection hooks.
- `silent` **MUST NOT** change persistence, lifecycle hooks, or same-execution visibility.

### 3.3 Same-execution visibility

During an active execution, a successfully injected message **MUST** become observable to subsequent tools and hooks in that execution.

[`execution.messageHistory`](/0.1.0/specification/threads/execution-state#22-live-execution-history) **MUST** represent live chronological persisted execution history. It **MUST** include silent messages. Synthetic or transformed messages returned by model-context hooks **MUST** remain confined to the context projection.

### 3.4 Context snapshot assignment

Each model-context assembly takes a stable snapshot of eligible persisted history. See [Runtime §4](/0.1.0/infrastructure/runtime#4-context-assembly) and [Hooks §3.4](/0.1.0/specification/hooks#34-history-projection-and-snapshot-timing).

- Messages persisted before the snapshot **MUST** be eligible for that assembly.
- Messages injected after the snapshot begins **MUST** become eligible for the following context assembly.

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

## 7. Conformance Scenarios

A conforming runtime **MUST** satisfy these portable scenarios.

| Scenario | Observable result |
|----------|-------------------|
| Inject during active execution | `before_create_message` and `after_create_message` each run once. `getMessage` returns the persisted record. Later tools and hooks in the same execution observe the message on `execution.messageHistory`. |
| Inject at rest | The same lifecycle hooks run. The message is available through thread message APIs before the next execution starts. |
| Silent and visible injection | Both records persist. Both appear on `execution.messageHistory`. Both are eligible for the next context snapshot. Ordinary UI queries omit the silent record unless `includeSilent` is true. |
| `filter_messages` projection | Trimming, compaction, redaction, and synthetic messages affect the provider request. `execution.messageHistory` continues to list the live persisted records. |
| Inject from `filter_messages` | Lifecycle hooks run. Projection does not restart. The injected message is absent from the current provider request and eligible for the following assembly. |
| Inject from `prefilter_llm_history` | Same snapshot assignment as injection from `filter_messages`. |
| Inject from `after_system_message` | The message is persisted before the history snapshot. It is eligible for the current assembly and passes through `filter_messages`. |
