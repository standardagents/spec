# Decisions

Decision inference evaluates explicit context against independent typed questions.
Applications use it for classification, scoring, and boolean probabilities from
hooks, tools, handlers, or thread endpoints, including outside an active turn.
It is independent of conversational generation and tool execution.

## 1. Provider contract

```typescript
interface DecisionProviderInterface {
  readonly name: string;
  readonly specificationVersion: '1';
  readonly kind: 'decision';
  decide<const Q extends DecisionQuestions>(request: DecisionRequest<Q>): Promise<DecisionResult<Q>>;
  getModels?(filter?: string): Promise<ProviderModelInfo[]>;
  getIcon?(modelId?: string): string | undefined;
}

interface DecisionProviderFactory {
  (config: ProviderFactoryConfig): DecisionProviderInterface;
  configSlots?: ProviderConfigSlots;
}
```

A decision provider **MUST** implement `decide()` and declare `kind: 'decision'`.
It need not implement `generate()` or `stream()`. Its factory receives the
standard provider connection configuration; questions belong to each request,
not credential or connection configuration. The same transport override and
credential isolation rules apply as for [Providers](/0.2.0/specification/providers).
A prompt's `defineModel` requires a conversational provider; a decision provider
is invoked through the decision surface.

## 2. Request and questions

```typescript
type DecisionJson = string | number | boolean | null
  | DecisionJson[] | { [key: string]: DecisionJson };
type DecisionContext = string | DecisionJson[] | { [key: string]: DecisionJson };
type DecisionQuestion =
  | { type: 'choice'; instructions: DecisionContext; options: Record<string, DecisionContext | null> }
  | { type: 'score'; instructions: DecisionContext; levels: DecisionContext[] }
  | { type: 'boolean'; instructions: DecisionContext; criteria?: { true?: DecisionContext; false?: DecisionContext } };
type DecisionQuestions = Record<string, DecisionQuestion>;

interface DecisionRequest<Q extends DecisionQuestions = DecisionQuestions> {
  model: string;
  context: DecisionContext;
  questions: Q;
  signal?: AbortSignal;
}
```

The caller supplies context explicitly as a string, JSON object, or array. A
runtime **MUST NOT** implicitly assemble context from conversation history.
Structured context and instructions retain their JSON structure. Each map key
identifies its corresponding answer; instructions carry the actual question.

Choice options describe the available outcomes; `null` means no additional
rubric description. Score levels are ordered from index zero upward. Boolean
criteria may describe the meaning of true and false. Providers **MUST** preserve
these meanings when translating to a native API and reject unsupported inputs
rather than silently discard them. Provider-specific count and context limits
belong in that provider's documentation.

## 3. Result and probability semantics

```typescript
interface DecisionChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
}
interface DecisionScoreAnswer {
  type: 'score';
  score: number;
  probabilities: Record<string, number>;
  legend: Record<string, DecisionContext>;
  confidence?: number;
}
interface DecisionBooleanAnswer {
  type: 'boolean';
  probability: number;
}
interface DecisionResult<Q extends DecisionQuestions = DecisionQuestions> {
  model: string;
  answers: DecisionAnswers<Q>;
  usage: ProviderUsage;
  metadata?: Record<string, unknown>;
}
```

`DecisionAnswers<Q>` maps every question identifier to its matching answer type.
The result's `model` is the actual model that performed the evaluation, including
the resolved version when the request uses an alias. `usage` uses standard
`promptTokens`, `completionTokens`, `totalTokens`, and optional USD `cost` and
unit `pricing` fields.

Probabilities and confidence are numbers in **[0, 1]**. A boolean answer is
P(true); providers and runtimes **MUST NOT** coerce it to a boolean or impose a
threshold. Callers choose thresholds and subsequent actions. A score is the
probability-weighted, zero-based rubric value and may be fractional. Confidence
is provider-reported and is distinct from any individual option probability.
Providers **MUST** preserve complete distributions, score legends, and available
confidence. Provider rounding information may be carried in `metadata`; rounded
probabilities must not be silently renormalized.

## 4. Thread invocation and automatic logs

```typescript
interface DecideOptions<Q extends DecisionQuestions = DecisionQuestions>
  extends DecisionRequest<Q> {
  provider: DecisionProviderFactory;
  name?: string;
  trigger?: ThreadLogTrigger;
}

// Available wherever the caller has a ThreadState.
const result = await state.decide({
  provider: decisionProvider,
  model: 'decision-model-id',
  context: { ticket: 'Please cancel my subscription.' },
  questions: {
    cancel: {
      type: 'boolean',
      instructions: 'Does the customer request cancellation?',
    },
  },
  name: 'support.cancellation',
  trigger: { kind: 'webhook', summary: 'Support ticket received' },
});
const needsCancellationReview = result.answers.cancel.probability >= 0.9;
```

`decide(state, options)`, exported by `@standardagents/spec`, delegates to
`state.decide(options)`. AgentBuilder also exports this helper from
`@standardagents/builder`.

The runtime resolves thread-scoped provider credentials and applicable hosting
configuration. Runtimes **MUST NOT** let user/thread destination overrides
redirect inherited credentials. AgentBuilder resolves connection destinations
from trusted deployment or instance-admin settings while allowing scoped
credential values. A conforming runtime **MUST** automatically record the operation's request,
response, duration, status, usage, known cost, and failure information in the
thread's [application logs](/0.2.0/specification/threads#75-application-logs).
The default log name is `decision.<provider>`; `name` and `trigger` allow
application attribution. Credentials **MUST NOT** be included in decision logs.
Known decision cost counts once toward thread totals; callers should not log it
again as a second cost-bearing operation.

Calling `decide()` **MUST NOT** implicitly read, add, or change conversation
messages, execute tools, or start a conversational turn. To include selected
results in history, the caller explicitly uses `state.injectMessage()` or the
other normal message APIs. Calling an instantiated provider's `.decide()`
directly, outside `ThreadState`, has no automatic thread logging.

## 5. Native provider mapping example

TypeSafe AI's Jev API is one implementation of this independent capability:

| Standard Agent field | TypeSafe native field |
| --- | --- |
| `context` | `state` |
| Choice `options` | Choice `criteria` |
| Score ordered `levels` | Score ordered `criteria` |
| Boolean type and `criteria` | Noul type and `criteria` |
| Boolean answer `probability` | Native `noul` value |

One native request evaluates the named questions against shared state. The
provider retains answer identifiers, structured instructions, probability
distributions, score legends, and confidence. Provider prices, limits, aliases,
and credentials are implementation details documented by the provider package.
