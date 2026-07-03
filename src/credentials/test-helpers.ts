const MAGIC = Buffer.from('mozLz40\0', 'binary');

/**
 * Wraps a raw LZ4 block with the mozLz4 header (`mozLz40\0` + LE uint32 decompressed size),
 * for building test fixtures.
 */
export function wrapMozLz4(decompressedSize: number, compressedBlock: Buffer): Buffer {
  const header = Buffer.alloc(12);
  MAGIC.copy(header, 0);
  header.writeUInt32LE(decompressedSize, 8);
  return Buffer.concat([header, compressedBlock]);
}

/**
 * Encodes bytes as a single literal-only raw LZ4 sequence. Valid as the last (and here, only)
 * sequence in a block, which needs no trailing match part.
 */
export function encodeLz4LiteralOnlyBlock(literal: Buffer): Buffer {
  const length = literal.length;
  let token: number;
  let extraLengthBytes: Buffer;

  if (length < 15) {
    token = length << 4;
    extraLengthBytes = Buffer.alloc(0);
  } else {
    token = 15 << 4;
    let extra = length - 15;
    const extraBytes: number[] = [];
    while (extra >= 255) {
      extraBytes.push(255);
      extra -= 255;
    }
    extraBytes.push(extra);
    extraLengthBytes = Buffer.from(extraBytes);
  }

  return Buffer.concat([Buffer.from([token]), extraLengthBytes, literal]);
}

/** Builds a full mozLz4 file containing the given bytes as literal-only content. */
export function buildMozLz4File(payload: Buffer): Buffer {
  return wrapMozLz4(payload.length, encodeLz4LiteralOnlyBlock(payload));
}

/** Builds a full mozLz4 file containing the JSON-serialized value. */
export function buildMozLz4JsonFile(data: unknown): Buffer {
  return buildMozLz4File(Buffer.from(JSON.stringify(data), 'utf-8'));
}
