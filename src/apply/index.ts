import { EXCLUDED_REASON } from 'src/apply/preview/tochka.js';
import type { HoneyMoneyTransaction, NormalizedRecord, PreviewRecord } from 'src/apply/preview/types.js';
import { MANUALLY_ENTERED_REASON } from 'src/hmbee/skipIndex.js';

type TransactionDispatcher = {
  createTransaction(t: HoneyMoneyTransaction): Promise<number>;
  confirmPlannedTransaction(t: HoneyMoneyTransaction): Promise<number>;
};

export async function dispatchTransaction(
  hmbee: HoneyMoneyTransaction,
  client: TransactionDispatcher
): Promise<number> {
  if (hmbee.id === null) return client.createTransaction(hmbee);

  return client.confirmPlannedTransaction(hmbee);
}

export type ReadyApplyRecord = PreviewRecord & {
  identified: true;
  normalized: NormalizedRecord;
  hmbee: HoneyMoneyTransaction;
};

export type PromptAnswer = 'y' | 'n' | 'q' | 'a';

export async function promptSend(summary: string, ask: (prompt: string) => Promise<string>): Promise<PromptAnswer> {
  while (true) {
    const answer = (await ask(`${summary}\n  → y/n/a/q? `)).trim().toLowerCase();
    if (answer === 'y' || answer === 'n' || answer === 'q' || answer === 'a') {
      return answer as PromptAnswer;
    }
  }
}

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

const EXPECTED_SKIP_REASONS = new Set<string>([EXCLUDED_REASON, MANUALLY_ENTERED_REASON]);

export function findProblematicRecords(records: PreviewRecord[]): PreviewRecord[] {
  return records.filter(
    (record) => !record.identified || (!record.save && !EXPECTED_SKIP_REASONS.has(record.reason ?? ''))
  );
}
