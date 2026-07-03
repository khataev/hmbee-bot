import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decodeMozLz4ToJson } from 'src/credentials/mozlz4.js';
import type { BrowserCookie } from 'src/credentials/types.js';

export class FirefoxSessionstoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirefoxSessionstoreError';
  }
}

const OPEN_FIREFOX_HINT = 'Открой Firefox с залогиненной Точкой и повтори синхронизацию.';
const SESSIONSTORE_CANDIDATES = ['recovery.jsonlz4', 'recovery.baklz4'];

interface ParsedProfile {
  path: string;
  isRelative: boolean;
  isDefault: boolean;
}

interface ParsedProfilesIni {
  profiles: ParsedProfile[];
  /** `Default=` paths from `[InstallXXXXXXXX]` lock sections: what Firefox itself opens for that install. */
  installDefaultPaths: string[];
}

/**
 * Firefox's own default profile root per OS (where `profiles.ini` lives).
 */
export function getFirefoxRootDir(): string {
  const home = os.homedir();
  switch (os.platform()) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Firefox');
    case 'win32':
      return path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Mozilla', 'Firefox');
    default:
      return path.join(home, '.mozilla', 'firefox');
  }
}

/**
 * Parses a Firefox `profiles.ini` file: both the `[ProfileN]` profile sections and the
 * `[InstallXXXXXXXX]` install-lock sections (Firefox 67+ profile-per-install). A profile marked
 * `Default=1` is a legacy hint and can point at a stale/empty profile; the install-lock section is
 * what Firefox itself uses to pick a profile on a normal launch.
 */
export function parseProfilesIni(content: string): ParsedProfilesIni {
  const profiles: ParsedProfile[] = [];
  const installDefaultPaths: string[] = [];
  let current: { name: string; path?: string; isRelative: boolean; isDefault: boolean; defaultPath?: string } | null =
    null;

  const flush = () => {
    if (!current) return;
    if (/^Profile\d+$/.test(current.name) && current.path !== undefined) {
      profiles.push({ path: current.path, isRelative: current.isRelative, isDefault: current.isDefault });
    } else if (current.name !== 'General' && current.defaultPath !== undefined) {
      installDefaultPaths.push(current.defaultPath);
    }
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionMatch = /^\[(.+)\]$/.exec(line);
    if (sectionMatch) {
      flush();
      current = { name: sectionMatch[1] ?? '', isRelative: true, isDefault: false };
      continue;
    }

    if (!current) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'Path') current.path = value;
    if (key === 'IsRelative') current.isRelative = value === '1';
    if (key === 'Default') {
      current.isDefault = value === '1';
      current.defaultPath = value;
    }
  }
  flush();

  return { profiles, installDefaultPaths };
}

function resolveProfilePath(firefoxRootDir: string, value: string, isRelative = true): string {
  return isRelative && !path.isAbsolute(value) ? path.join(firefoxRootDir, value) : value;
}

/**
 * Resolves candidate Firefox profile directories to try, in priority order:
 * 1. The install-lock `Default=` path (what Firefox itself opens for this install).
 * 2. Any `[ProfileN]` section with the legacy `Default=1` flag.
 * 3. All remaining profiles, freshest directory first — a best-effort fallback for when neither
 *    signal points at a profile that actually has a usable sessionstore (e.g. a stale, empty
 *    legacy default profile alongside the real one; this happens even on stock installs).
 */
