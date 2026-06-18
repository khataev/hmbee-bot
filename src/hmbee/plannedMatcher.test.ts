import type { PreviewRecord } from 'src/apply/preview/types.js';
import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';
import { buildPlannedCandidateIndex } from 'src/hmbee/plannedIndex.js';
import { applyMatchPass, matchPlannedTransaction } from 'src/hmbee/plannedMatcher.js';
import { describe, expect, it } from 'vitest';

function makeCreateRecord(overrides?: { save?: boolean; reason?: string }): PreviewRecord {
  return {
    identified: true,
    save: overrides?.save ?? true,
    reason: overrides?.reason ?? null,
    sourceRecord: {},
    normalized: {
      transactionId: 'tx-1',
      account: '40802810309500023530',
      status: 'Withdraw',
      date: '2026-05-15T09:23:45',
      type: 'expense',
      amount: 5000,
      currency: 'RUB',
      description: 'Аренда'
    },
    hmbee: {
      subtype: 'e',
      date: '2026-05-15',
      account_id: 2053036,
      currency: 'rub',
      id: null,
      type: 'unplanned',
      virtual_id: -1,
      category: 'Аренда',
      description: '5000',
      planned_repeat_days: 0,
      planned_repeat_end: 'always',
      planned_repeat_end_date: null,
      transfer_to_amount: null,
      transfer_type: 'a',
      real_amount: -5000,
      plan_amount: null,
      common_id: null,
      transfer_to_currency: null
    }
  };
}

// Builds an expense record with custom transactionId, real_amount (negative), and hmbee date (YYYY-MM-DD)
function makeExpenseRecord(transactionId: string, realAmount: number, date: string): PreviewRecord {
  return {
    identified: true,
    save: true,
    reason: null,
    sourceRecord: {},
    normalized: {
      transactionId,
      account: '40802810309500023530',
      status: 'Withdraw',
      date: `${date}T09:00:00`,
      type: 'expense',
      amount: Math.abs(realAmount),
      currency: 'RUB',
      description: 'Аренда'
    },
    hmbee: {
      subtype: 'e',
      date,
      account_id: 2053036,
      currency: 'rub',
      id: null,
      type: 'unplanned',
      virtual_id: -1,
      category: 'Аренда',
      description: String(Math.abs(realAmount)),
      planned_repeat_days: 0,
      planned_repeat_end: 'always',
      planned_repeat_end_date: null,
      transfer_to_amount: null,
      transfer_type: 'a',
      real_amount: realAmount,
      plan_amount: null,
      common_id: null,
      transfer_to_currency: null
    }
  };
}

function makePlan(overrides: Partial<HoneyMoneyCacheEntry> & Pick<HoneyMoneyCacheEntry, 'id'>): HoneyMoneyCacheEntry {
  return {
    type: 'planned',
    subtype: 'e',
    real_amount: null,
    plan_amount: -5000,
    currency: 'rub',
    description: 'Аренда',
    date: '2026-05-10',
    category: 'Аренда',
    account_id: 2053036,
    ...overrides
  };
}

