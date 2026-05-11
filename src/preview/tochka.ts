import type { NormalizedRecord, PreviewRecord } from './types.js';

export interface TochkaSyncRecord {
  meta_data: {
    time_data: {
      event_date: string;
    };
  };
  data: {
    tranId: string | number;
    account: string;
    status: string;
    tranCode: string;
    sum: number;
    currency: string;
    title: string;
    mcc: string;
  };
}

/**
 * Normalizes a Tochka sync record into the internal preview representation.
 * Only supports income/expense flow with specific statuses.
 */
export function normalizeTochkaRecord(sourceRecord: unknown): PreviewRecord {
  try {
    const r = sourceRecord as TochkaSyncRecord;
    const data = r.data;
    const timeData = r.meta_data.time_data;

    // Supported statuses for identification
    const status = data.status;
    const supportedStatuses = ['Withdraw', 'InProgress'];
    const isSupportedStatus = supportedStatuses.includes(status);

    // Supported types for income/expense flow
    const tranCode = data.tranCode;
    const supportedTypes = ['Purchase', 'Income'];
    const isSupportedType = supportedTypes.includes(tranCode);

    const identified = !!(isSupportedStatus && isSupportedType);

    if (!identified) {
      return { identified: false, sourceRecord };
    }

    const normalized: NormalizedRecord = {
      transactionId: String(data.tranId),
      account: data.account,
      status: status,
      date: timeData.event_date,
      type: tranCode,
      amount: data.sum,
      currency: data.currency,
      description: data.title,
      mcc: data.mcc
    };

    return {
      identified: true,
      sourceRecord,
      normalized,
      hmbee: {
        category: mapTochkaCategory(normalized.description, normalized.mcc)
      }
    };
  } catch (error) {
    return {
      identified: false,
      identificationError: error instanceof Error ? error.message : String(error),
      sourceRecord
    };
  }
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
