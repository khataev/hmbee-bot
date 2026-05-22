import { evaluateRule } from 'src/apply/preview/ruleEngine.js';
import type { HoneyMoneyTransaction, NormalizedRecord, PreviewRecord } from 'src/apply/preview/types.js';
import type { TypeCodeConditionsConfig, TypeCodeRule } from 'src/config.js';

export interface TochkaNormalizationOptions {
  accountMappings: Record<string, number>;
  typeCodeRules: Record<string, TypeCodeRule>;
}

interface TochkaRecordMeta<TTypeCode extends string> {
  meta_data: {
    system_data: {
      type_code: TTypeCode;
    };
    time_data: {
      event_date: string;
    };
  };
}

interface CardTransactionData {
  tranId: string | number;
  account: string;
  status: string;
  tranCode: string;
  sum: number;
  currency: string;
  title: string;
  mcc: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface CardTransactionInfoRecord extends TochkaRecordMeta<'CardTransactionInfo'> {
  data: CardTransactionData;
}

interface SbpBaseTransactionData {
  transactionId: string;
  status: string;
  sum: number;
  title: string;
  incoming: boolean;
  payerAccountId: string;
  payeeAccountId: string;
  operationId: string;
  date: string;
  formattedTitle: string;
  sourceName: string;
  payerBankBic: string;
  payerBankName: string;
  payerName: string;
  payeeBankBic: string;
  payeeBankName: string;
  currency: string;
  sumCurrency: string;
  [key: string]: string | number | boolean | null | undefined;
}

interface SbpB2CPaymentData extends SbpBaseTransactionData {
  payeeName: string;
  phoneNumber: string;
}

interface SbpC2BPaymentData extends SbpBaseTransactionData {
  purpose: string;
}

interface SbpC2BRefundData extends SbpBaseTransactionData {
  payeeName: string;
  refOperationId: string;
}

export interface SbpB2CPaymentRecord extends TochkaRecordMeta<'SbpB2CPayment'> {
  data: SbpB2CPaymentData;
}

export interface SbpC2BPaymentRecord extends TochkaRecordMeta<'SbpC2BPayment'> {
  data: SbpC2BPaymentData;
}

export interface SbpC2BRefundRecord extends TochkaRecordMeta<'SbpC2BRefund'> {
  data: SbpC2BRefundData;
}

export type SbpTransactionRecord = SbpB2CPaymentRecord | SbpC2BPaymentRecord | SbpC2BRefundRecord;

export interface PaymentWrittenOffData {
  corebankingId: string;
  payerAccountId: string;
  objectState: string;
  sum: number;
  currency: string;
  title: string;
  incoming: boolean;
  failed: boolean;
  isComission: boolean;
  categoryTypeName: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface PaymentWrittenOffRecord extends TochkaRecordMeta<'PaymentWrittenOff'> {
  data: PaymentWrittenOffData;
}

export interface VedPaymentIncomeData {
  incomeId: string | number;
  recipientAccountId: string;
  state: string;
  sum: number;
  currency: string;
  title: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface VedPaymentIncomeRecord extends TochkaRecordMeta<'VedPaymentIncome'> {
  data: VedPaymentIncomeData;
}

// TODO(HMB-13): Add dedicated families for remaining known type_code groups
// - RS family: PaymentIncome | PaymentAccepted | PaymentWrittenOff
// - VED family: VedPaymentIncome
// - Any additional validated groups discovered in fixtures/sync data
export interface UnsupportedTochkaRecord extends TochkaRecordMeta<string> {
  data: unknown;
}

export type TochkaSyncRecord =
  | CardTransactionInfoRecord
  | SbpTransactionRecord
  | PaymentWrittenOffRecord
  | VedPaymentIncomeRecord
  | UnsupportedTochkaRecord;

type SbpTypeCode = 'SbpB2CPayment' | 'SbpC2BPayment' | 'SbpC2BRefund';
type SupportedTochkaTypeCode = 'CardTransactionInfo' | SbpTypeCode | 'PaymentWrittenOff' | 'VedPaymentIncome';

function isSupportedTochkaTypeCode(typeCode: string): typeCode is SupportedTochkaTypeCode {
  return (
    typeCode === 'CardTransactionInfo' ||
    typeCode === 'SbpB2CPayment' ||
    typeCode === 'SbpC2BPayment' ||
    typeCode === 'SbpC2BRefund' ||
    typeCode === 'PaymentWrittenOff' ||
    typeCode === 'VedPaymentIncome'
  );
}

function isCardTransactionInfoRecord(record: TochkaSyncRecord): record is CardTransactionInfoRecord {
  return record.meta_data.system_data.type_code === 'CardTransactionInfo';
}

function isSbpTransactionRecord(record: TochkaSyncRecord): record is SbpTransactionRecord {
  const typeCode = record.meta_data.system_data.type_code;
  return typeCode === 'SbpB2CPayment' || typeCode === 'SbpC2BPayment' || typeCode === 'SbpC2BRefund';
}

function isPaymentWrittenOffRecord(record: TochkaSyncRecord): record is PaymentWrittenOffRecord {
  return record.meta_data.system_data.type_code === 'PaymentWrittenOff';
}

function isVedPaymentIncomeRecord(record: TochkaSyncRecord): record is VedPaymentIncomeRecord {
  return record.meta_data.system_data.type_code === 'VedPaymentIncome';
}

function getTransactionId(record: TochkaSyncRecord): string | number | undefined {
  if (isCardTransactionInfoRecord(record)) {
    return record.data.tranId;
  }

  if (isSbpTransactionRecord(record)) {
    return record.data.transactionId;
  }

  if (isPaymentWrittenOffRecord(record)) {
    return record.data.corebankingId;
  }

  if (isVedPaymentIncomeRecord(record)) {
    return record.data.incomeId;
  }

  return undefined;
}

function getSourceAccount(record: TochkaSyncRecord): string | undefined {
  if (isCardTransactionInfoRecord(record)) {
    return record.data.account;
  }

  if (isSbpTransactionRecord(record)) {
    return record.data.incoming ? record.data.payeeAccountId : record.data.payerAccountId;
  }

  if (isPaymentWrittenOffRecord(record)) {
    return record.data.payerAccountId;
  }

  if (isVedPaymentIncomeRecord(record)) {
    return record.data.recipientAccountId;
  }

  return undefined;
}

function getSourceCurrency(record: TochkaSyncRecord): string | undefined {
  if (isCardTransactionInfoRecord(record)) {
    return record.data.currency;
  }

  if (isSbpTransactionRecord(record) || isPaymentWrittenOffRecord(record) || isVedPaymentIncomeRecord(record)) {
    return record.data.currency;
  }

  return undefined;
}

function getMcc(record: TochkaSyncRecord): string | undefined {
  if (isCardTransactionInfoRecord(record)) {
    return record.data.mcc;
  }

  // SBP, RS, and Arrival families do not provide MCC; category resolution falls back to title/description matching.
  return undefined;
}

function getStatus(record: TochkaSyncRecord): string | undefined {
  if (isCardTransactionInfoRecord(record) || isSbpTransactionRecord(record)) {
    return record.data.status;
  }

  if (isPaymentWrittenOffRecord(record)) {
    return record.data.objectState;
  }

  if (isVedPaymentIncomeRecord(record)) {
    return record.data.state;
  }

  return undefined;
}

function getAmount(record: TochkaSyncRecord): number | undefined {
  if (
    isCardTransactionInfoRecord(record) ||
    isSbpTransactionRecord(record) ||
    isPaymentWrittenOffRecord(record) ||
    isVedPaymentIncomeRecord(record)
  ) {
    return record.data.sum;
  }

  return undefined;
}

function getDescription(record: TochkaSyncRecord): string | undefined {
  if (
    isCardTransactionInfoRecord(record) ||
    isSbpTransactionRecord(record) ||
    isPaymentWrittenOffRecord(record) ||
    isVedPaymentIncomeRecord(record)
  ) {
    return record.data.title;
  }

  return undefined;
}

function getNormalizedType(record: TochkaSyncRecord): string {
  if (isCardTransactionInfoRecord(record)) {
    return record.data.tranCode;
  }

  if (isSbpTransactionRecord(record)) {
    return record.data.incoming ? 'Income' : 'Expense';
  }

  if (isPaymentWrittenOffRecord(record)) {
    return 'Expense';
  }

  if (isVedPaymentIncomeRecord(record)) {
    return 'Income';
  }

  throw new Error('Unsupported record shape for normalized type derivation');
}

function classifyByRule(
  record: TochkaSyncRecord,
  accountMappings: Record<string, number>,
  rules: TypeCodeConditionsConfig
): {
  identified: boolean;
  save: boolean;
  reason: string | null;
} {
  const context = {
    record,
    accountRegistry: Object.keys(accountMappings)
  };
  const hasIncludedMatch = evaluateRule(rules.included, context);
  const hasExcludedMatch = evaluateRule(rules.excluded, context);

  if (hasIncludedMatch && hasExcludedMatch) {
    return {
      identified: false,
      save: false,
      reason: 'included/excluded ambiguity'
    };
  }

  if (hasIncludedMatch) {
    return {
      identified: true,
      save: true,
      reason: null
    };
  }

  if (hasExcludedMatch) {
    return {
      identified: true,
      save: false,
      reason: 'excluded'
    };
  }

  return {
    identified: false,
    save: false,
    reason: 'no matching included/excluded condition'
  };
}

/**
 * Normalizes a Tochka sync record into the internal preview representation.
 * Only supports income/expense flow with specific statuses.
 */
export function normalizeTochkaRecord(
  sourceRecord: TochkaSyncRecord,
  options: TochkaNormalizationOptions
): PreviewRecord {
  try {
    const typeCode = sourceRecord.meta_data.system_data.type_code;

    if (!isSupportedTochkaTypeCode(typeCode)) {
      return {
        identified: false,
        save: false,
        reason: `unsupported type_code: ${typeCode}`,
        sourceRecord
      };
    }

    const typeRules = options.typeCodeRules[typeCode];

    if (!typeRules) {
      return {
        identified: false,
        save: false,
        reason: `unsupported type_code: ${typeCode}`,
        sourceRecord
      };
    }

    const timeData = sourceRecord.meta_data.time_data;
    const status = getStatus(sourceRecord);
    const amount = getAmount(sourceRecord);
    const description = getDescription(sourceRecord);
    const transactionId = getTransactionId(sourceRecord);
    const sourceAccount = getSourceAccount(sourceRecord);
    const sourceCurrency = getSourceCurrency(sourceRecord);

    if (transactionId === undefined) {
      throw new Error('Missing source transaction id field (tranId or transactionId)');
    }

    if (!sourceAccount) {
      throw new Error('Missing source account field (account or payer/payee account id)');
    }

    if (!sourceCurrency) {
      throw new Error('Missing source currency field (currency or sumCurrency)');
    }

    if (!status) {
      throw new Error('Missing source status field');
    }

    if (amount === undefined) {
      throw new Error('Missing source amount field');
    }

    if (!description) {
      throw new Error('Missing source title field');
    }

    const classification = classifyByRule(sourceRecord, options.accountMappings, typeRules.conditions);

    if (!classification.identified || !classification.save) {
      return {
        identified: classification.identified,
        save: classification.save,
        reason: classification.reason,
        sourceRecord
      };
    }

    const normalized: NormalizedRecord = {
      transactionId: String(transactionId),
      account: sourceAccount,
      status,
      date: timeData.event_date,
      type: getNormalizedType(sourceRecord),
      amount,
      currency: sourceCurrency,
      description,
      mcc: getMcc(sourceRecord)
    };

    const tochkaAccountId = options.accountMappings[normalized.account];

    if (!tochkaAccountId)
      throw new Error(`No Honey Money account mapping found for Tochka account ${normalized.account}`);

    return {
      identified: true,
      save: true,
      reason: null,
      sourceRecord,
      normalized,
      hmbee: buildHoneyMoneyTransaction(normalized, tochkaAccountId)
    };
  } catch (error) {
    return {
      identified: false,
      save: false,
      reason: error instanceof Error ? error.message : String(error),
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
