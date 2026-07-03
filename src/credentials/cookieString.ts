import type { BrowserCookie } from 'src/credentials/types.js';

/**
 * Whether a cookie set for `cookieHost` (a domain-attribute value, e.g. `.tochka.com` or
 * `i.tochka.com`) would be sent by a browser on a request to `targetHost`, per cookie
 * domain-matching (RFC 6265 §5.1.3): equal to the (dot-stripped) domain, or a subdomain of it.
 */
function cookieDomainMatches(targetHost: string, cookieHost: string): boolean {
  const domain = cookieHost.startsWith('.') ? cookieHost.slice(1) : cookieHost;
  return targetHost === domain || targetHost.endsWith(`.${domain}`);
}

/**
 * Selects the cookies that would be sent on a request to `targetHost`, by cookie
 * domain-matching rather than a hardcoded key list (the set of relevant cookie names can change).
 */
export function selectCookiesForHost(cookies: BrowserCookie[], targetHost: string): BrowserCookie[] {
  return cookies.filter((cookie) => cookieDomainMatches(targetHost, cookie.host));
}

/**
 * Deduplicates cookies by the `(host, name)` pair, keeping the first occurrence. Firefox
 * sessionstore can contain the same cookie multiple times (e.g. one entry per open window).
 */
export function dedupeCookies(cookies: BrowserCookie[]): BrowserCookie[] {
  const seenKeys = new Set<string>();
  const deduped: BrowserCookie[] = [];

  for (const cookie of cookies) {
    const key = `${cookie.host} ${cookie.name}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(cookie);
  }

  return deduped;
}

/** Assembles cookies into a `name=value; name=value` header string. */
export function buildCookieHeader(cookies: BrowserCookie[]): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

/**
 * Selects the cookies relevant to `targetHost`, deduplicates them, and assembles the
 * resulting `Cookie` header string.
 */
export function buildCookieHeaderForHost(cookies: BrowserCookie[], targetHost: string): string {
  const matched = selectCookiesForHost(cookies, targetHost);
  const deduped = dedupeCookies(matched);
  return buildCookieHeader(deduped);
}
