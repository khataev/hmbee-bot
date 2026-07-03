import { decodeMozLz4, decodeMozLz4ToJson, MozLz4Error } from 'src/credentials/mozlz4.js';
import { buildMozLz4JsonFile, wrapMozLz4 } from 'src/credentials/test-helpers.js';
import { describe, expect, it } from 'vitest';

describe('decodeMozLz4', () => {
  it('decodes a valid mozLz4 payload with literal-only content into JSON', () => {
    const file = buildMozLz4JsonFile({ cookies: [{ host: 'i.tochka.com', name: 'JSESSIONID', value: 'abc123' }] });

    const result = decodeMozLz4ToJson(file);

    expect(result).toEqual({ cookies: [{ host: 'i.tochka.com', name: 'JSESSIONID', value: 'abc123' }] });
  });

  it('decodes a block containing a back-reference match', () => {
    // Sequence: literal "a" (length 1), then a match of length 9 at offset 1 -> "aaaaaaaaaa"
    const compressed = Buffer.from([0x15, 0x61, 0x01, 0x00]);
    const file = wrapMozLz4(10, compressed);

    const result = decodeMozLz4(file);

    expect(result.toString('utf-8')).toBe('a'.repeat(10));
  });

  it('throws a MozLz4Error when the signature is invalid', () => {
    const file = Buffer.from('not-a-mozlz4-file-at-all', 'utf-8');

    expect(() => decodeMozLz4(file)).toThrow(MozLz4Error);
    expect(() => decodeMozLz4(file)).toThrow(/signature/i);
  });
});
