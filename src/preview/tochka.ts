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
    description: data.title
  };

  return {
    normalized,
    hmbee: {
      category: mapTochkaCategory(normalized.description)
    }
  };
}

/**
 * Maps Tochka description to Honey Money category.
 */
function mapTochkaCategory(description: string): string | null {
  const desc = description.toUpperCase();
  if (
    desc.includes('PYATEROCHKA') ||
    desc.includes('MAGNIT') ||
    desc.includes('PEREKRESTOK') ||
    desc.includes('VKUSVILL') ||
    desc.includes('MAGAZIN')
  ) {
    return 'Покупки / Продукты';
  }
  if (/YANDEX.+TAXI/.test(desc)) {
    return 'Проезд / Такси';
  }
  if (desc.includes('DUTY FREE')) {
    return 'Путешествия / Покупки';
  }
  if (desc.includes('SHOKO VNUKOVO') || desc.includes('MEALTY')) {
    return 'Еда вне дома';
  }
  if (desc.includes('MSKAPT')) {
    return 'Покупки / Аптека и БАДы';
  }
  if (desc.includes('KLINIKA DOK EPIFANOVA')) {
    return 'Услуги / Медицинские услуги / Андрей';
  }
  if (desc.includes('OZON')) {
    return 'Покупки / Маркетплейсы';
  }
  if (desc.includes('ART-MOSKVA')) {
    return 'Услуги / Коворкинг';
  }
  return null;
}
