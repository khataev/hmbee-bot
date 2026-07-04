import { CredentialError, type CredentialSystem, credentialProvider } from 'src/credentials/credentialProvider.js';
import { readCookiesFromFirefoxSessionStore } from 'src/credentials/firefoxSessionStore.js';
import type { BrowserCookie } from 'src/credentials/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/credentials/firefoxSessionStore.js', () => ({
  readCookiesFromFirefoxSessionStore: vi.fn()
}));

const mockReadCookiesFromFirefoxSessionStore = vi.mocked(readCookiesFromFirefoxSessionStore);

function cookie(host: string, name: string, value: string): BrowserCookie {
  return { host, name, value };
}

describe('credentialProvider', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
    mockReadCookiesFromFirefoxSessionStore.mockReset();
  });

  it('returns a session cookie string built from Firefox sessionstore cookies', () => {
    mockReadCookiesFromFirefoxSessionStore.mockReturnValue([
      cookie('i.tochka.com', 'JSESSIONID', 'super-secret-session-value'),
      cookie('.tochka.com', 'X-CSRF-TOKEN', 'super-secret-csrf-value'),
      cookie('id.tochka.com', 't_uid', 'unrelated-value')
    ]);

    const session = credentialProvider.getSession('tochka');

    expect(session).toBe('JSESSIONID=super-secret-session-value; X-CSRF-TOKEN=super-secret-csrf-value');
  });

  it('never logs cookie values, only host/name identifiers', () => {
    mockReadCookiesFromFirefoxSessionStore.mockReturnValue([
      cookie('i.tochka.com', 'JSESSIONID', 'super-secret-session-value')
    ]);

    credentialProvider.getSession('tochka');

    const loggedOutput = consoleErrorSpy.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n');
    expect(loggedOutput).toContain('i.tochka.com:JSESSIONID');
    expect(loggedOutput).not.toContain('super-secret-session-value');
  });

  it('falls back to the environment variable when Firefox sessionstore is unavailable', () => {
    mockReadCookiesFromFirefoxSessionStore.mockImplementation(() => {
      throw new Error('Firefox not running');
    });
    vi.stubEnv('TOCHKA_COOKIE', 'JSESSIONID=from-env; X-CSRF-TOKEN=from-env');

    const session = credentialProvider.getSession('tochka');

    expect(session).toBe('JSESSIONID=from-env; X-CSRF-TOKEN=from-env');
  });

  it('falls back to the environment variable when Firefox sessionstore has no cookies for the target host', () => {
    mockReadCookiesFromFirefoxSessionStore.mockReturnValue([cookie('example.com', 'unrelated', 'value')]);
    vi.stubEnv('TOCHKA_COOKIE', 'JSESSIONID=from-env');

    const session = credentialProvider.getSession('tochka');

    expect(session).toBe('JSESSIONID=from-env');
  });

  it('throws a CredentialError when neither Firefox sessionstore nor the env var are available', () => {
    mockReadCookiesFromFirefoxSessionStore.mockImplementation(() => {
      throw new Error('Firefox not running');
    });
    vi.stubEnv('TOCHKA_COOKIE', '');

    expect(() => credentialProvider.getSession('tochka')).toThrow(CredentialError);
    expect(() => credentialProvider.getSession('tochka')).toThrow(/TOCHKA_COOKIE/);
  });

  it('throws a CredentialError for an unknown system', () => {
    mockReadCookiesFromFirefoxSessionStore.mockReturnValue([]);

    expect(() => credentialProvider.getSession('unknown-bank' as CredentialSystem)).toThrow(CredentialError);
  });
});
