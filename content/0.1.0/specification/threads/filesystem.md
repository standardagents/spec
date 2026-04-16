# File System

Each thread has an isolated file system for storing files, images, and other binary data. It is addressable through `ThreadState` and survives execution cycles — two separate invocations of the same thread see the same file tree.

This page documents the file system APIs. For an overview of threads themselves, see [Threads](/0.1.0/specification/threads).

## 1. File Record

Files are represented by the `FileRecord` type:

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | File path (relative to thread root) |
| `name` | `string` | File name |
| `mimeType` | `string` | MIME type |
| `storage` | `string` | Implementation-defined storage identifier |
| `size` | `number` | File size in bytes |
| `isDirectory` | `boolean` | Whether this is a directory |
| `metadata` | `Record<string, unknown>` | Custom metadata |
| `width` | `number` | Image width in pixels (if applicable) |
| `height` | `number` | Image height in pixels (if applicable) |

## 2. Writing Files

```typescript
// Write a text file
const record = await state.writeFile(
  '/data/config.json',
  JSON.stringify({ key: 'value' }),
  'application/json'
);

// Write a binary file with metadata
const imageRecord = await state.writeFile(
  '/images/photo.jpg',
  imageBuffer,
  'image/jpeg',
  { width: 1920, height: 1080 }
);
```

## 3. Reading Files

```typescript
// Read file content
const data = await state.readFile('/data/config.json');
if (data) {
  const text = new TextDecoder().decode(data);
  const config = JSON.parse(text);
}

// Get file metadata without reading content
const info = await state.statFile('/images/photo.jpg');
if (info) {
  console.log(`Size: ${info.size} bytes`);
}
```

## 4. Directory Operations

```typescript
// Create a directory
await state.mkdirFile('/documents');

// List directory contents
const { entries } = await state.readdirFile('/documents');
for (const entry of entries) {
  console.log(`${entry.isDirectory ? 'DIR' : 'FILE'}: ${entry.name}`);
}

// Remove an empty directory
await state.rmdirFile('/documents');

// Delete a file
await state.unlinkFile('/data/config.json');
```

## 5. Search Operations

```typescript
// Search file contents
const grepResults = await state.grepFiles('error');
for (const result of grepResults) {
  console.log(`${result.path}:`);
  for (const match of result.matches) {
    console.log(`  Line ${match.line}: ${match.content}`);
  }
}

// Find files by glob pattern
const { paths } = await state.findFiles('**/*.json');
console.log('JSON files:', paths);
```

## 6. File Statistics

```typescript
const stats = await state.getFileStats();
console.log(`Files: ${stats.fileCount}`);
console.log(`Directories: ${stats.directoryCount}`);
console.log(`Total size: ${stats.totalSize} bytes`);
```

## 7. Image Thumbnails

```typescript
const thumbnail = await state.getFileThumbnail('/images/photo.jpg');
if (thumbnail) {
  // Use thumbnail data
}
```

## 8. Streaming Files

For large files, `readFileStream` provides memory-efficient access by yielding data in chunks.

### 8.1 Method

```typescript
readFileStream(
  path: string,
  options?: ReadFileStreamOptions
): Promise<AsyncIterable<FileChunk> | null>
```

### 8.2 Options

| Property | Type | Description |
|----------|------|-------------|
| `signal` | `AbortSignal` | Optional abort signal for cancellation |

### 8.3 FileChunk

| Property | Type | Description |
|----------|------|-------------|
| `data` | `Uint8Array` | Raw binary data for this chunk |
| `index` | `number` | 0-based index of this chunk |
| `totalChunks` | `number` | Total number of chunks |
| `isLast` | `boolean` | Whether this is the final chunk |

### 8.4 Behavior

1. **File Not Found**: Returns `null` if the file does not exist.
2. **External Files**: Returns `null` for files whose `storage` identifier references an external system (object storage, a remote URL, etc.). External files must be fetched using their storage location.
3. **Small Files**: Files under the chunk threshold are yielded as a single chunk with `index: 0`, `totalChunks: 1`, and `isLast: true`.
4. **Chunked Files**: Large files yield multiple chunks in sequential order (0, 1, 2...).
5. **Ordering Guarantee**: Chunks are always yielded in sequential order. Implementations **MUST NOT** yield chunks out of order.
6. **Abort Signal**: When triggered, the stream stops yielding new chunks. Already-yielded chunks remain valid.

### 8.5 Example: Processing Large File

```typescript
const stream = await state.readFileStream('/uploads/video.mp4');
if (!stream) {
  throw new Error('File not found');
}

for await (const chunk of stream) {
  console.log(`Progress: ${chunk.index + 1}/${chunk.totalChunks}`);
  // Process chunk.data without loading entire file into memory
}
```

### 8.6 Example: HTTP Streaming Response

```typescript
const stream = await state.readFileStream('/uploads/large-file.bin');
if (!stream) {
  return new Response('Not Found', { status: 404 });
}

const readable = new ReadableStream({
  async start(controller) {
    for await (const chunk of stream) {
      controller.enqueue(chunk.data);
    }
    controller.close();
  }
});

return new Response(readable, {
  headers: { 'Content-Type': 'application/octet-stream' }
});
```
