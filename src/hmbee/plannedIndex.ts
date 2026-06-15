import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';

export type PlannedCandidateIndex = Map<string, HoneyMoneyCacheEntry[]>;

export function buildPlannedCandidateIndex(entries: HoneyMoneyCacheEntry[]): PlannedCandidateIndex {
  const index: PlannedCandidateIndex = new Map();
  for (const entry of entries) {
    if (!isUnconfirmedPlan(entry)) continue;
    const accountId = entry.account_id;
    if (accountId == null) continue;
    const key = makeKey(accountId, entry.subtype, entry.category ?? null, entry.date.slice(0, 7));
    const list = index.get(key);
    if (list) {
      list.push(entry);
    } else {
      index.set(key, [entry]);
    }
  }
  return index;
}

export function getPlanCandidates(
  index: PlannedCandidateIndex,
  accountId: number,
  subtype: string,
  category: string | null,
  yearMonth: string
): HoneyMoneyCacheEntry[] {
  return index.get(makeKey(accountId, subtype, category, yearMonth)) ?? [];
}

function isUnconfirmedPlan(entry: HoneyMoneyCacheEntry): boolean {
  return entry.type === 'planned' && entry.plan_amount != null && entry.real_amount == null;
}

function makeKey(accountId: number, subtype: string, category: string | null, yearMonth: string): string {
  const cat = subtype === 't' ? '' : (category ?? '');
  return `${accountId}|${subtype}|${cat}|${yearMonth}`;
}
