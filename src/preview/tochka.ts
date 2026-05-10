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
    date: timeData?.event_date,
    type: data.tranCode ?? '',
    amount: data.sum,
    currency: data.currency,
    description: data.title,
    mcc: data.mcc ? String(data.mcc) : undefined
  };

  return {
    normalized,
    hmbee: {
      category: mapTochkaCategory(normalized.description, normalized.mcc)
    }
  };
}

/**
 * Maps Tochka description or MCC to Honey Money category.
 */
function mapTochkaCategory(description: string, mcc?: string): string | null {
  // 1. Try MCC first
  if (mcc) {
    const mccMap: Record<string, string> = {
      '5411': 'Покупки / Продукты',
      '5499': 'Покупки / Продукты',
      '5300': 'Покупки / Маркетплейсы',
      '5309': 'Путешествия / Покупки',
      '5812': 'Еда вне дома',
      '5814': 'Еда вне дома',
      '5912': 'Покупки / Аптека и БАДы',
      '8011': 'Услуги / Медицинские услуги',
      '4121': 'Проезд / Такси'
    };
    if (mccMap[mcc]) return mccMap[mcc];
  }

  // 2. Fallback to description mapping (only for those without MCC mapping or with specific overrides)
  const desc = description.toUpperCase();
  if (desc.includes('ART-MOSKVA')) {
    return 'Услуги / Коворкинг';
  }
  return null;
}