export function getProfileDirCandidates(firefoxRootDir: string = getFirefoxRootDir()): string[] {
  const profilesIniPath = path.join(firefoxRootDir, 'profiles.ini');

  let iniContent: string;
  try {
    iniContent = fs.readFileSync(profilesIniPath, 'utf-8');
  } catch {
    throw new FirefoxSessionstoreError(`Firefox profiles.ini не найден (${profilesIniPath}). ${OPEN_FIREFOX_HINT}`);
  }

  const { profiles, installDefaultPaths } = parseProfilesIni(iniContent);

  const ordered: string[] = [];
  const pushUnique = (dir: string) => {
    if (!ordered.includes(dir)) ordered.push(dir);
  };

  for (const installPath of installDefaultPaths) {
    pushUnique(resolveProfilePath(firefoxRootDir, installPath));
  }

  for (const profile of profiles.filter((candidate) => candidate.isDefault)) {
    pushUnique(resolveProfilePath(firefoxRootDir, profile.path, profile.isRelative));
  }

  const remainingWithMtime = profiles
    .filter((profile) => !profile.isDefault)
    .map((profile) => resolveProfilePath(firefoxRootDir, profile.path, profile.isRelative))
    .filter((dir) => !ordered.includes(dir))
    .map((dir) => {
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(dir).mtimeMs;
      } catch {
        // Profile directory missing/unreadable; sorts last.
      }
      return { dir, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const { dir } of remainingWithMtime) pushUnique(dir);

  if (ordered.length === 0) {
    throw new FirefoxSessionstoreError(`В ${profilesIniPath} не найден ни один профиль Firefox. ${OPEN_FIREFOX_HINT}`);
  }

  return ordered;
}

/**
 * Reads a file via a temporary copy so we never read the original while Firefox may be writing to it.
 */
function readFileAsCopy(filePath: string): Buffer {
  const tempPath = path.join(os.tmpdir(), `hmbee-firefox-sessionstore-${randomUUID()}.tmp`);
  fs.copyFileSync(filePath, tempPath);
  try {
    return fs.readFileSync(tempPath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

/**
 * Reads and decodes the Firefox sessionstore JSON from a profile directory, trying
 * `recovery.jsonlz4` first and falling back to `recovery.baklz4` if it is missing or corrupt.
 */
export function readSessionstoreData(profileDir: string): unknown {
  const backupsDir = path.join(profileDir, 'sessionstore-backups');

  for (const fileName of SESSIONSTORE_CANDIDATES) {
    const filePath = path.join(backupsDir, fileName);
    try {
      const raw = readFileAsCopy(filePath);
      return decodeMozLz4ToJson(raw);
    } catch {
      // Try the next candidate; a final error is thrown below if none work.
    }
  }

  throw new FirefoxSessionstoreError(
    `Не удалось прочитать ни recovery.jsonlz4, ни recovery.baklz4 в ${backupsDir}. ${OPEN_FIREFOX_HINT}`
  );
}

/**
 * Recursively collects cookie-like objects (identified structurally by having string
 * `host`/`name`/`value` fields) from a parsed sessionstore document, tolerant of shape changes
 * between Firefox versions.
 */
export function collectCookies(sessionstoreData: unknown): BrowserCookie[] {
  const cookies: BrowserCookie[] = [];
  const visited = new Set<object>();

  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    const record = node as Record<string, unknown>;
    if (typeof record.host === 'string' && typeof record.name === 'string' && typeof record.value === 'string') {
      cookies.push({ host: record.host, name: record.name, value: record.value });
    }

    for (const value of Object.values(record)) {
      visit(value);
    }
  };

  visit(sessionstoreData);
  return cookies;
}

/**
 * Reads all cookies found in the Firefox sessionstore, trying candidate profile directories
 * (see `getProfileDirCandidates`) in priority order until one yields a readable sessionstore.
 */
export function readCookiesFromFirefoxSessionstore(): BrowserCookie[] {
  const profileDirs = getProfileDirCandidates();

  for (const profileDir of profileDirs) {
    try {
      const sessionstoreData = readSessionstoreData(profileDir);
      return collectCookies(sessionstoreData);
    } catch {
      // Try the next candidate profile.
    }
  }

  throw new FirefoxSessionstoreError(
    `Не удалось прочитать sessionstore ни в одном из профилей Firefox (${profileDirs.join(', ')}). ${OPEN_FIREFOX_HINT}`
  );
}
