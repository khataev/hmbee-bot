import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';
import { buildPlannedCandidateIndex, getPlanCandidates } from 'src/hmbee/plannedIndex.js';
import { describe, expect, it } from 'vitest';

function makeEntry(overrides: Partial<HoneyMoneyCacheEntry> & Pick<HoneyMoneyCacheEntry, 'id'>): HoneyMoneyCacheEntry {
  return {
    type: 'planned',
    subtype: 'e',
    real_amount: null,
    plan_amount: 5000,
    currency: 'rub',
    description: 'Аренда',
    date: '2026-05-10',
    category: 'Аренда',
    account_id: 2053036,
    common_id: 'cid-default',
    virtual_id: 1,
    ...overrides
  };
}

describe('buildPlannedCandidateIndex', () => {
  it('includes unconfirmed planned entries', () => {
    const entry = makeEntry({ id: 1 });
    const index = buildPlannedCandidateIndex([entry]);
    expect(index.size).toBe(1);
  });

  it('excludes entries with real_amount set (confirmed plans)', () => {
    const confirmed = makeEntry({ id: 1, real_amount: 5000 });
    const index = buildPlannedCandidateIndex([confirmed]);
    expect(index.size).toBe(0);
  });

  it('excludes entries with type "unplanned"', () => {
    const unplanned = makeEntry({ id: 1, type: 'unplanned', plan_amount: null });
    const index = buildPlannedCandidateIndex([unplanned]);
    expect(index.size).toBe(0);
  });

  it('excludes entries with plan_amount null', () => {
    const entry = makeEntry({ id: 1, plan_amount: null });
    const index = buildPlannedCandidateIndex([entry]);
    expect(index.size).toBe(0);
  });

  it('excludes entries without account_id', () => {
    const entry = makeEntry({ id: 1, account_id: undefined });
    const index = buildPlannedCandidateIndex([entry]);
    expect(index.size).toBe(0);
  });

  it('excludes entries without common_id', () => {
    const entry = makeEntry({ id: 1, common_id: undefined });
    const index = buildPlannedCandidateIndex([entry]);
    expect(index.size).toBe(0);
  });

  it('excludes entries with virtual_id -1 (unplanned sentinel)', () => {
    const entry = makeEntry({ id: 1, virtual_id: -1 });
    const index = buildPlannedCandidateIndex([entry]);
    expect(index.size).toBe(0);
  });

  it('excludes transfer category from key', () => {
    const t1 = makeEntry({ id: 1, subtype: 't', category: 'Ignored' });
    const t2 = makeEntry({ id: 2, subtype: 't', category: null });
    const index = buildPlannedCandidateIndex([t1, t2]);
    // Both should land in the same bucket since category is ignored for transfers
    const candidates = getPlanCandidates(index, 2053036, 't', null, '2026-05');
    expect(candidates.map((e) => e.id)).toEqual([1, 2]);
  });

  it('groups multiple plans under the same key', () => {
    const e1 = makeEntry({ id: 1, plan_amount: 5000 });
    const e2 = makeEntry({ id: 2, plan_amount: 6000 });
    const index = buildPlannedCandidateIndex([e1, e2]);
    const candidates = getPlanCandidates(index, 2053036, 'e', 'Аренда', '2026-05');
    expect(candidates).toHaveLength(2);
  });
});

describe('getPlanCandidates', () => {
  it('returns candidates matching account, subtype, category and month', () => {
    const entry = makeEntry({ id: 1 });
    const index = buildPlannedCandidateIndex([entry]);
    const candidates = getPlanCandidates(index, 2053036, 'e', 'Аренда', '2026-05');
    expect(candidates[0]?.id).toBe(1);
  });

  it('returns empty array when month differs', () => {
    const entry = makeEntry({ id: 1, date: '2026-05-10' });
    const index = buildPlannedCandidateIndex([entry]);
    const candidates = getPlanCandidates(index, 2053036, 'e', 'Аренда', '2026-06');
    expect(candidates).toHaveLength(0);
  });

  it('returns empty array when account differs', () => {
    const entry = makeEntry({ id: 1 });
    const index = buildPlannedCandidateIndex([entry]);
    const candidates = getPlanCandidates(index, 9999999, 'e', 'Аренда', '2026-05');
    expect(candidates).toHaveLength(0);
  });

  it('returns empty array when category differs', () => {
    const entry = makeEntry({ id: 1, category: 'Аренда' });
    const index = buildPlannedCandidateIndex([entry]);
    const candidates = getPlanCandidates(index, 2053036, 'e', 'Продукты', '2026-05');
    expect(candidates).toHaveLength(0);
  });

  it('does not mutate index (repeated calls return same list)', () => {
    const entry = makeEntry({ id: 1 });
    const index = buildPlannedCandidateIndex([entry]);
    const first = getPlanCandidates(index, 2053036, 'e', 'Аренда', '2026-05');
    const second = getPlanCandidates(index, 2053036, 'e', 'Аренда', '2026-05');
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it('repeat fields survive indexing and are present on the candidate', () => {
    const entry = makeEntry({
      id: 1,
      planned_repeat_days: 7,
      planned_repeat_end: 'date',
      planned_repeat_end_date: '2026-06-28'
    });
    const index = buildPlannedCandidateIndex([entry]);
    const [candidate] = getPlanCandidates(index, 2053036, 'e', 'Аренда', '2026-05');
    expect(candidate?.planned_repeat_days).toBe(7);
    expect(candidate?.planned_repeat_end).toBe('date');
    expect(candidate?.planned_repeat_end_date).toBe('2026-06-28');
  });
});
