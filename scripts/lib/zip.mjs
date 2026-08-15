/**
 * Just enough ZIP to stream one entry out of a GeoNames archive without
 * unpacking a gigabyte of text to disk.
 */
import { createReadStream, statSync, openSync, readSync, closeSync } from 'node:fs'
import { createInflateRaw } from 'node:zlib'

function readTail(path, length) {
  const size = statSync(path).size
  const start = Math.max(0, size - length)
  const buf = Buffer.alloc(size - start)
  const fd = openSync(path, 'r')
  try {
    readSync(fd, buf, 0, buf.length, start)
  } finally {
    closeSync(fd)
  }
  return { buf, start }
}

function readAt(path, offset, length) {
  const buf = Buffer.alloc(length)
  const fd = openSync(path, 'r')
  try {
    readSync(fd, buf, 0, length, offset)
  } finally {
    closeSync(fd)
  }
  return buf
}

/** Locates an entry via the central directory and returns a decompressed stream. */
export function openZipEntry(path, matches) {
  const { buf: tail, start: tailStart } = readTail(path, 66_000)
  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error(`${path}: no end-of-central-directory record`)

  const entries = tail.readUInt16LE(eocd + 10)
  let cursor = tail.readUInt32LE(eocd + 16)

  for (let n = 0; n < entries; n++) {
    const head = readAt(path, cursor, 46)
    if (head.readUInt32LE(0) !== 0x02014b50) throw new Error(`${path}: bad central directory entry`)
    const method = head.readUInt16LE(10)
    const compressedSize = head.readUInt32LE(20)
    const nameLen = head.readUInt16LE(28)
    const extraLen = head.readUInt16LE(30)
    const commentLen = head.readUInt16LE(32)
    const localOffset = head.readUInt32LE(42)
    const name = readAt(path, cursor + 46, nameLen).toString('utf8')

    if (matches(name)) {
      const local = readAt(path, localOffset, 30)
      const dataStart =
        localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28)
      const raw = createReadStream(path, {
        start: dataStart,
        end: dataStart + compressedSize - 1,
      })
      if (method === 0) return raw
      if (method === 8) return raw.pipe(createInflateRaw())
      throw new Error(`${name}: unsupported compression method ${method}`)
    }
    cursor += 46 + nameLen + extraLen + commentLen
  }
  void tailStart
  throw new Error(`${path}: no matching entry`)
}

/** Yields lines from a stream without buffering the whole thing. */
export async function* lines(stream) {
  let carry = ''
  for await (const chunk of stream) {
    const text = carry + chunk.toString('utf8')
    const parts = text.split('\n')
    carry = parts.pop() ?? ''
    for (const line of parts) yield line
  }
  if (carry) yield carry
}
