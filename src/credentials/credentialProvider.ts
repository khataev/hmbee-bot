import { buildCookieHeader, dedupeCookies, selectCookiesForHost } from 'src/credentials/cookieString.js';
import { readCookiesFromFirefoxSessionStore } from 'src/credentials/firefoxSessionStore.js';
import type { BrowserCookie } from 'src/credentials/types.js';

export class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialError';
  }
}

/** Systems this provider can obtain a session cookie for. */
export type CredentialSystem = 'tochka';

/**
 * Seam for obtaining a session cookie string for a given system (e.g. `tochka`). Adapters call
 * this instead of reading the browser, files, or environment variables directly, so the source of
 * the cookie can change without touching adapter code.
 */
export interface CredentialProvider {
  getSession(system: CredentialSystem): string;
}

interface SystemSessionConfig {
  targetHost: string;
  envVarName: string;
}

const SYSTEM_CONFIG: Record<CredentialSystem, SystemSessionConfig> = {
  tochka: { targetHost: 'i.tochka.com', envVarName: 'TOCHKA_COOKIE' }
};

function logFoundCookies(system: CredentialSystem, cookies: BrowserCookie[]): void {
  const identifiers = cookies.map((cookie) => `${cookie.host}:${cookie.name}`).join(', ');
  console.error(
    `[CredentialProvider] ${system}: found ${cookies.length} cookie(s) in Firefox sessionstore (${identifiers})`
  );
}

function getSessionFromFirefox(config: SystemSessionConfig, system: CredentialSystem): string | undefined {
  let cookies: BrowserCookie[];
  try {
    cookies = readCookiesFromFirefoxSessionStore();
  } catch {
    return undefined;
  }

  const selected = dedupeCookies(selectCookiesForHost(cookies, config.targetHost));
  if (selected.length === 0) return undefined;

  logFoundCookies(system, selected);
  return buildCookieHeader(selected);
}

export const credentialProvider: CredentialProvider = {
  getSession(system: CredentialSystem): string {
    const config = SYSTEM_CONFIG[system];
    if (!config) {
      throw new CredentialError(`Unknown credential system "${system}"`);
    }

    const fromFirefox = getSessionFromFirefox(config, system);
    if (fromFirefox) return fromFirefox;

    const fromEnv = process.env[config.envVarName];
    if (fromEnv) return fromEnv;

    throw new CredentialError(
      `Не удалось получить свежую cookie для "${system}": Firefox sessionstore недоступен или пуст, ` +
        `а переменная окружения ${config.envVarName} не задана. ` +
        `Открой Firefox с залогиненной Точкой и повтори синхронизацию, либо задай ${config.envVarName} вручную.`
    );
  }
};
