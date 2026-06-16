import type { PreviewRecord } from 'src/apply/preview/types.js';
import {
  collectUnmatchedPlans,
  type PlannedCandidateIndex,
  type UnconfirmedPlannedTxn
} from 'src/hmbee/plannedIndex.js';

export interface PreviewPlannedOutput {
  records: PreviewRecord[];
  unmatchedPlans: UnconfirmedPlannedTxn[];
}

// Plan-relevant records: matched (matched-exact/matched-tolerance) and candidates
// (out-of-tolerance/ambiguous). Records with no planned match status or `no-candidate`
// are ordinary creates and excluded from the planned view.
export function selectPlanRelevantRecords(records: PreviewRecord[]): PreviewRecord[] {
  return records.filter(
    (record) => record.plannedMatchStatus !== undefined && record.plannedMatchStatus !== 'no-candidate'
  );
}

export function buildPreviewPlannedOutput(
  records: PreviewRecord[],
  index: PlannedCandidateIndex,
  accountIds: Set<number>
): PreviewPlannedOutput {
  const yearMonths = new Set(records.flatMap((r) => r.normalized?.date?.slice(0, 7) ?? []));
  return {
    records: selectPlanRelevantRecords(records).sort((a, b) =>
      (a.normalized?.date ?? '').localeCompare(b.normalized?.date ?? '')
    ),
    unmatchedPlans: collectUnmatchedPlans(index, accountIds, yearMonths).sort((a, b) => a.date.localeCompare(b.date))
  };
}
