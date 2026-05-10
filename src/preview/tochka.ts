import type { NormalizedRecord, PreviewRecord } from './types.js';

/**
 * Normalizes a Tochka sync record into the internal preview representation.
 * Only supports income/expense flow with specific statuses.
 */
export function normalizeTochkaRecord(sourceRecord: any): PreviewRecord {
  const data = sourceRecord.data;
  const timeData = sourceRecord.meta_data?.time_data;

  // Supported statuses for identification
  const supportedStatuses = ['Withdraw', 'InProgress'];
  const isSupportedStatus = supportedStatuses.includes(data.status);

  // Supported types for income/expense flow
  const supportedTypes = ['Purchase', 'Income'];
  const isSupportedType = supportedTypes.includes(data.tranCode);

  const identified = isSupportedStatus && isSupportedType;

  const normalized: NormalizedRecord = {
    identified,
    transactionId: String(data.tranId ?? ''),
    account: data.account ?? '',
    status: data.status,
    date: timeData?.event_date || '',
    type: data.tranCode ?? '',
    amount: data.sum,
    currency: data.currency,
    description: data.description || data.title || ''
  };

  return {
    normalized,
    hmbee: {} // Branch 4.1 will populate this
  };
}
