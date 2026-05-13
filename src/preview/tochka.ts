import type { HoneyMoneyTransaction, NormalizedRecord, PreviewRecord } from './types.js';

export interface TochkaNormalizationOptions {
  accountMappings: Record<string, number>;
}

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

const SUPPORTED_STATUSES = ['Withdraw', 'InProgress'];
const SUPPORTED_TYPES = ['Purchase', 'Income'];

/**
 * Normalizes a Tochka sync record into the internal preview representation.
 * Only supports income/expense flow with specific statuses.
 */
export function normalizeTochkaRecord(
  sourceRecord: TochkaSyncRecord,
  options: TochkaNormalizationOptions
): PreviewRecord {
  try {
    const data = sourceRecord.data;
    const timeData = sourceRecord.meta_data.time_data;

    // Supported statuses for identification
    const status = data.status;
    const isSupportedStatus = SUPPORTED_STATUSES.includes(status);

    // Supported types for income/expense flow
    const tranCode = data.tranCode;
    const isSupportedType = SUPPORTED_TYPES.includes(tranCode);

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

    const tochkaAccountId = options.accountMappings[normalized.account];

    if (!tochkaAccountId)
      throw new Error(`No Honey Money account mapping found for Tochka account ${normalized.account}`);

    return {
      identified: true,
      sourceRecord,
      normalized,
      hmbee: buildHoneyMoneyTransaction(normalized, tochkaAccountId)
    };
  } catch (error) {
    return {
      identified: false,
      identificationError: error instanceof Error ? error.message : String(error),
      sourceRecord
    };
  }
}

function buildHoneyMoneyTransaction(normalized: NormalizedRecord, accountId: number): HoneyMoneyTransaction {
  const category = mapTochkaCategory(normalized.description, normalized.mcc);
  const subtype = normalized.type === 'Income' ? 'i' : 'e';
  const normalizedAmount = normalizeHoneyMoneyAmount(normalized.amount, subtype);

  return {
    subtype,
    date: normalized.date.slice(0, 10),
    account_id: accountId,
    currency: normalized.currency.toLowerCase(),
    id: null,
    type: 'unplanned',
    virtual_id: -1,
    category,
    description: String(Math.abs(normalizedAmount)),
    planned_repeat_days: 0,
    planned_repeat_end: 'always',
    planned_repeat_end_date: null,
    transfer_to_amount: null,
    transfer_type: 'a',
    real_amount: normalizedAmount,
    plan_amount: null,
    common_id: null,
    transfer_to_currency: null
  };
}

export function normalizeHoneyMoneyAmount(amount: number, subtype: 'e' | 'i'): number {
  const normalizedAmount = Math.round(Math.abs(amount));
  return subtype === 'e' ? -normalizedAmount : normalizedAmount;
}

const MCC_MAP: Record<string, string> = {
  '5411': 'Покупки / Продукты',
  '5311': 'Покупки / Продукты',
  '5499': 'Покупки / Продукты',
  '5912': 'Покупки / Аптека и БАДы',
  '4111': 'Проезд / Общественный транспорт',
  '5300': 'Покупки / Маркетплейсы',
  '5814': 'Еда вне дома',
  '4131': 'Проезд / Общественный транспорт',
  '4121': 'Проезд / Такси',
  '5812': 'Еда вне дома',
  '4814': 'Счета / Мобильная связь',
  '5945': 'Покупки / Детские товары',
  '8062': 'Услуги / Медицинские услуги',
  '7221': 'Услуги',
  '5999': 'Покупки',
  '8999': 'Услуги',
  '7338': 'Услуги',
  '7996': 'Развлечения',
  '7395': 'Услуги',
  '5942': 'Покупки / Книги и Журналы',
  '5541': 'Автомобиль / Бензин',
  '7542': 'Автомобиль / Мойка',
  '5719': 'Покупки / Хозтовары',
  '8011': 'Услуги / Медицинские услуги',
  '7922': 'Развлечения',
  '7538': 'Автомобиль / Ремонт',
  '5200': 'Покупки / Хозтовары',
  '7349': 'Покупки / Хозтовары',
  '7230': 'Услуги / Парикмахерская',
  '5309': 'Путешествия / Покупки'
};

const TITLE_MAP: [string, string][] = [
  ['PDLDK_AI_CLUB', 'Подписки и донаты'],
  ['WHOOSH', 'Услуги / Аренда самокатов'],
  ['TIMEWEB.CLOUD', 'Услуги / Хостинги и облака'],
  ['GAZPROMBONUS', 'Подписки и донаты'],
  ['LEONARDO', 'Покупки / Детские товары'],
  ['ART-MOSKVA', 'Услуги / Коворкинг'],
  ['YANDEX*5815*PLUS', 'Подписки и донаты / Яндекс Плюс'],
  ['SHINSERVIS', 'Автомобиль / Шиномонтаж']
];

const TITLE_REGEX_MAP: [RegExp, string][] = [[/YANDEX.+PLUS/, 'Подписки и донаты / Яндекс Плюс']];

/**
 * Maps Tochka description or MCC to Honey Money category.
 */
function mapTochkaCategory(description: string, mcc?: string): string | null {
  // 1. Try MCC first
  if (mcc && MCC_MAP[mcc]) {
    return MCC_MAP[mcc];
  }

  // 2. Try complete description match
  const desc = description.toUpperCase();
  for (const [pattern, category] of TITLE_MAP) {
    if (desc.includes(pattern.toUpperCase())) {
      return category;
    }
  }

  // 3. Try regex patterns
  for (const [regex, category] of TITLE_REGEX_MAP) {
    if (regex.test(desc)) {
      return category;
    }
  }

  return null;
}
