# Changelog — 0.2.0

**"Sides are Backings."** 0.2.0 is a **wholesale breaking release with no compatibility window**: 0.1.0-shaped definitions do not load, and conforming implementations reject them with errors that name exactly what to change. There is no deprecation period, no sugar parsing, and no silent migration.

Every removal below traces to a concrete failure or workaround encountered building a real three-tier assistant stack (relay → assistant → calendar desk) against 0.1.0.

## 1. Summary of Changes

| 0.1.0 concept | Fate in 0.2.0 | Motivation |
|---|---|---|
| `type: 'ai_human' \| 'dual_ai'` | **Deleted** (derived) | The enum encoded "what backs side B." It forbade compositions with no principled reason: humans on side A, humans inside compositions (approval gates), model-less relay surfaces. |
| Side = prompt only | **Side = `human \| prompt \| handler`** | Deterministic relays had to be faked with a request-gating hook suppressing model calls — abusing a policy-gate mechanism and persisting empty assistant messages as side effects. [Handlers](/0.2.0/specification/handlers) are now a first-class turn owner. |
| `route` side backing (considered) | **Never added** | Neither declarative-safe nor flexible; a five-line handler expresses it fully. See [§4](#4-considered-and-rejected). |
| Subagents declared on prompts (`tools` array) | **Declared on sides** (`side.subagents`) | The relationship is structure, not prompt behavior. Prompt reuse silently dragged relationships; handler sides have no prompt to declare on; the composition graph had to be scraped from prompts. |
| `resumable: { ... }` wrapper | **Deleted** (persistence universal) | The wrapper fused two axes — instance persistence (now: always) and waiting style (already the separate `blocking` flag) — and runtimes conflated session end with thread termination, destroying live children. |
| `receives_messages: 'side_a' \| 'side_b'` | **Deleted** (derived) | The relationship's owning side IS where child traffic lands; parent→child entry is uniform (side B perspective). The knob only existed because relationships had no side identity. |
| Relationship name = agent name | **Split**: `agent` + optional `as` alias | The same child composed twice under one side (two calendar teams with different `scopedEnv`) was impossible. |
| Auto-injected "reply" channel (considered) | **Never added** | Outbound user-facing speech stays userland. The runtime routes inbound; userland decides outbound. See [§4](#4-considered-and-rejected). |
| Bare-string `SessionToolBinding` | **Removed** | Object form only. |
| `parentHooks` restricted to `dual_ai` | **Legal on any exposed agent** | Any agent is composable now, so any exposed agent may carry composition requirements. |
| `maxSessionTurns` "applies to dual_ai" | **Optional on every shape** | A reply-happy handler can livelock against a prompt side just as two models can; the cap is a uniform, voluntary safety valve. Exchange counting is uniform across backings. |
| `immediate` at prompt activation | **At thread creation** | Immediate children must exist before any side takes a turn — even when the owning side is a handler, or the first inbound message arrives instantly. |

The guiding principle applied throughout: prompts and handlers own turns; tools are capabilities; hooks decorate; effects defer; relationships are architecture. If a proposed field can be derived from structure, derive it; if a concept fuses two axes, split it.

## 2. New Pages

- [Handlers](/0.2.0/specification/handlers) — the third backing: deterministic code that owns a side's turns. Exactly-once delivery, turn-fatal errors, in-order queueing.
- [Subagents](/0.2.0/specification/subagents) — side-owned relationships, aliases, immediate spawning, universal persistence, lifecycle tools, human-in-the-loop children.
- [Examples](/0.2.0/getting-started/examples) — hello-world and the relay stack.

## 3. Migration Guide

Migration is manual — there are no compatibility shims. The mechanical table:

| 0.1.0 shape | 0.2.0 change |
|---|---|
| `type: 'ai_human'` | Delete. Add `sideB: { human: true }` (side B is now explicit). |
| `type: 'dual_ai'` | Delete. Both sides are already prompt-backed. |
| Prompt `tools` containing a `SubagentToolConfig` | Move to the owning side's `subagents` array. The tool's `name` becomes `as` (or is dropped when it equals the agent name); `agent` stays `agent`. |
| `resumable: { maxInstances, parentCommunication, receives_messages }` | Unwrap: `maxInstances` and `parentCommunication` move to the relationship top level; `receives_messages` is deleted (declare the relationship on the side that received the messages). `blocking` stays as-is. |
| `receives_messages: 'side_b'` on a side-A-declared relationship | Declare the relationship on side B instead. |
| Bare-string `sessionStop: 'tool_name'` | Object form: `sessionStop: { name: 'tool_name' }`. |
| Model-less side faked with request-gating hooks | Delete the hooks and the unused prompt; back the side with a `handler`. |
| Missing `sideB` | Write it explicitly: `sideB: { human: true }`. |

Conforming implementations **MUST** reject removed fields with errors naming the replacement (tombstone types / structured validation codes), so a 0.1.0 project's boot failure doubles as its migration checklist.

## 4. Considered and Rejected

Recorded so they are not re-proposed without new evidence:

1. **A `route` side backing** — a declarative "forward to X" backing. Rejected: not declarative-safe (the interesting cases immediately need conditions), not flexible (structural constraints would grow selectors and resolvers back), and a five-line handler expresses it fully. Implementations MAY ship a forwarding-handler convenience helper; the specification stays silent.
2. **A runtime-injected reply channel for handled sides** — rejected. Outbound user-facing speech is userland (`message_user` pattern). *The runtime routes inbound; userland decides outbound.*
3. **Resolver-addressed / named-instance routing** — died with `route`.
4. **Auto-hoisting 0.1.0 prompt-level relationships onto sides** — rejected as silent magic reintroducing exactly the implicitness being removed. A hard load error with a migration pointer instead.
5. **Cross-side grants** (one side auditing the sibling side's children via granted tools) — deferred, door recorded closed; reopen with a real use case.
6. **Both sides human** — coherent (a mediated human↔human thread) but **reserved**: 0.2.0 runtimes MUST reject it; the restriction may lift in a later version.
7. **N sides** — this release deliberately does not generalize beyond two sides. Considered and deferred.
8. **Spec-mandated thread retention/archival** — persistence-universal grows the thread population, but what runtimes do with old or idle threads is deliberately out of specification scope.

## 5. Version Notes

- 0.1.0 remains published and immutable at [/0.1.0](/0.1.0/getting-started/overview).
- The specification version string is `0.2.0`. Implementations report conformance against exactly one version.
