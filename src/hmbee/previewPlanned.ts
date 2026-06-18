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

// Plan-relevant records: matched, out-of-tolerance, ambiguous, beaten-match.
// Records without planMatch or with no-candidate are ordinary creates, excluded from planned view.
export function selectPlanRelevantRecords(records: PreviewRecord[]): PreviewRecord[] {
  return records.filter((record) => record.planMatch !== undefined && record.planMatch.status !== 'no-candidate');
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
