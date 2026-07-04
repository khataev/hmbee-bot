const MAGIC = Buffer.from('mozLz40\0', 'binary');
const HEADER_LENGTH = 12; // 8-byte magic + 4-byte LE decompressed size

export class MozLz4Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MozLz4Error';
  }
}

function readByte(input: Buffer, pos: number): number {
  const byte = input[pos];
  if (byte === undefined) {
    throw new MozLz4Error('Unexpected end of mozLz4 payload while decoding LZ4 block');
  }
  return byte;
}

function decompressLz4Block(input: Buffer, decompressedSize: number): Buffer {
  const output = Buffer.alloc(decompressedSize);
  let inPos = 0;
  let outPos = 0;

  while (inPos < input.length) {
    const token = readByte(input, inPos++);

    let literalLength = token >> 4;
    if (literalLength === 15) {
      let extra: number;
      do {
        extra = readByte(input, inPos++);
        literalLength += extra;
      } while (extra === 255);
    }

    if (literalLength > 0) {
      input.copy(output, outPos, inPos, inPos + literalLength);
      inPos += literalLength;
      outPos += literalLength;
    }

    // A sequence with only literals and no trailing match is valid as the last sequence in the block.
    if (inPos >= input.length) {
      break;
    }

    const offset = input.readUInt16LE(inPos);
    inPos += 2;
    if (offset === 0 || offset > outPos) {
      throw new MozLz4Error(`Invalid LZ4 match offset ${offset} at output position ${outPos}`);
    }

    let matchLength = (token & 0x0f) + 4;
    if ((token & 0x0f) === 15) {
      let extra: number;
      do {
        extra = readByte(input, inPos++);
        matchLength += extra;
      } while (extra === 255);
    }

    let matchPos = outPos - offset;
    for (let i = 0; i < matchLength; i++) {
      output[outPos++] = readByte(output, matchPos++);
    }
  }

  return output;
}

/**
 * Decodes a mozLz4 payload (Firefox's `mozLz40\0` + size-prefixed raw LZ4 block format)
 * into the raw decompressed bytes.
 */
export function decodeMozLz4(input: Buffer): Buffer {
  if (input.length < HEADER_LENGTH || !input.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new MozLz4Error('Invalid mozLz4 signature: expected file to start with "mozLz40\\0"');
  }

  const decompressedSize = input.readUInt32LE(MAGIC.length);
  const compressed = input.subarray(HEADER_LENGTH);
  return decompressLz4Block(compressed, decompressedSize);
}

/**
 * Decodes a mozLz4 payload and parses the result as JSON, as used for Firefox sessionstore files.
 */
export function decodeMozLz4ToJson(input: Buffer): unknown {
  const decompressed = decodeMozLz4(input);
  return JSON.parse(decompressed.toString('utf-8'));
}
