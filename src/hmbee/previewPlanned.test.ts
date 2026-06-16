import type { MatchStatus, PreviewRecord } from 'src/apply/preview/types.js';
import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';
import { buildPlannedCandidateIndex } from 'src/hmbee/plannedIndex.js';
import { buildPreviewPlannedOutput, selectPlanRelevantRecords } from 'src/hmbee/previewPlanned.js';
import { describe, expect, it } from 'vitest';

function record(status?: MatchStatus): PreviewRecord {
  return {
    identified: true,
    save: true,
    reason: null,
    sourceRecord: {},
    normalized: {
      transactionId: 't1',
      account: '40802810309500023530',
      status: 'ok',
      date: '2026-05-10',
      type: 'expense',
      amount: 5000,
      currency: 'rub',
      description: 'x'
    },
    ...(status ? { plannedMatchStatus: status } : {})
  };
}

function plan(overrides: Partial<HoneyMoneyCacheEntry> & Pick<HoneyMoneyCacheEntry, 'id'>): HoneyMoneyCacheEntry {
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
    ...overrides
  };
}

describe('selectPlanRelevantRecords', () => {
  it('keeps matched and candidate statuses, drops no-candidate and unset', () => {
    const records = [
      record('matched-exact'),
      record('matched-tolerance'),
      record('out-of-tolerance'),
      record('ambiguous'),
      record('no-candidate'),
      record(undefined)
    ];
    const kept = selectPlanRelevantRecords(records).map((r) => r.plannedMatchStatus);
    expect(kept).toEqual(['matched-exact', 'matched-tolerance', 'out-of-tolerance', 'ambiguous']);
  });
});

describe('buildPreviewPlannedOutput', () => {
  it('includes plan-relevant records and source-scoped unmatched plans', () => {
    const index = buildPlannedCandidateIndex([plan({ id: 1 }), plan({ id: 2, plan_amount: 6000 })]);
    const output = buildPreviewPlannedOutput(
      [record('matched-exact'), record('no-candidate')],
      index,
      new Set([2053036])
    );
    expect(output.records).toHaveLength(1);
    expect(output.unmatchedPlans.map((p) => p.id)).toEqual([1, 2]);
  });

  it('excludes plans on accounts not mapped to the source', () => {
    const index = buildPlannedCandidateIndex([plan({ id: 1, account_id: 9999999 })]);
    const output = buildPreviewPlannedOutput([], index, new Set([2053036]));
    expect(output.unmatchedPlans).toHaveLength(0);
  });

  it('excludes plans outside the period under consideration', () => {
    const index = buildPlannedCandidateIndex([plan({ id: 1, date: '2026-08-10' })]);
    const output = buildPreviewPlannedOutput([], index, new Set([2053036]));
    expect(output.unmatchedPlans).toHaveLength(0);
  });

  it('returns empty output when nothing is plan-relevant', () => {
    const index = buildPlannedCandidateIndex([]);
    const output = buildPreviewPlannedOutput([record(undefined)], index, new Set([2053036]));
    expect(output.records).toHaveLength(0);
    expect(output.unmatchedPlans).toHaveLength(0);
  });
});