describe('matchPlannedTransaction', () => {
  it('exact match: returns matched-exact and the plan', () => {
    const plan = makePlan({ id: 1, plan_amount: -5000 });
    const index = buildPlannedCandidateIndex([plan]);
    const result = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-15T09:23:45', 5000);
    expect(result.status).toBe('matched-exact');
    expect(result.plan?.id).toBe(1);
  });

  it('within tolerance: returns matched-tolerance', () => {
    const plan = makePlan({ id: 1, plan_amount: -5000 });
    // 5999 is within 20% of 5000 (max = 6000)
    const index = buildPlannedCandidateIndex([plan]);
    const result = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-15T09:23:45', 5999);
    expect(result.status).toBe('matched-tolerance');
    expect(result.plan?.id).toBe(1);
  });

  it('at lower tolerance boundary: returns matched-tolerance', () => {
    const plan = makePlan({ id: 1, plan_amount: -5000 });
    // 4001 is within 20% of 5000 (min = 4000)
    const index = buildPlannedCandidateIndex([plan]);
    const result = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-15T09:23:45', 4001);
    expect(result.status).toBe('matched-tolerance');
  });

  it('outside tolerance: returns out-of-tolerance', () => {
    const plan = makePlan({ id: 1, plan_amount: -5000 });
    // 3999 is outside 20% of 5000 (min = 4000)
    const index = buildPlannedCandidateIndex([plan]);
    const result = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-15T09:23:45', 3999);
    expect(result.status).toBe('out-of-tolerance');
    expect(result.plan).toBeNull();
  });

  it('wrong direction: returns no-candidate', () => {
    // Plan is expense (e), source is income (i) — different index bucket
    const plan = makePlan({ id: 1, subtype: 'e' });
    const index = buildPlannedCandidateIndex([plan]);
    const result = matchPlannedTransaction(index, 2053036, 'i', 'Аренда', '2026-05-15T09:23:45', 5000);
    expect(result.status).toBe('no-candidate');
    expect(result.plan).toBeNull();
  });

  it('no candidate in month: returns no-candidate', () => {
    const plan = makePlan({ id: 1, date: '2026-05-10' });
    const index = buildPlannedCandidateIndex([plan]);
    const result = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-06-15T09:23:45', 5000);
    expect(result.status).toBe('no-candidate');
  });

  it('transfer: ignores category in key', () => {
    const plan = makePlan({ id: 1, subtype: 't', category: null, plan_amount: 10000 });
    const index = buildPlannedCandidateIndex([plan]);
    const result = matchPlannedTransaction(index, 2053036, 't', 'some-ignored', '2026-05-15T09:23:45', 10000);
    expect(result.status).toBe('matched-exact');
    expect(result.plan?.id).toBe(1);
  });

  it('1:1 — two source transactions, one planned: only first matches', () => {
    const plan = makePlan({ id: 1 });
    const index = buildPlannedCandidateIndex([plan]);
    const first = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-15T09:23:45', 5000);
    const second = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-15T14:07:02', 5000);
    expect(first.status).toBe('matched-exact');
    expect(second.status).toBe('no-candidate');
  });

  it('1:1 — two planned, two source transactions: each matches distinct plan', () => {
    const p1 = makePlan({ id: 1, date: '2026-05-05', plan_amount: -5000 });
    const p2 = makePlan({ id: 2, date: '2026-05-20', plan_amount: -5000 });
    const index = buildPlannedCandidateIndex([p1, p2]);
    const r1 = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-06T08:15:00', 5000);
    const r2 = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-19T17:42:33', 5000);
    expect(r1.plan?.id).toBe(1);
    expect(r2.plan?.id).toBe(2);
  });

  it('tie-break by amount when dates are equidistant', () => {
    const p1 = makePlan({ id: 1, date: '2026-05-05', plan_amount: -5000 }); // |5000-5000|=0
    const p2 = makePlan({ id: 2, date: '2026-05-15', plan_amount: -5200 }); // |5000-5200|=200
    // Source date 2026-05-10: 5 days from each
    const index = buildPlannedCandidateIndex([p1, p2]);
    const result = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-10T12:00:00', 5000);
    expect(result.plan?.id).toBe(1);
  });

  it('ambiguous: two candidates with equal date and amount distance', () => {
    const p1 = makePlan({ id: 1, date: '2026-05-10', plan_amount: -5000 });
    const p2 = makePlan({ id: 2, date: '2026-05-10', plan_amount: -5000 });
    const index = buildPlannedCandidateIndex([p1, p2]);
    const result = matchPlannedTransaction(index, 2053036, 'e', 'Аренда', '2026-05-15T09:23:45', 5000);
    expect(result.status).toBe('ambiguous');
    expect(result.plan).toBeNull();
  });
});

