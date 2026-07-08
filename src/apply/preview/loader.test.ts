import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSyncFiles } from 'src/apply/preview/loader.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hmbee-loader-test-'));
  originalCwd = process.cwd();
  process.chdir(tempDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeSyncFile(source: string, fileName: string, records: unknown[]): void {
  const dir = path.join(tempDir, 'sync', source);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(records));
}

describe('loadSyncFiles', () => {
  it('parses from/to from the sync file name and returns them with the records', () => {
    writeSyncFile('tochka', '2026-04-01_2026-04-30.json', [{ id: 1 }]);

    const result = loadSyncFiles('tochka');

    expect(result).toEqual({ records: [{ id: 1 }], from: '2026-04-01', to: '2026-04-30' });
  });

  it('throws an explicit error when the file name does not match <from>_<to>.json', () => {
    writeSyncFile('tochka', 'not-a-date-range.json', [{ id: 1 }]);

    expect(() => loadSyncFiles('tochka')).toThrow(
      'Sync file name does not match the expected <from>_<to>.json pattern: not-a-date-range.json'
    );
  });

  it('throws when the sync directory is missing', () => {
    expect(() => loadSyncFiles('tochka')).toThrow(/Sync directory not found/);
  });
});
