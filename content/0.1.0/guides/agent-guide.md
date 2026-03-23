# Agent Guide

The effective agents guide is a living record that is not part of the specification, but intended to help humans and agents use the specification to craft effective agents. It is updated regularily and not bound to any specific version of the specification.

## What is a Standard Agent?

In the Standard Agent paradigm agents are the atomic unit of an AI system and it is the composition of many domain-specific agents that produces efficacy. How large should the concerns of a given agent be? There is no hard or fast rule here, the question is a bit like how big should a React component be. However, in general Standard Agents can be effective using smaller and cheaper models — but smaller and cheaper models typically suffer from poor tool discernment when presented with a broad range of tools, especially a broad range of similar tools.

A "gmail" agent, for example, will typically do better than a "goole apps" agent. Those higher-level agents would instead be composed of many sub-service agents, and a larger coordinator agent would be the one with the primary objectives, business goals and logic, and ultimate authority. This is a fractal that can be scaled up to create even larger coordinators and larger agents. These agent-graphs, or agent-trees, are the core philosophy of Standard Agents and solves many industry problems such as progressive tool discovery, model-prompt tuning, context dilution, task resumability, and even compaction.

However, just because we can use subagents to create complex interactions doesn't mean we have to. A subagent is always a two-sided conversation where each side can perform multiple steps per turn. Sometimes you just need to use a feature of a different model, without it being a full subagent, for example using nano bananna to generate an image. If you just need to have a tool call that generates an image, use a subprompt. You may want an asset generator subagent if, for example, the agent needs to perform QA on the generated asset to ensure to meets certain criteria.

Another example may be using an instruct model variant to run an agent, but a more eloquent model to write the actual text of the email that is sent to people. Again, that could be a subprompt. Having another model proofread the email that is written — that would be a subagent. One small note on that: when performing QA in a subthread, try to use different models from different providers on the agent side that is doign the proof reading. Models from the same labs tend to think their own output is quite good, even if it is not.

Example structure:

- `personal_assistant_coordinator`
  - central dual-ai coordinator
  - decides which domain owns the work
  - aggregates state, plans, and responses
- `communications_coordinator`
  - owns all inbound and outbound communications work
  - delegates to `gmail_agent`, `slack_agent`, and `text_message_agent`
  - receives escalations from those channel agents and routes the next action
- `research_assistant`
  - owns information gathering and synthesis
  - delegates to `browser_use_agent`, `google_drive_agent`, and `notes_agent`
- optional additional branches
  - `scheduling_coordinator`
  - `travel_coordinator`
  - `finance_ops_coordinator`
  - `crm_coordinator`


## Receiving and sending input

Within an agent graph input can come from anywhere, even subagents. In its most simple form, you may have an ai+human agent at the top of the graph, although this works well in simple cases, its often preferrable to have the highest order agent be a high-level coordinator that uses a more intelligent discerning model and is guided by prompting to achive high-level objectives (ex: "You are  project manager for the Jichael Mordan line of shoes at an athletic shoe company. You are in charge of...").

It is quite possible to have an entire agent graph with no `ai_human` agent types. Where the only i/o with a human is through a subagent that performs tool calls to, for example, Slack. New messages are queued and posted by `side_b` as "Message from user: "Mow the lawn clanker", and responses would be sent via a tool call send_to_slack(channel, "I dont know how to do that"). However, for a chat-bot like implementation its often preferrable to use `ai_human` as the top-level coordinator.


## Coordinators

The coordinator pattern can work well when a number of related subagents need to work together. Coordinators provide two significant bennefits:

1. Provide subagent communication for similar domains. For example, a coding agent with a research subagent and a bash subagent. The coordinator could request research around a given task and then pass the results from the research subagent and synthesise a request for the bash subagent. In this scenario, the bash subagent didnt even need to know the research subagent existed in order to bennefit from it.
2. Filtering. Imagine a gmail subagent. On its own it can probably do a pretty good job of filtering out spam. But the gmail subagent shouldn't be responsible for the higher-level objectives of an organization. A communication coordinator that sits above a gmail subagent could have directives for what kind of email really matters to the CEO of a sprinkler hose company and can further reduce clutter before it passes email results to it's parent. This also serves as a way to increase the throughput on an agent graph as a whole. Not ever slack message can be sent to a to-level coordinator, but an effective tree heirarchy can filter out a lot of noise.

## 2. How big should an agent be?

A good domain-specific agent owns a logical concern, but has a small enough API and prompt surface that even a small or medium model can become an expert on it.

Good agent boundaries usually look like:

