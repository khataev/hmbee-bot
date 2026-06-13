import { existsSync, readFileSync } from 'node:fs';
import type { PreviewRecord } from 'src/apply/preview/types.js';
import { CACHE_PATH } from 'src/hmbee/cache.js';
import { type HoneyMoneyCacheEntry, HoneyMoneyCacheEntrySchema } from 'src/hmbee/client.js';
import { z } from 'zod';

export type MatchIndex = Map<string, HoneyMoneyCacheEntry[]>;

type MatchableEntry = HoneyMoneyCacheEntry & { real_amount: number; account_id: number };

function isMatchable(entry: HoneyMoneyCacheEntry): entry is MatchableEntry {
  return entry.real_amount != null && entry.account_id != null;
}

export function loadCache(path = CACHE_PATH): HoneyMoneyCacheEntry[] {
  if (!existsSync(path)) {
    throw new Error(`Honey Money cache not found at ${path}. Run 'sync <source> --update-hmbee-cache' first.`);
  }
  return z.array(HoneyMoneyCacheEntrySchema).parse(JSON.parse(readFileSync(path, 'utf8')));
}

export function buildMatchIndex(entries: HoneyMoneyCacheEntry[]): MatchIndex {
  const index: MatchIndex = new Map();
  for (const entry of entries) {
    if (!isMatchable(entry)) continue;
    const key = makeCacheKey(entry);
    const list = index.get(key);
    if (list) {
      list.push(entry);
    } else {
      index.set(key, [entry]);
    }
  }
  return index;
}

export function consumeMatch(
  index: MatchIndex,
  accountId: number,
  date: string,
  realAmount: number,
  subtype: string,
  category: string | null,
  currency: string
): HoneyMoneyCacheEntry | null {
  const key = makeKey(accountId, date, realAmount, subtype, category, currency);
  const list = index.get(key);
  if (!list || list.length === 0) return null;
  return list.shift() ?? null;
}

export function applySkipPass(records: PreviewRecord[], index: MatchIndex): PreviewRecord[] {
  return records.map((record) => {
    if (!record.hmbee) return record;
    const { account_id, date, real_amount, subtype, category, currency } = record.hmbee;
    const match = consumeMatch(index, account_id, date, real_amount, subtype, category, currency);
    if (!match) return record;
    return { ...record, identified: true, save: false, reason: 'Внесена вручную' };
  });
}

function makeCacheKey(entry: MatchableEntry): string {
  return makeKey(
    entry.account_id,
    entry.date,
    entry.real_amount,
    entry.subtype,
    entry.category ?? null,
    entry.currency
  );
}

function makeKey(
  accountId: number,
  date: string,
  realAmount: number,
  subtype: string,
  category: string | null,
  currency: string
): string {
  const amount = Math.abs(Math.round(realAmount));
  const cat = subtype === 't' ? '' : (category ?? '');
  return `${accountId}|${date}|${amount}|${subtype}|${cat}|${currency}`;
}
