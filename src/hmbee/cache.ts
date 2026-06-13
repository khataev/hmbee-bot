import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';

const CACHE_PATH = 'sync/hmbee/all_json_cache.json';
const LOOKBACK_DAYS = 10;

export function trimEntries(entries: HoneyMoneyCacheEntry[], from: string): HoneyMoneyCacheEntry[] {
  const boundary = subtractDays(from, LOOKBACK_DAYS);
  return entries.filter((entry) => entry.date >= boundary);
}

export function writeCache(entries: HoneyMoneyCacheEntry[]): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

function subtractDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
