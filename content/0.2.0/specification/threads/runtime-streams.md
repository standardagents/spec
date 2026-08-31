# Runtime Streams

Runtime streams are an optional `ThreadState` capability for opening live,
runtime-authorized byte streams. They let portable agent code exchange opaque
bytes with an execution host without specifying what the capability means or
how a runtime transports it.

## 1. Types

```typescript
interface RuntimeStreamRequest {
  capability: string;
  metadata?: Record<string, unknown>;
  timeoutMs?: number;
}

interface RuntimeByteStream {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  readonly closed: Promise<{ ok: boolean; error?: string }>;
  close(reason?: string): void;
}

type RuntimeStreamErrorCode =
  | 'unsupported'
  | 'unavailable'
  | 'refused'
  | 'timeout';

type RuntimeStreamResult =
  | { ok: true; stream: RuntimeByteStream }
  | { ok: false; error: string; code?: RuntimeStreamErrorCode };

interface RuntimeStreams {
  open(request: RuntimeStreamRequest): Promise<RuntimeStreamResult>;
}

interface ThreadState {
  readonly runtimeStreams?: RuntimeStreams;
}
```

## 2. Optional Capability

`runtimeStreams` is optional. Existing runtimes may omit it and remain
conformant, so agent code must feature-detect it before opening a stream.

Capability names and metadata are opaque to this specification. Runtimes own
capability authorization and may refuse any request. A runtime must not infer
portable semantics from a capability name or interpret metadata in a shared
layer.

## 3. Direction and Lifetime

- `readable` carries bytes from the execution host to the runtime.
- `writable` carries bytes from the runtime to the execution host.
- Streams are live, non-durable resources. They never park and do not survive
  an execution-host disconnect.
- Closing the writable side is a graceful half-close: the host may continue
  sending bytes through `readable`.
- `close(reason?)` aborts the complete stream and is idempotent.
- `closed` settles exactly once with the final stream outcome.

## 4. Neutral Example

This tool sends media bytes to a workstation-hosted transcoder and reads the
encoded result. The example demonstrates feature detection, opening, writing,
reading, and cleanup.

```typescript
const runtimeStreams = state.runtimeStreams;
if (!runtimeStreams) {
  return { status: 'error', error: 'This runtime has no workstation streams.' };
}

const opened = await runtimeStreams.open({
  capability: 'workstation_transcoder',
  metadata: { inputFormat: 'wav', outputFormat: 'opus' },
  timeoutMs: 10_000,
});
if (!opened.ok) {
  return { status: 'error', error: opened.error, error_code: opened.code };
}

const { stream } = opened;
try {
  const writer = stream.writable.getWriter();
  try {
    await writer.write(sourceMedia);
    await writer.close();
  } finally {
    writer.releaseLock();
  }

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const outcome = await stream.closed;
  if (!outcome.ok) throw new Error(outcome.error ?? 'Transcoder stream failed.');
  return { status: 'success', result: `Received ${chunks.length} encoded chunks.` };
} finally {
  stream.close();
}
```

## 5. Conformance

A runtime that implements `runtimeStreams` must preserve byte ordering in both
directions, support graceful writable half-close and complete abort, and settle
`closed` once for every successfully opened stream. `open()` should report
refusal without creating a stream, return `unavailable` when the selected
execution host is absent, and return `timeout` when stream opening exceeds the
requested or runtime-defined deadline.
