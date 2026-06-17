import type {
  HoneyMoneyConfirmIncomeExpenseTransaction,
  HoneyMoneyConfirmTransferTransaction,
  HoneyMoneyIncomeExpenseTransaction,
  HoneyMoneyTransferTransaction,
  MatchStatus,
  PreviewRecord
} from 'src/apply/preview/types.js';
import { getPlanCandidates, type PlannedCandidateIndex, type UnconfirmedPlannedTxn } from 'src/hmbee/plannedIndex.js';

const AMOUNT_MATCH_TOLERANCE = 0.2; // 20% of plan_amount

export interface MatchResult {
  status: MatchStatus;
  plan: UnconfirmedPlannedTxn | null;
}

export function matchPlannedTransaction(
  index: PlannedCandidateIndex,
  accountId: number,
  subtype: 'e' | 'i' | 't',
  category: string | null,
  date: string,
  sourceAmount: number
): MatchResult {
  const yearMonth = date.slice(0, 7);
  const candidates = getPlanCandidates(index, accountId, subtype, category, yearMonth);

  if (candidates.length === 0) {
    return { status: 'no-candidate', plan: null };
  }

  const sourceAbs = Math.abs(Math.round(sourceAmount));
  const withinTolerance = candidates.filter((plan) => isWithinTolerance(sourceAbs, plan.plan_amount));

  if (withinTolerance.length === 0) {
    return { status: 'out-of-tolerance', plan: null };
  }

  const [matched, ...rest] = selectBest(withinTolerance, date, sourceAbs);
  // candidates.length > 0 was verified above; TS can't track it through selectBest's return type
  if (!matched || rest.length > 0) {
    return { status: 'ambiguous', plan: null };
  }
  const idx = candidates.indexOf(matched);
  if (idx !== -1) candidates.splice(idx, 1);

  const planAbs = Math.abs(matched.plan_amount);
  return {
    status: sourceAbs === planAbs ? 'matched-exact' : 'matched-tolerance',
    plan: matched
  };
}

export function applyMatchPass(records: PreviewRecord[], index: PlannedCandidateIndex): PreviewRecord[] {
  return records.map((record) => {
    if (!record.identified || !record.save || !record.hmbee || record.hmbee.id !== null) {
      return record;
    }
    const { account_id, subtype, category, date, real_amount } = record.hmbee;
    const result = matchPlannedTransaction(index, account_id, subtype, category, date, real_amount);
    if (result.plan !== null) {
      return {
        ...record,
        hmbee: buildConfirmHmbee(record.hmbee, result.plan),
        plannedMatchStatus: result.status
      };
    }
    return { ...record, plannedMatchStatus: result.status };
  });
}

function buildConfirmHmbee(
  createDraft: HoneyMoneyIncomeExpenseTransaction | HoneyMoneyTransferTransaction,
  plan: UnconfirmedPlannedTxn
): HoneyMoneyConfirmIncomeExpenseTransaction | HoneyMoneyConfirmTransferTransaction {
  const planOverrides = {
    id: plan.id,
    type: 'planned' as const,
    plan_amount: plan.plan_amount,
    common_id: plan.common_id ?? null,
    virtual_id: plan.virtual_id ?? null
  };
  if (createDraft.subtype === 't') {
    return { ...createDraft, ...planOverrides } as HoneyMoneyConfirmTransferTransaction;
  }
  return { ...createDraft, ...planOverrides } as HoneyMoneyConfirmIncomeExpenseTransaction;
}

function isWithinTolerance(sourceAbs: number, planAmount: number): boolean {
  const planAbs = Math.abs(planAmount);
  return Math.abs(sourceAbs - planAbs) <= AMOUNT_MATCH_TOLERANCE * planAbs;
}

function selectBest(
  candidates: UnconfirmedPlannedTxn[],
  transactionDate: string,
  sourceAbs: number
): UnconfirmedPlannedTxn[] {
  if (candidates.length === 1) return candidates;

  const txTime = new Date(transactionDate.slice(0, 10)).getTime();
  const dateDiffs = candidates.map((plan) => Math.abs(new Date(plan.date.slice(0, 10)).getTime() - txTime));
  const minDateDiff = Math.min(...dateDiffs);
  const byDate = candidates.filter((_, i) => dateDiffs[i] === minDateDiff);

  if (byDate.length === 1) return byDate;

  const amountDiffs = byDate.map((plan) => Math.abs(Math.abs(plan.plan_amount) - sourceAbs));
  const minAmountDiff = Math.min(...amountDiffs);
  return byDate.filter((_, i) => amountDiffs[i] === minAmountDiff);
}
