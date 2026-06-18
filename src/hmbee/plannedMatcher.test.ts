import type { PreviewRecord } from 'src/apply/preview/types.js';
import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';
import { buildPlannedCandidateIndex } from 'src/hmbee/plannedIndex.js';
import { applyMatchPass } from 'src/hmbee/plannedMatcher.js';
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

describe('applyMatchPass — single-bucket regression (N=1)', () => {
  it('one record, one plan within tolerance: matched-tolerance with confirm hmbee', () => {
    const plan = makePlan({ id: 5, plan_amount: -5000 });
    const index = buildPlannedCandidateIndex([plan]);
    const [result] = applyMatchPass([makeExpenseRecord('tx-1', -5200, '2026-05-15')], index);
    expect(result?.planMatch?.status).toBe('matched-tolerance');
    expect(result?.hmbee?.id).toBe(5);
  });

  it('one record, plan outside tolerance: out-of-tolerance, create draft kept', () => {
    const plan = makePlan({ id: 5, plan_amount: -5000 });
    const index = buildPlannedCandidateIndex([plan]);
    const [result] = applyMatchPass([makeExpenseRecord('tx-1', -3000, '2026-05-15')], index);
    expect(result?.planMatch?.status).toBe('out-of-tolerance');
    expect(result?.hmbee?.id).toBeNull();
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
