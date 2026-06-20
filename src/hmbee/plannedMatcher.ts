import type {
  HoneyMoneyConfirmIncomeExpenseTransaction,
  HoneyMoneyConfirmTransferTransaction,
  HoneyMoneyIncomeExpenseTransaction,
  HoneyMoneyTransferTransaction,
  PlanMatch,
  PreviewRecord
} from 'src/apply/preview/types.js';
import { getPlanCandidates, type PlannedCandidateIndex, type UnconfirmedPlannedTxn } from 'src/hmbee/plannedIndex.js';

const AMOUNT_MATCH_TOLERANCE = 0.2; // 20% of plan_amount

interface BucketEntry {
  index: number;
  transactionId: string;
  date: string;
  real_amount: number;
}

interface Bucket {
  entries: BucketEntry[];
  accountId: number;
  subtype: 'e' | 'i' | 't';
  category: string | null;
  yearMonth: string;
}

interface BucketEdge {
  realIndex: number;
  planIndex: number;
  amountDiff: number;
  dateDiff: number;
}

type BucketOutcome =
  | { tag: 'matched'; plan: UnconfirmedPlannedTxn; status: 'matched-exact' | 'matched-tolerance' }
  | { tag: 'unmatched'; status: 'no-candidate' | 'out-of-tolerance' | 'ambiguous' }
  | { tag: 'beaten'; lostPlanId: number; beatenById: string };

export function applyMatchPass(records: PreviewRecord[], index: PlannedCandidateIndex): PreviewRecord[] {
  // Phase 1: group matchable records by bucket key
  const buckets = new Map<string, Bucket>();

  for (const [recordIndex, record] of records.entries()) {
    if (!record.identified || !record.save || !record.hmbee || record.hmbee.id !== null) continue;
    const { account_id, subtype, category, date, real_amount } = record.hmbee;
    const yearMonth = date.slice(0, 7);
    const key = bucketKey(account_id, subtype, category, yearMonth);
    const entry: BucketEntry = {
      index: recordIndex,
      transactionId: record.normalized?.transactionId ?? '',
      date,
      real_amount
    };
    const group = buckets.get(key);
    if (group) {
      group.entries.push(entry);
    } else {
      buckets.set(key, { entries: [entry], accountId: account_id, subtype, category, yearMonth });
    }
  }

  // Phase 2: resolve each bucket
  const outcomes = new Map<number, BucketOutcome>();
  const consumedPlanIds = new Set<number>();

  for (const { entries: realTransactions, accountId, subtype, category, yearMonth } of buckets.values()) {
    const plans = getPlanCandidates(index, accountId, subtype, category, yearMonth);
    const bucketResults = resolveBucket(realTransactions, plans);

    for (const [entryIndex, entry] of realTransactions.entries()) {
      const outcome = bucketResults[entryIndex];
      if (!outcome) continue;

      outcomes.set(entry.index, outcome);
      if (outcome.tag === 'matched') consumedPlanIds.add(outcome.plan.id);
    }
  }

  // Remove consumed plans from index after all bucket resolutions (batch, not per-record)
  for (const planList of index.values()) {
    for (let planIndex = planList.length - 1; planIndex >= 0; planIndex--) {
      const plan = planList[planIndex];
      if (plan !== undefined && consumedPlanIds.has(plan.id)) planList.splice(planIndex, 1);
    }
  }

  // Phase 3: write outcomes back to records
  return records.map((record, recordIndex) => {
    const outcome = outcomes.get(recordIndex);
    if (!outcome) return record;

    if (outcome.tag === 'matched') {
      const planMatch: PlanMatch = { status: outcome.status };
      return {
        ...record,
        hmbee: buildConfirmHmbee(
          record.hmbee as HoneyMoneyIncomeExpenseTransaction | HoneyMoneyTransferTransaction,
          outcome.plan
        ),
        planMatch
      };
    }

    if (outcome.tag === 'beaten') {
      const planMatch: PlanMatch = {
        status: 'beaten-match',
        lostPlanId: outcome.lostPlanId,
        beatenById: outcome.beatenById
      };
      return { ...record, planMatch };
    }

    const planMatch: PlanMatch = { status: outcome.status };
    return { ...record, planMatch };
  });
}

