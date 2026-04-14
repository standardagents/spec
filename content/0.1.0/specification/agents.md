# Agents

An agent is the top-level conversation orchestrator in Standard Agents.

Agents define:
- conversation type (`ai_human` or `dual_ai`)
- side prompts and stop behavior
- session lifecycle tool bindings
- optional tool exposure for handoff/subagent usage

## 1. AgentDefinition

### 1.1 Required

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique agent identifier |
| `sideA` | `SideConfig` | Side A configuration |

### 1.2 Optional

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | `'ai_human' \| 'dual_ai'` | `'ai_human'` | Conversation mode |
| `sideB` | `SideConfig` | - | Required for `dual_ai` |
| `maxSessionTurns` | `number` | - | Session turn safety cap |
| `title` | `string` | - | Human-readable label (legacy) |
| `description` | `string` | - | Agent summary |
| `icon` | `string` | - | Display icon |
| `exposeAsTool` | `boolean` | `false` | Expose callable entrypoint |
| `toolDescription` | `string` | - | Callable description |
| `env` | `Record<string, string>` | - | Agent-level default variable values |
| `hooks` | `string[]` | - | Fallback hook IDs |

## 2. Agent Types

### 2.1 `ai_human`

- Side A is AI.
- Side B is human (no Side B config required).
- Typical usage: user-facing assistants.

### 2.2 `dual_ai`

- Both sides are AI.
- Each side sees itself as `assistant`, other side as `user`.
- `maxSessionTurns` should be set for bounded execution.
- `dual_ai` agents can be used as autonomous subagents.

## 3. SideConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `prompt` | `string` | Required | Prompt name for this side |
| `label` | `string` | - | UI/log label |
| `stopOnResponse` | `boolean` | `true` | Stop side turn on text response without tool calls |
| `stopTool` | `string` | - | Stop side turn when this tool is called |
| `stopToolResponseProperty` | `string` | - | Extracted property for stop tool outcomes |
| `maxSteps` | `number` | - | Per-side step safety limit |
| `sessionStop` | `SessionToolBinding` | - | End session successfully |
| `sessionFail` | `SessionToolBinding` | - | End session with failure |
| `sessionStatus` | `SessionToolBinding` | - | Publish status updates |

## 4. SessionToolBinding

Session lifecycle bindings can be string or object form:

```typescript
type SessionToolBinding =
  | string
  | {
      name: string;
      messageProperty?: string;
      attachmentsProperty?: string;
    };
```

- `name`: tool that controls lifecycle action
- `messageProperty`: which arg field becomes lifecycle message text
- `attachmentsProperty`: which arg field contains attachment path(s)

For subagents, mapped stop/fail payloads are the canonical child -> parent result/failure payload.

## 5. Stop Semantics

Runtime stop evaluation is typically:
1. session-level terminal bindings (`sessionStop`/`sessionFail`)
2. side-level stop bindings (`stopTool`)
3. response stop (`stopOnResponse`)
4. safety limits (`maxSteps`, `maxSessionTurns`)

## 6. Tool Exposure Semantics

When `exposeAsTool: true`:
- `ai_human` callable usage is a handoff-style tool interaction.
- `dual_ai` callable usage is subagent behavior (see [Subagents](/0.1.0/specification/subagents)).

## 7. Example

```typescript
defineAgent({
  name: 'asset_subagent',
  type: 'dual_ai',
  maxSessionTurns: 40,
  exposeAsTool: true,
  toolDescription: 'Generate and QA top-down game assets.',
  sideA: {
    label: 'Worker',
    prompt: 'asset_worker',
    stopOnResponse: true,
    sessionFail: {
      name: 'fail_asset',
      messageProperty: 'reason',
      attachmentsProperty: 'attachments',
    },
  },
  sideB: {
    label: 'Reviewer',
    prompt: 'asset_reviewer',
    stopOnResponse: false,
    sessionStop: {
      name: 'approve_asset',
      messageProperty: 'summary',
      attachmentsProperty: 'attachments',
    },
    sessionStatus: {
      name: 'update_asset_status',
      messageProperty: 'status',
    },
  },
});
```
