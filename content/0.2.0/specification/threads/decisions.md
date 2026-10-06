# Decisions

A decision evaluates named, typed questions against caller-supplied context.
`ThreadState.decide()` returns the answers without advancing the conversation.

For the rest of the `ThreadState` surface, see [Threads](/0.2.0/specification/threads).

## 1. Thread Interface

```typescript
interface DecideOptions<Q extends DecisionQuestions = DecisionQuestions>
  extends DecisionRequest<Q> {
  provider: DecisionProviderFactory;
}

interface ThreadState {
  decide<const Q extends DecisionQuestions>(
    options: DecideOptions<Q>
  ): Promise<DecisionResult<Q>>;
}
```

The `provider` property identifies the factory used for the invocation. A
decision does not require a conversational [model definition](/0.2.0/specification/models).

`decide()` **MUST** be available both during active execution and when
`state.execution` is `null`.

The `decide(state, options)` helper exported by `@standardagents/spec` is
equivalent to `state.decide(options)`.

## 2. Request Types

```typescript
type DecisionJson =
  | string
  | number
  | boolean
  | null
  | DecisionJson[]
  | { [key: string]: DecisionJson };

type DecisionContext =
  | string
  | DecisionJson[]
  | { [key: string]: DecisionJson };

interface DecisionRequest<Q extends DecisionQuestions = DecisionQuestions> {
  model: string;
  context: DecisionContext;
  questions: Q;
  signal?: AbortSignal;
}
```

| Property | Semantics |
|----------|-----------|
| `model` | Provider model identifier for this invocation. |
| `context` | Explicit context shared by the questions. Structured values **MUST** retain their JSON structure. |
| `questions` | Map of question identifiers to question definitions. Each identifier associates a question with its answer. |
| `signal` | Optional cancellation signal for the request. |

Question definitions are invocation inputs. They are not provider connection
configuration.

## 3. Question Types

```typescript
type DecisionQuestion =
  | {
      type: 'choice';
      instructions: DecisionContext;
      options: Record<string, DecisionContext | null>;
    }
  | {
      type: 'score';
      instructions: DecisionContext;
      levels: DecisionContext[];
    }
  | {
      type: 'boolean';
      instructions: DecisionContext;
      criteria?: { true?: DecisionContext; false?: DecisionContext };
    };

type DecisionQuestions = Record<string, DecisionQuestion>;
```

`instructions` defines the evaluation to perform. Structured instructions,
option descriptions, levels, and criteria **MUST** retain their JSON structure.

| Type | Semantics |
|------|-----------|
| `choice` | Select an outcome from `options`. Each key identifies an outcome; its value describes that outcome. A `null` value supplies no additional description. |
| `score` | Evaluate against the ordered `levels` rubric. Level indices start at zero; array order defines the scale. |
| `boolean` | Estimate the probability that the condition in `instructions` is true. Optional `criteria.true` and `criteria.false` describe the two outcomes. |

Providers **MUST** preserve these semantics when translating requests. A
provider **MUST** reject inputs it cannot represent rather than silently omit
or reinterpret them. Question-count and context-size limits are
provider-defined.

## 4. Result Types

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

type DecisionAnswer =
  | DecisionChoiceAnswer
  | DecisionScoreAnswer
  | DecisionBooleanAnswer;

type DecisionAnswers<Q extends DecisionQuestions> = {
  [K in keyof Q]: Q[K] extends { type: 'choice' } ? DecisionChoiceAnswer
    : Q[K] extends { type: 'score' } ? DecisionScoreAnswer
    : Q[K] extends { type: 'boolean' } ? DecisionBooleanAnswer
    : DecisionAnswer;
};

interface DecisionResult<Q extends DecisionQuestions = DecisionQuestions> {
  model: string;
  answers: DecisionAnswers<Q>;
  usage: ProviderUsage;
  metadata?: Record<string, unknown>;
}
```

| Property | Semantics |
|----------|-----------|
| `model` | The model that performed the evaluation, including the resolved version when the request uses an alias. |
| `answers` | Answers keyed by request question identifier, with an answer type corresponding to each question type. |
| `usage` | Standard `ProviderUsage`: token counts and optional cost and pricing fields. |
| `metadata` | Optional provider-specific result information. |

### 4.1 Answer Semantics

- `choice` identifies the selected option. Its `probabilities` map associates option identifiers with their probabilities.
- `score` is the probability-weighted value of the zero-based level indices. It **MAY** be fractional. Its `probabilities` map associates level indices with probabilities, and `legend` associates those indices with rubric descriptions.
- `probability` on a boolean answer is P(true).
- Probabilities and `confidence` values are numbers in **[0, 1]**. Confidence is provider-reported and is distinct from an individual outcome probability.

Providers **MUST** preserve complete probability distributions, score legends,
and available confidence values. Provider rounding information **MAY** be
included in `metadata`. Rounded probabilities **MUST NOT** be silently
renormalized.

Providers and runtimes **MUST NOT** coerce a boolean probability to a boolean
or apply an application threshold. Thresholds and subsequent actions are
caller-defined.

## 5. Provider Interface

```typescript
interface DecisionProviderInterface {
  readonly name: string;
  readonly specificationVersion: '1';
  readonly kind: 'decision';

  decide<const Q extends DecisionQuestions>(
    request: DecisionRequest<Q>
  ): Promise<DecisionResult<Q>>;
  getModels?(filter?: string): Promise<ProviderModelInfo[]>;
  getIcon?(modelId?: string): string | undefined;
}

interface DecisionProviderFactory {
  (config: ProviderFactoryConfig): DecisionProviderInterface;
  configSlots?: ProviderConfigSlots;
}
```

A decision provider **MUST** implement `decide()` and declare
`kind: 'decision'`. Conversational `generate()` and `stream()` methods are
not required by this interface.

Factories receive standard `ProviderFactoryConfig`. Transport overrides and
credential isolation follow the [Provider specification](/0.2.0/specification/providers).
The runtime resolves thread-scoped credentials and provider connection
configuration. User- or thread-scoped destination overrides **MUST NOT**
redirect inherited credentials.

## 6. Conversation Semantics

Invoking `decide()` **MUST NOT** implicitly:

- read conversation messages to assemble context;
- add, modify, or remove conversation messages;
- execute tools;
- start a conversational turn.

Adding an answer to conversation history requires a separate call to a
[message API](/0.2.0/specification/threads/messages).