function resolveBucket(realEntries: BucketEntry[], plans: UnconfirmedPlannedTxn[]): BucketOutcome[] {
  const outcomes: BucketOutcome[] = new Array(realEntries.length);

  if (plans.length === 0) {
    return realEntries.map((): BucketOutcome => ({ tag: 'unmatched', status: 'no-candidate' }));
  }

  // Build edges for every (real, plan) pair within tolerance
  const edges: BucketEdge[] = [];
  const realHasEdge: boolean[] = new Array(realEntries.length).fill(false);

  for (const [realIndex, entry] of realEntries.entries()) {
    for (const [planIndex, plan] of plans.entries()) {
      if (!isWithinTolerance(entry.real_amount, plan.plan_amount)) continue;
      const amountDiff = Math.abs(entry.real_amount - plan.plan_amount);
      const realTime = new Date(entry.date.slice(0, 10)).getTime();
      const planTime = new Date(plan.date.slice(0, 10)).getTime();
      const dateDiff = Math.abs(realTime - planTime);
      edges.push({ realIndex: realIndex, planIndex: planIndex, amountDiff, dateDiff });
      realHasEdge[realIndex] = true;
    }
  }

  for (const [realIndex, hasEdge] of realHasEdge.entries()) {
    if (!hasEdge) outcomes[realIndex] = { tag: 'unmatched', status: 'out-of-tolerance' };
  }

  // Sort by amount distance (primary), date distance (secondary) — quality-first greedy
  edges.sort((edgeA, edgeB) =>
    edgeA.amountDiff !== edgeB.amountDiff ? edgeA.amountDiff - edgeB.amountDiff : edgeA.dateDiff - edgeB.dateDiff
  );

  // freeEdges is recomputed each iteration; `edges` is kept intact — phase 3 searches it for lostPlanId
  let freeEdges = [...edges];
  // Indices of plans not yet consumed
  const freePlans = new Set<number>([...plans.keys()]);
  // Indices of real entries that have at least one in-tolerance edge and are not yet assigned
  const freeReals = new Set<number>();
  // planIndex → transactionId of the winner; used in phase 3 to fill beatenById
  const consumedBy = new Map<number, string>();

  for (const [realIndex, hasEdge] of realHasEdge.entries()) {
    if (hasEdge) freeReals.add(realIndex);
  }

  while (freeEdges.length > 0) {
    const [minEdge] = freeEdges;
    if (!minEdge) break;

    // All edges sharing the minimum weight — equally good, cannot be ranked further; check for ties
    const minEdges = freeEdges.filter(
      (edge) => edge.amountDiff === minEdge.amountDiff && edge.dateDiff === minEdge.dateDiff
    );

    // Count how many minEdges each endpoint appears in
    const realCount = new Map<number, number>();
    const planCount = new Map<number, number>();
    for (const edge of minEdges) {
      realCount.set(edge.realIndex, (realCount.get(edge.realIndex) ?? 0) + 1);
      planCount.set(edge.planIndex, (planCount.get(edge.planIndex) ?? 0) + 1);
    }

    // A real appearing in >1 minEdge is equidistant between two plans — genuine tie
    const tiedReals = new Set(
      Array.from(realCount.entries())
        .filter(([, count]) => count > 1)
        .map(([realIndex]) => realIndex)
    );
    // A plan appearing in >1 minEdge is contested by two reals at equal distance — both reals are tied
    const contestedPlans = new Set(
      Array.from(planCount.entries())
        .filter(([, count]) => count > 1)
        .map(([planIndex]) => planIndex)
    );
    for (const edge of minEdges) {
      if (contestedPlans.has(edge.planIndex)) tiedReals.add(edge.realIndex);
    }

    // Tied reals → ambiguous; removed from freeReals but their plans stay free for future iterations
    for (const realIndex of tiedReals) {
      outcomes[realIndex] = { tag: 'unmatched', status: 'ambiguous' };
      freeReals.delete(realIndex);
    }

    // Assign non-tied minEdges where both endpoints are still free
    for (const edge of minEdges) {
      if (!freeReals.has(edge.realIndex)) continue;
      if (!freePlans.has(edge.planIndex)) continue;

      const entry = realEntries[edge.realIndex];
      const plan = plans[edge.planIndex];
      if (!(entry && plan)) continue;

      outcomes[edge.realIndex] = {
        tag: 'matched',
        plan,
        status: entry.real_amount === plan.plan_amount ? 'matched-exact' : 'matched-tolerance'
      };
      consumedBy.set(edge.planIndex, entry.transactionId);
      freeReals.delete(edge.realIndex);
      freePlans.delete(edge.planIndex);
    }

    freeEdges = edges.filter((edge) => freeReals.has(edge.realIndex) && freePlans.has(edge.planIndex));
  }

  // Free reals still remaining had in-tolerance plans, all of which were taken → beaten-match
  for (const realIndex of freeReals) {
    const bestEdge = edges.find((edge) => edge.realIndex === realIndex);
    const lostPlan = bestEdge ? plans[bestEdge.planIndex] : undefined;
    const winnerId = bestEdge ? consumedBy.get(bestEdge.planIndex) : undefined;

    if (lostPlan && winnerId) {
      outcomes[realIndex] = { tag: 'beaten', lostPlanId: lostPlan.id, beatenById: winnerId };
    } else {
      // Unreachable: every real in freeReals has at least one edge (freeReals only contains
      // reals with realHasEdge=true), and every consumed plan is recorded in consumedBy.
      outcomes[realIndex] = { tag: 'unmatched', status: 'out-of-tolerance' };
    }
  }

  return outcomes;
}

function bucketKey(accountId: number, subtype: 'e' | 'i' | 't', category: string | null, yearMonth: string): string {
  const cat = subtype === 't' ? '' : (category ?? '');
  return `${accountId}|${subtype}|${cat}|${yearMonth}`;
}

function buildConfirmHmbee(
  createDraft: HoneyMoneyIncomeExpenseTransaction | HoneyMoneyTransferTransaction,
  plan: UnconfirmedPlannedTxn
): HoneyMoneyConfirmIncomeExpenseTransaction | HoneyMoneyConfirmTransferTransaction {
  const planOverrides = {
    id: plan.id,
    type: 'planned' as const,
    plan_amount: plan.plan_amount,
    common_id: plan.common_id,
    virtual_id: plan.virtual_id,
    planned_repeat_days: plan.planned_repeat_days,
    planned_repeat_end: plan.planned_repeat_end,
    planned_repeat_end_date: plan.planned_repeat_end_date
  };
  if (createDraft.subtype === 't') {
    return { ...createDraft, ...planOverrides } as HoneyMoneyConfirmTransferTransaction;
  }
  return { ...createDraft, ...planOverrides } as HoneyMoneyConfirmIncomeExpenseTransaction;
}

function isWithinTolerance(sourceAmount: number, planAmount: number): boolean {
  return Math.abs(sourceAmount - planAmount) <= AMOUNT_MATCH_TOLERANCE * Math.abs(planAmount);
}
