import { decodeMozLz4, decodeMozLz4ToJson, MozLz4Error } from 'src/credentials/mozlz4.js';
import { describe, expect, it } from 'vitest';

const MAGIC = Buffer.from('mozLz40\0', 'binary');

function buildMozLz4(decompressedSize: number, compressedBlock: Buffer): Buffer {
  const header = Buffer.alloc(12);
  MAGIC.copy(header, 0);
  header.writeUInt32LE(decompressedSize, 8);
  return Buffer.concat([header, compressedBlock]);
}

/** Encodes literal-only bytes into a single raw LZ4 sequence (no match part needed as the last sequence). */
function encodeLiteralOnlyBlock(literal: Buffer): Buffer {
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

describe('decodeMozLz4', () => {
  it('decodes a valid mozLz4 payload with literal-only content into JSON', () => {
    const json = JSON.stringify({ cookies: [{ host: 'i.tochka.com', name: 'JSESSIONID', value: 'abc123' }] });
    const literal = Buffer.from(json, 'utf-8');
    const compressed = encodeLiteralOnlyBlock(literal);
    const file = buildMozLz4(literal.length, compressed);

    const result = decodeMozLz4ToJson(file);

    expect(result).toEqual({ cookies: [{ host: 'i.tochka.com', name: 'JSESSIONID', value: 'abc123' }] });
  });

  it('decodes a block containing a back-reference match', () => {
    // Sequence: literal "a" (length 1), then a match of length 9 at offset 1 -> "aaaaaaaaaa"
    const compressed = Buffer.from([0x15, 0x61, 0x01, 0x00]);
    const file = buildMozLz4(10, compressed);

    const result = decodeMozLz4(file);

    expect(result.toString('utf-8')).toBe('a'.repeat(10));
  });

  it('throws a MozLz4Error when the signature is invalid', () => {
    const file = Buffer.from('not-a-mozlz4-file-at-all', 'utf-8');

    expect(() => decodeMozLz4(file)).toThrow(MozLz4Error);
    expect(() => decodeMozLz4(file)).toThrow(/signature/i);
  });
});
