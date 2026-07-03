import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  collectCookies,
  FirefoxSessionstoreError,
  getProfileDirCandidates,
  readSessionstoreData
} from 'src/credentials/firefoxSessionstore.js';
import { buildMozLz4JsonFile } from 'src/credentials/test-helpers.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hmbee-firefox-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('getProfileDirCandidates', () => {
  it('resolves the relative path of a single profile from profiles.ini', () => {
    const iniContent = [
      '[Profile0]',
      'Name=default',
      'IsRelative=1',
      'Path=abcd1234.default-release',
      'Default=1',
      '',
      '[General]',
      'StartWithLastProfile=1'
    ].join('\n');
    fs.writeFileSync(path.join(tempDir, 'profiles.ini'), iniContent);

    const candidates = getProfileDirCandidates(tempDir);

    expect(candidates).toEqual([path.join(tempDir, 'abcd1234.default-release')]);
  });

  it('prioritizes the install-lock Default over a stale legacy Default=1 profile', () => {
    // Mirrors a real-world macOS Firefox layout: an empty legacy "default" profile stays marked
    // Default=1, while the actually-used profile is only pointed to by the install-lock section.
    const iniContent = [
      '[Profile1]',
      'Name=default',
      'IsRelative=1',
      'Path=stale.default',
      'Default=1',
      '',
      '[Profile0]',
      'Name=default-release',
      'IsRelative=1',
      'Path=Profiles/real.default-release',
      '',
      '[General]',
      'StartWithLastProfile=1',
      '',
      '[Install2656FF1E876E9973]',
      'Default=Profiles/real.default-release',
      'Locked=1'
    ].join('\n');
    fs.writeFileSync(path.join(tempDir, 'profiles.ini'), iniContent);

    const candidates = getProfileDirCandidates(tempDir);

    expect(candidates).toEqual([
      path.join(tempDir, 'Profiles/real.default-release'),
      path.join(tempDir, 'stale.default')
    ]);
  });

  it('falls back to remaining profiles ordered by freshest directory mtime', () => {
    const olderDir = path.join(tempDir, 'older.profile');
    const newerDir = path.join(tempDir, 'newer.profile');
    fs.mkdirSync(olderDir);
    fs.mkdirSync(newerDir);
    const now = Date.now() / 1000;
    fs.utimesSync(olderDir, now - 1000, now - 1000);
    fs.utimesSync(newerDir, now, now);

    const iniContent = ['[Profile0]', 'Path=older.profile', '', '[Profile1]', 'Path=newer.profile'].join('\n');
    fs.writeFileSync(path.join(tempDir, 'profiles.ini'), iniContent);

    const candidates = getProfileDirCandidates(tempDir);

    expect(candidates).toEqual([newerDir, olderDir]);
  });

  it('throws a FirefoxSessionstoreError when profiles.ini is missing', () => {
    expect(() => getProfileDirCandidates(tempDir)).toThrow(FirefoxSessionstoreError);
  });

  it('throws a FirefoxSessionstoreError when profiles.ini has no profile section', () => {
    fs.writeFileSync(path.join(tempDir, 'profiles.ini'), '[General]\nStartWithLastProfile=1\n');

    expect(() => getProfileDirCandidates(tempDir)).toThrow(FirefoxSessionstoreError);
  });
});

describe('readSessionstoreData', () => {
  it('reads and decodes recovery.jsonlz4 when present', () => {
    const backupsDir = path.join(tempDir, 'sessionstore-backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.writeFileSync(path.join(backupsDir, 'recovery.jsonlz4'), buildMozLz4JsonFile({ marker: 'recovery' }));

    const data = readSessionstoreData(tempDir);

    expect(data).toEqual({ marker: 'recovery' });
  });

  it('falls back to recovery.baklz4 when recovery.jsonlz4 is missing', () => {
    const backupsDir = path.join(tempDir, 'sessionstore-backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.writeFileSync(path.join(backupsDir, 'recovery.baklz4'), buildMozLz4JsonFile({ marker: 'backup' }));

    const data = readSessionstoreData(tempDir);

    expect(data).toEqual({ marker: 'backup' });
  });

  it('falls back to recovery.baklz4 when recovery.jsonlz4 is corrupt', () => {
    const backupsDir = path.join(tempDir, 'sessionstore-backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.writeFileSync(path.join(backupsDir, 'recovery.jsonlz4'), Buffer.from('not a mozlz4 file'));
    fs.writeFileSync(path.join(backupsDir, 'recovery.baklz4'), buildMozLz4JsonFile({ marker: 'backup' }));

    const data = readSessionstoreData(tempDir);

    expect(data).toEqual({ marker: 'backup' });
  });

  it('throws a FirefoxSessionstoreError with guidance when neither file exists', () => {
    expect(() => readSessionstoreData(tempDir)).toThrow(FirefoxSessionstoreError);
    expect(() => readSessionstoreData(tempDir)).toThrow(/открой firefox/i);
  });
});

describe('collectCookies', () => {
  it('recursively collects cookie-shaped objects from a nested sessionstore fragment', () => {
    const sessionstoreFragment = {
      windows: [
        {
          tabs: [{ entries: [{ url: 'https://i.tochka.com/bank/' }] }],
          cookies: [
            { host: 'i.tochka.com', name: 'JSESSIONID', value: 'session-value-1' },
            { host: '.tochka.com', name: 'RsRememberMeToken', value: 'remember-me-value' }
          ]
        },
        {
          cookies: [{ host: 'i.tochka.com', name: 'X-CSRF-TOKEN', value: 'csrf-value' }]
        }
      ],
      _closedWindows: [
        {
          cookies: [{ host: 'id.tochka.com', name: 't_uid', value: 'unrelated-value' }]
        }
      ],
      globalNonCookieData: { some: 'unrelated', nested: { structure: true } }
    };

    const cookies = collectCookies(sessionstoreFragment);

    expect(cookies).toEqual(
      expect.arrayContaining([
        { host: 'i.tochka.com', name: 'JSESSIONID', value: 'session-value-1' },
        { host: '.tochka.com', name: 'RsRememberMeToken', value: 'remember-me-value' },
        { host: 'i.tochka.com', name: 'X-CSRF-TOKEN', value: 'csrf-value' },
        { host: 'id.tochka.com', name: 't_uid', value: 'unrelated-value' }
      ])
    );
    expect(cookies).toHaveLength(4);
  });

  it('returns an empty array when no cookie-shaped objects are present', () => {
    const cookies = collectCookies({ windows: [{ tabs: [] }] });

    expect(cookies).toEqual([]);
  });
});