- `gmail_agent`
- `calendar_guardian`
- `slack_watcher`
- `browser_researcher`
- `google_drive_librarian`

Poor agent boundaries usually look like:

- `personal_assistant`
- `business_operator`
- `everything_agent`
- `office_helper`

The pattern is simple:

- a domain expert should own one domain
- a coordinator should compose several domain experts
- a "big" assistant should usually be a tree of smaller agents, not one giant prompt

A useful test:

- Can you describe what this agent owns in one sentence?
- Does it have a narrow tool surface?
- Could a small or medium model be reliable if this were the only context it saw?
- Would sibling domains make it worse by adding noise?

If the answers are unclear, the agent is probably too big.

## 3. A Good Default Architecture

The right default is usually a tree, not a blob.

A personal assistant should usually be a central dual-ai coordinator made up of smaller coordinators and domain experts.

One important nuance:

- ownership should still look like a tree
- communication does not always enter at the top of the tree
- some leaf or branch agents are ingress points that receive information from users or external systems and delegate inward
- some leaf or branch agents are execution workers that receive work from the coordinator and delegate results back

<figure>
  <img src="/agent-guide-architecture-tree.svg" alt="Tree architecture showing a Personal Assistant Coordinator at the top, with a Communications Coordinator branch containing Gmail, Slack, and Text Message agents, and a Research Assistant branch containing Browser Use, Google Drive, and Notes agents." />
</figure>



Why this works:

- each leaf agent can stay narrow and expert
- each branch coordinator can reason at the domain level
- the central coordinator stays focused on orchestration instead of channel mechanics
- tools and env stay isolated to the smallest sensible boundary

Another important point:

- the Gmail, Slack, and text-message agents may be the actual ingress points for user or external-system traffic
- they do not need to be the main planning brain
- they can translate channel-specific input into a clean delegation to the central coordinator
- this lets the system keep channel handling separate from actual assistant reasoning

## 4. A Strong Bias

Prefer:

- small domain experts
- coordinators that compose them
- narrow tools per agent
- isolated env and filesystem state
- deterministic side effects
- selective escalation

Avoid:

- one heroic agent
- one giant prompt
- one giant tool list
- hidden shared state
- leaking cross-domain context into every step

The goal is not to build the most impressive single agent.

The goal is to compose a system that is legible, debuggable, and reliably effective.

## 5. Roles That Usually Work Well

### 5.1 Root Coordinator

Job:

- accept goals directly or via delegated ingress agents
- decide which domain owns the next step
- sequence work across branches
- synthesize the final answer

The root coordinator should usually:

- have a broad understanding of the whole system
- avoid deep domain work itself
- spend most of its time routing, sequencing, and summarizing
- receive distilled signals rather than raw exhaust from every child

It does not need to be the only outward-facing agent.

In many real systems:

- Gmail receives email events
- Slack receives Slack traffic
- text-message agents receive SMS traffic
- those agents then delegate inward to the coordinator

### 5.2 Domain Coordinator

Job:

- own one business area
- normalize requests inside that area
- delegate to the correct leaf expert
- return clean domain-level results upward

Examples:

- communications coordinator
- research coordinator
- scheduling coordinator
- finance ops coordinator

This is often the most useful layer in a real product because it keeps the root small.

### 5.3 Domain Expert

Job:

- perform one narrow unit of work
- use one small set of tools
- own one clear env/config surface
- return a local result

Examples:

- Gmail triage
- calendar conflict review
- Slack thread watcher
- browser-based research
- Google Drive document retrieval
- CRM lead enrichment

This is the layer that should be small enough for a modest model to master.

Some domain experts are ingress agents.

That means they:

- receive raw traffic from a user or external source
- normalize it into the system's internal shape
- delegate it upward or inward instead of trying to solve everything locally

### 5.4 Reviewer

Job:

- verify a candidate result
- find mistakes
- reject or approve completion

Use a reviewer when:

- the cost of error is high
- the output is externally visible
- the worker can cheaply retry after critique

Do not add a reviewer to every loop by default.

### 5.5 Watcher / Listener

Job:

- receive external traffic continuously
- filter noise
- escalate only when relevant

This is a good fit for:

- Slack listeners
- inbox monitors
- webhook-fed account watchers
- background compliance monitors

Watcher children are usually better when they are resumable and use `parentCommunication: 'explicit'`.

Channel agents often blend two roles:

- ingress adapter
- watcher/listener

That is normal. The important part is that they stay narrow.

## 6. Use `side_a` and `side_b` deliberately in dual-ai subagents

In a strong dual-ai subagent, `side_a` and `side_b` should not be symmetric.