describe('applyMatchPass', () => {
  it('matched record gets confirm-shaped hmbee with plan id and stays identified and save-ready', () => {
    const plan = makePlan({ id: 42, plan_amount: -5000, common_id: 7, virtual_id: 3 });
    const index = buildPlannedCandidateIndex([plan]);
    const record = makeCreateRecord();
    const [result] = applyMatchPass([record], index);
    expect(result?.hmbee?.id).toBe(42);
    expect(result?.hmbee?.type).toBe('planned');
    expect(result?.hmbee?.plan_amount).toBe(-5000);
    expect(result?.hmbee?.common_id).toBe(7);
    expect(result?.hmbee?.virtual_id).toBe(3);
    expect(result?.planMatch?.status).toBe('matched-exact');
    expect(result?.identified).toBe(true);
    expect(result?.save).toBe(true);
    expect(result?.reason).toBeNull();
  });

  it('unmatched record keeps create draft (id=null) and save=true', () => {
    const index = buildPlannedCandidateIndex([]);
    const [result] = applyMatchPass([makeCreateRecord()], index);
    expect(result?.hmbee?.id).toBeNull();
    expect(result?.save).toBe(true);
    expect(result?.planMatch?.status).toBe('no-candidate');
  });

  it('skipped record (save=false) is not touched by match pass', () => {
    const plan = makePlan({ id: 1 });
    const index = buildPlannedCandidateIndex([plan]);
    const skipped = makeCreateRecord({ save: false, reason: 'Внесена вручную' });
    const [result] = applyMatchPass([skipped], index);
    expect(result?.hmbee?.id).toBeNull();
    expect(result?.planMatch).toBeUndefined();
    expect(result?.save).toBe(false);
  });
});

describe('applyMatchPass — bucket resolution', () => {
  it('exact real beats earlier near-miss: near-miss gets beaten-match (reported bug)', () => {
    // Both reals target the same plan; near-miss appears first in file but must lose to the exact match
    const plan = makePlan({ id: 7, plan_amount: -5000, date: '2026-05-10' });
    const index = buildPlannedCandidateIndex([plan]);
    const nearMiss = makeExpenseRecord('tx-near', -5200, '2026-05-15'); // |5200-5000|=200
    const exact = makeExpenseRecord('tx-exact', -5000, '2026-05-15'); // |5000-5000|=0

    const [resultNear, resultExact] = applyMatchPass([nearMiss, exact], index);

    expect(resultExact?.planMatch?.status).toBe('matched-exact');
    expect(resultExact?.hmbee?.id).toBe(7);

    expect(resultNear?.planMatch?.status).toBe('beaten-match');
    expect(resultNear?.planMatch?.lostPlanId).toBe(7);
    expect(resultNear?.planMatch?.beatenById).toBe('tx-exact');
  });

  it('result is independent of record order in source file', () => {
    const plan = makePlan({ id: 1, plan_amount: -5000, date: '2026-05-10' });
    const nearMiss = makeExpenseRecord('tx-near', -5200, '2026-05-15');
    const exact = makeExpenseRecord('tx-exact', -5000, '2026-05-15');

    const indexB = buildPlannedCandidateIndex([plan]);
    const [resultExact, resultNear] = applyMatchPass([exact, nearMiss], indexB);

    expect(resultExact?.planMatch?.status).toBe('matched-exact');
    expect(resultExact?.hmbee?.id).toBe(1);
    expect(resultNear?.planMatch?.status).toBe('beaten-match');
  });

  it('ambiguous: plan contested by two reals at identical distance', () => {
    const plan = makePlan({ id: 1, plan_amount: -5000, date: '2026-05-10' });
    const index = buildPlannedCandidateIndex([plan]);
    const r1 = makeExpenseRecord('tx-1', -5000, '2026-05-15'); // same amount diff=0, same date diff
    const r2 = makeExpenseRecord('tx-2', -5000, '2026-05-15');
    const [res1, res2] = applyMatchPass([r1, r2], index);
    expect(res1?.planMatch?.status).toBe('ambiguous');
    expect(res2?.planMatch?.status).toBe('ambiguous');
  });

  it('ambiguous: real equidistant between two plans', () => {
    // real date 2026-05-10 is 5 days from both plan dates; same amount → true tie
    const p1 = makePlan({ id: 1, plan_amount: -5000, date: '2026-05-05' });
    const p2 = makePlan({ id: 2, plan_amount: -5000, date: '2026-05-15' });
    const index = buildPlannedCandidateIndex([p1, p2]);
    const r = makeExpenseRecord('tx-1', -5000, '2026-05-10');
    const [result] = applyMatchPass([r], index);
    expect(result?.planMatch?.status).toBe('ambiguous');
  });
});
