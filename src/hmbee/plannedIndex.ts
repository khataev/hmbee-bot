import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';

export type UnconfirmedPlannedTxn = HoneyMoneyCacheEntry & {
  type: 'planned';
  plan_amount: number;
  real_amount: null;
  account_id: number;
  subtype: 'e' | 'i' | 't';
};

export type PlannedCandidateIndex = Map<string, UnconfirmedPlannedTxn[]>;

export function buildPlannedCandidateIndex(entries: HoneyMoneyCacheEntry[]): PlannedCandidateIndex {
  const index: PlannedCandidateIndex = new Map();
  for (const entry of entries) {
    if (!isUnconfirmedPlannedTxn(entry)) continue;
    const key = makeKey(entry.account_id, entry.subtype, entry.category ?? null, entry.date.slice(0, 7));
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
  subtype: 'e' | 'i' | 't',
  category: string | null,
  yearMonth: string
): UnconfirmedPlannedTxn[] {
  return index.get(makeKey(accountId, subtype, category, yearMonth)) ?? [];
}

// Plans left in the index after the match pass has consumed (spliced out) matched plans.
// Scoped to the source's Honey Money accounts and the year-months under consideration.
export function collectUnmatchedPlans(
  index: PlannedCandidateIndex,
  accountIds: Set<number>,
  yearMonths: Set<string>
): UnconfirmedPlannedTxn[] {
  const unmatched: UnconfirmedPlannedTxn[] = [];
  for (const plans of index.values()) {
    for (const plan of plans) {
      if (accountIds.has(plan.account_id) && yearMonths.has(plan.date.slice(0, 7))) {
        unmatched.push(plan);
      }
    }
  }
  return unmatched;
}

function isUnconfirmedPlannedTxn(entry: HoneyMoneyCacheEntry): entry is UnconfirmedPlannedTxn {
  return (
    entry.type === 'planned' &&
    entry.plan_amount != null &&
    entry.real_amount == null &&
    entry.account_id != null &&
    isKnownSubtype(entry.subtype)
  );
}

function isKnownSubtype(subtype: string): subtype is 'e' | 'i' | 't' {
  return subtype === 'e' || subtype === 'i' || subtype === 't';
}

function makeKey(accountId: number, subtype: 'e' | 'i' | 't', category: string | null, yearMonth: string): string {
  const cat = subtype === 't' ? '' : (category ?? '');
  return `${accountId}|${subtype}|${cat}|${yearMonth}`;
}
