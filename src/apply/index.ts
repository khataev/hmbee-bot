import type { HoneyMoneyTransaction, NormalizedRecord, PreviewRecord } from 'src/apply/preview/types.js';

export type ReadyApplyRecord = PreviewRecord & {
  identified: true;
  normalized: NormalizedRecord;
  hmbee: HoneyMoneyTransaction;
};

export function parseOnlyIdsOption(onlyIdOption?: string): Set<string> | null {
  if (!onlyIdOption) {
    return null;
  }

  const ids = onlyIdOption
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (ids.length === 0) {
    throw new Error('The --only-id option requires a comma-separated list of transaction ids.');
  }

  return new Set(ids);
}

export function filterApplyRecords(records: ReadyApplyRecord[], onlyIds: Set<string> | null): ReadyApplyRecord[] {
  if (onlyIds === null) {
    return records;
  }

  return records.filter((record) => onlyIds.has(record.normalized.transactionId));
}
