import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clearPreviousSyncFiles, writeSyncOutput } from 'src/sync/cleanup.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hmbee-cleanup-test-'));
  originalCwd = process.cwd();
  process.chdir(tempDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('clearPreviousSyncFiles', () => {
  it('removes previous sync files leaving room for exactly one new file', () => {
    const sourceDir = path.join(tempDir, 'sync', 'tochka');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, '2026-01-01_2026-01-31.json'), '[]');

    clearPreviousSyncFiles('tochka');

    fs.writeFileSync(path.join(sourceDir, '2026-04-01_2026-04-30.json'), '[]');

    expect(fs.readdirSync(sourceDir)).toEqual(['2026-04-01_2026-04-30.json']);
  });

  it('does not touch the sync/hmbee/ cache directory', () => {
    const sourceDir = path.join(tempDir, 'sync', 'tochka');
    const hmbeeDir = path.join(tempDir, 'sync', 'hmbee');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(hmbeeDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, '2026-01-01_2026-01-31.json'), '[]');
    fs.writeFileSync(path.join(hmbeeDir, 'all_json_cache.json'), '[]');

    clearPreviousSyncFiles('tochka');

    expect(fs.readdirSync(hmbeeDir)).toEqual(['all_json_cache.json']);
  });

  it('does nothing when the source directory does not exist yet', () => {
    expect(() => clearPreviousSyncFiles('tochka')).not.toThrow();
  });
});

describe('writeSyncOutput', () => {
  it('replaces the previous sync file, leaving exactly one', () => {
    const sourceDir = path.join(tempDir, 'sync', 'tochka');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, '2026-01-01_2026-01-31.json'), '[]');

    writeSyncOutput('tochka', [{ id: 1 }], path.join(sourceDir, '2026-04-01_2026-04-30.json'));

    expect(fs.readdirSync(sourceDir)).toEqual(['2026-04-01_2026-04-30.json']);
  });

  it('does not touch sync/<source>/ in --stdout mode (outputPath undefined)', () => {
    const sourceDir = path.join(tempDir, 'sync', 'tochka');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, '2026-01-01_2026-01-31.json'), '[]');

    writeSyncOutput('tochka', [{ id: 1 }], undefined);

    expect(fs.readdirSync(sourceDir)).toEqual(['2026-01-01_2026-01-31.json']);
  });
});
