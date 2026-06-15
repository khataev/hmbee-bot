import type { MatchStatus } from 'src/apply/preview/types.js';
import { getPlanCandidates, type PlannedCandidateIndex, type UnconfirmedPlannedTxn } from 'src/hmbee/plannedIndex.js';

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
  // HINT: 'matched' is always present at this point, this check here only just to make TS happy
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

function isWithinTolerance(sourceAbs: number, planAmount: number): boolean {
  const planAbs = Math.abs(planAmount);
  return Math.abs(sourceAbs - planAbs) <= 0.2 * planAbs;
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
