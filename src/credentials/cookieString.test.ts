import {
  buildCookieHeader,
  buildCookieHeaderForHost,
  dedupeCookies,
  selectCookiesForHost
} from 'src/credentials/cookieString.js';
import type { BrowserCookie } from 'src/credentials/types.js';
import { describe, expect, it } from 'vitest';

function cookie(host: string, name: string, value = 'v'): BrowserCookie {
  return { host, name, value };
}

describe('selectCookiesForHost', () => {
  it('includes cookies scoped to the exact host, the dotted domain, and the bare parent domain', () => {
    const cookies = [
      cookie('i.tochka.com', 'JSESSIONID'),
      cookie('.tochka.com', 'RsRememberMeToken'),
      cookie('tochka.com', 'someRootCookie')
    ];

    const selected = selectCookiesForHost(cookies, 'i.tochka.com');

    expect(selected).toEqual(cookies);
  });

  it('excludes cookies scoped to a sibling subdomain such as id.tochka.com', () => {
    const cookies = [
      cookie('i.tochka.com', 'JSESSIONID'),
      cookie('id.tochka.com', 't_uid'),
      cookie('.id.tochka.com', 'ID-CSRF-TOKEN'),
      cookie('idXtochka.com', 'notARealSubdomain')
    ];

    const selected = selectCookiesForHost(cookies, 'i.tochka.com');

    expect(selected).toEqual([cookie('i.tochka.com', 'JSESSIONID')]);
  });

  it('excludes cookies scoped to an unrelated domain', () => {
    const cookies = [cookie('example.com', 'unrelated')];

    expect(selectCookiesForHost(cookies, 'i.tochka.com')).toEqual([]);
  });
});

describe('dedupeCookies', () => {
  it('collapses duplicates by the (host, name) pair, keeping the first occurrence', () => {
    const cookies = [
      cookie('i.tochka.com', 'JSESSIONID', 'first'),
      cookie('.tochka.com', 'RsRememberMeToken', 'first'),
      cookie('i.tochka.com', 'JSESSIONID', 'second-window-duplicate'),
      cookie('.tochka.com', 'RsRememberMeToken', 'second-window-duplicate')
    ];

    const deduped = dedupeCookies(cookies);

    expect(deduped).toEqual([
      cookie('i.tochka.com', 'JSESSIONID', 'first'),
      cookie('.tochka.com', 'RsRememberMeToken', 'first')
    ]);
  });

  it('keeps cookies with the same name but different hosts as distinct entries', () => {
    const cookies = [cookie('i.tochka.com', 'X-CSRF-TOKEN', 'a'), cookie('.tochka.com', 'X-CSRF-TOKEN', 'b')];

    expect(dedupeCookies(cookies)).toEqual(cookies);
  });
});

describe('buildCookieHeader', () => {
  it('joins cookies into a "name=value; name=value" string', () => {
    const cookies = [cookie('i.tochka.com', 'JSESSIONID', 'abc'), cookie('.tochka.com', 'RsRememberMeToken', 'xyz')];

    expect(buildCookieHeader(cookies)).toBe('JSESSIONID=abc; RsRememberMeToken=xyz');
  });

  it('returns an empty string for no cookies', () => {
    expect(buildCookieHeader([])).toBe('');
  });
});

describe('buildCookieHeaderForHost', () => {
  it('filters, dedupes, and assembles the cookie header for the target host', () => {
    const cookies = [
      cookie('i.tochka.com', 'JSESSIONID', 'session-value'),
      cookie('.tochka.com', 'X-CSRF-TOKEN', 'csrf-value'),
      cookie('.tochka.com', 'X-CSRF-TOKEN', 'csrf-value'), // duplicate from a second window
      cookie('id.tochka.com', 't_uid', 'unrelated-value')
    ];

    const header = buildCookieHeaderForHost(cookies, 'i.tochka.com');

    expect(header).toBe('JSESSIONID=session-value; X-CSRF-TOKEN=csrf-value');
  });
});