They usually play different jobs:

- `side_a` is the producer
- `side_b` is the reviewer, adjuster, or controller

A very common pattern is:

- `side_a` tries to do the work
- `side_b` checks whether the work is actually on target
- `side_b` issues a correction when the trajectory needs to change
- `side_a` retries with that correction in view

### 6.1 A practical default

Good defaults:

- `side_a` owns generation, execution, exploration, or draft production
- `side_b` owns review, calibration, critique, and stop-or-adjust decisions

Examples:

- asset generator on `side_a`, art director on `side_b`
- researcher on `side_a`, editor on `side_b`
- planner on `side_a`, risk reviewer on `side_b`
- scheduler on `side_a`, conflict reviewer on `side_b`

This works well because the two sides are not repeating the same cognition.

### 6.2 Why `side_b` is useful as a corrective channel

One of the best reasons to use a dual-ai subagent is correction pressure.

In many current chat-style models, recent user-role messages tend to get strong attention.

That matters because, from the point of view of the active side:

- its own prior outputs are assistant messages
- the opposite side's messages appear as user messages

So if `side_b` says:

- this is off target
- use the attached image as style guidance only
- you missed the acceptance criteria
- retry with tighter scope

that correction often lands with more force than another assistant-style continuation would.

That makes `side_b` useful not just as a reviewer, but as a signal amplifier when the child needs adjustment.

### 6.3 What `side_b` should say

Strong `side_b` messages are usually:

- short
- concrete
- corrective
- tied to acceptance criteria
- focused on the next change, not a full rewrite of the whole plan

Good examples:

- "The result is too broad. Retry with only executive calendar conflicts for the next 72 hours."
- "You used the reference image too literally. Keep the palette and silhouette language, but generate a different object."
- "Do not answer the user yet. Gather the missing citations first."

Weak `side_b` messages are usually:

- vague
- repetitive
- philosophizing
- duplicative of the original prompt

### 6.4 What `side_b` should not do

Do not use `side_b` for:

- deterministic validation that code can do better
- long policy dumps every turn
- another full copy of the worker prompt
- commentary that does not change the next step

If the issue is binary and checkable, use deterministic code or a tool.

If the issue is directional and judgment-based, `side_b` is a good place for it.

### 6.5 A useful mental model

Think of `side_a` as the actuator and `side_b` as the steering correction loop.

- `side_a` moves the work forward
- `side_b` notices drift
- `side_b` injects a high-signal correction
- `side_a` adapts

That is often more effective than trying to stuff both generation and correction into one monologue.

### 6.6 A common split

Use `side_a` when you want:

- action
- generation
- exploration
- execution
- draft output

Use `side_b` when you want:

- review
- critique
- correction
- narrowing
- escalation of missed constraints

## 7. Protect the coordinator from raw exhaust

One of the fastest ways to make a coordinator worse is to send too much information back to it.

The coordinator should usually receive:

- short summaries
- decisions
- exceptions
- escalations
- next-step-relevant facts

The coordinator should usually not receive:

- raw logs
- every intermediate thought
- every low-value alert
- all candidate options when most were rejected locally
- channel noise that does not change the next action

### 7.1 Filter before you escalate

Children should be intelligent about filtering unused information before it moves upward.

That means:

- reject obvious noise locally
- summarize repetitive activity
- escalate only what matters
- keep the parent's working set small

This is not just a cost optimization.

It is a cognition optimization.

If the coordinator sees too much irrelevant information:

- planning gets noisier
- tool selection gets worse
- summaries get muddier
- the whole tree starts to behave like one giant overloaded prompt

### 7.2 Why dual-ai helps

Dual-ai is a good fit for this because it naturally splits responsibilities.

One side can focus on doing the work.

The other side can focus on deciding whether the work is worth sending upward at all.

Example:

- `side_a` has inbox, labeling, drafting, or retrieval tools
- `side_b` has spam-analysis, threat-analysis, approval, rejection, and escalation tools
- only approved or escalated items are sent back to the parent

That means the child can absorb a lot of local noise without polluting the central coordinator.

### 7.3 A good communications pattern

For a communications child, a strong split often looks like:

- `side_a`: classify, draft, fetch context, propose action
- `side_b`: determine whether this is spam, threat, priority, or safe to ignore

Then the child can:

- reject junk locally
- hold low-value chatter locally
- surface only urgent, risky, or decision-worthy items upward

This keeps the parent focused on real work instead of mailbox exhaust.

### 7.4 What should come back up

Good upward payloads look like:

- "3 new items need attention. One is high priority. One is likely phishing. One is safe to archive."
- "Slack thread in #sales needs a reply from Justin today."
- "Research branch found two conflicting sources. Human choice is needed."

Bad upward payloads look like:

- full message dumps
- every intermediate retrieval
- every rejected candidate
- every tool transcript
- every low-confidence hunch

### 7.5 Practical rule

If a child can safely decide that something does not matter, the parent should usually never see it.

## 8. Deterministic Code vs. Model Behavior

Keep these deterministic:

- authentication
- permission checks
- side effects
- retries and backoff
- serialization and parsing
- hard business-rule routing
- env handling and secret transfer

Let the model handle:

- judgment under ambiguity
- summarization
- extraction when rules are soft
- planning
- prioritization
- natural-language interaction

Bad pattern:

- "The model decides whether to send the money."

Better pattern:

- "The model drafts the action. Deterministic code validates and executes it."

## 9. Use Subagents to Reduce Prompt Entropy

A good reason to create a subagent:

- the job has a distinct prompt
- the job needs a distinct tool set
- the job should run in parallel
- the job has its own lifecycle
- the job owns per-instance env or filesystem state

A bad reason to create a subagent:

- you are trying to hide a weak prompt by splitting it randomly
- the child has no distinct responsibility
- the child only exists because the parent prompt is too vague

The right unit is usually a domain expert, not a vague helper.

## 10. Use Explicit Communication for Long-Lived Children

The default `implicit` parent communication mode is good for delegated tasks:

- parent asks child to do work
- child finishes
- result comes back automatically

The `explicit` mode is better for long-lived observers:

- child receives many external events
- most events should not bother the parent
- child escalates selectively through tools or hooks
- child can stay alive and useful without creating parent noise

Good watcher pattern:

- external effect or socket feeds the child thread
- child filters and classifies locally
- child uses `state.setStatus()` for passive observability
- child uses `state.notifyParent()` only when escalation is actually warranted

This separation matters because a delegated worker and a background watcher are different architectures even if both are implemented as subagents.

## 11. Use Scoped Env Aggressively

Use `scoped: true` when a variable belongs to one subtree only.

Examples:

- one Gmail child per account
- one Slack child per workspace
- one calendar child per executive
- one browser child per session

Good rule:

- if leaking the parent value into sibling children would be incorrect, make it scoped

Also:

- keep tokens and secrets in env, not messages
- only expose safe naming and description hints to any bootstrap model pass
- treat copied child env as runtime data, not prompt text

## 12. Prefer Small Tool Surfaces

If one agent has too many tools, performance usually gets worse.

Symptoms:

- poor tool selection
- repeated wrong-tool calls
- bloated context
- fragile prompting

Better pattern:

- give each agent a narrow tool surface
- compose multiple agents instead of one giant generalist

## 13. Good First Patterns

### 13.1 Personal Assistant Tree

```text
personal_assistant_coordinator
  -> communications_coordinator
    -> gmail_agent
    -> slack_agent
    -> text_message_agent
  -> research_assistant
    -> browser_use_agent
    -> google_drive_agent
    -> notes_agent
```

Why it works:

- the central coordinator stays clean
- each branch has a coherent concern
- leaves can be true domain experts
- account-specific env stays local to the right subtree

In practice, the communications leaves may receive the first message or event and then delegate inward to the coordinator tree.

### 13.2 Exec Ops

```text
exec_ops_coordinator
  -> gmail_triage children
  -> calendar_guardian children
  -> reviewer only for risky actions
```

Why it works:

- account state is isolated
- work parallelizes naturally
- the parent stays focused on synthesis

### 13.3 Slack Escalation Watcher

```text
Slack effect or socket
  -> slack watcher child (explicit communication)
    -> notifyParent() only for urgent or relevant events
```

Why it works:

- the child can idle quietly
- the parent sees only curated escalations
- external noise does not pollute the main conversation

## 14. Common Mistakes

- using one giant assistant instead of a coordinator tree
- making a leaf agent own several unrelated domains
- using the same prompt for planning, execution, and review
- letting the model own side effects end to end
- putting secrets into prompt text or message history
- making workers talk too much
- skipping a reviewer where the output is expensive to get wrong
- adding a reviewer where the output is cheap and high-volume
- using subagents when a deterministic effect or hook would be simpler

## 15. Practical Summary

Start with this mental model:

- root coordinator for user-facing orchestration
- domain coordinators for major concerns
- small domain experts at the leaves
- deterministic tools and effects around the outside
- explicit watcher children when traffic is noisy
- scoped env wherever per-instance state matters

If you follow that shape, the system usually gets simpler as it grows instead of more chaotic.
