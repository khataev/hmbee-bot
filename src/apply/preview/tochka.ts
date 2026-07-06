import { evaluateRule } from 'src/apply/preview/ruleEngine.js';
import type { HoneyMoneyTransaction, NormalizedRecord, PreviewRecord } from 'src/apply/preview/types.js';
import type { AccountRegistry, CategoryMapping, MappingEntry, TypeCodeRule } from 'src/config.js';

function toDateInTimezone(isoString: string, tz: string): string {
  const date = new Date(isoString);
  // trick to get the datetime in the specified timezone without using any external libraries. Will be refactored to Temporal after upgrade to node 26
  const localDt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
  const tzName =
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const offset = tzName === 'GMT' ? '+00:00' : tzName.slice(3);
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${localDt.replace(' ', 'T')}.${ms}${offset}`;
}

const MISSING_CATEGORY_REASON = 'Category is missing for income or expense transaction';

export interface TochkaNormalizationOptions {
  accountMappings: Record<string, number>;
  typeCodeRules: Record<string, TypeCodeRule>;
  accountRegistry: AccountRegistry;
  categoryMapping: CategoryMapping;
  timeZone: string;
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

export interface SbpC2CPaymentRecord extends TochkaRecordMeta<'SbpC2CPayment'> {
  data: SbpBaseTransactionData;
}

export type SbpTransactionRecord = SbpB2CPaymentRecord | SbpC2BPaymentRecord | SbpC2BRefundRecord | SbpC2CPaymentRecord;

export interface PaymentWrittenOffData {
  corebankingId: string;
  payerAccountId: string;
  payerBankBic: string;
  payeeAccountId: string;
  payeeBankBic: string;
  objectState: string;
  sum: number;
  currency: string;
  title: string;
  incoming: boolean;
  failed: boolean;
  isComission: boolean;
  categoryTypeName: string;
}

export interface PaymentWrittenOffRecord extends TochkaRecordMeta<'PaymentWrittenOff'> {
  data: PaymentWrittenOffData;
}

export interface PaymentIncomeData {
  corebankingId: string;
  payerAccountId: string;
  payeeAccountId: string;
  objectState: string;
  sum: number;
  currency: string;
  title: string;
  incoming: boolean;
  failed: boolean;
  isComission: boolean;
  payerBankBic: string;
  payeeBankBic: string;
}

export interface PaymentIncomeRecord extends TochkaRecordMeta<'PaymentIncome'> {
  data: PaymentIncomeData;
}

export interface PaymentAcceptedData {
  corebankingId: string;
  payerAccountId: string;
  payeeAccountId: string;
  objectState: string;
  sum: number;
  currency: string;
  title: string;
  incoming: boolean;
  failed: boolean;
  isComission: boolean;
  isGovernment?: boolean;
  payerBankBic: string;
  payeeBankBic: string;
}

export interface PaymentAcceptedRecord extends TochkaRecordMeta<'PaymentAccepted'> {
  data: PaymentAcceptedData;
}

export interface VedPaymentIncomeData {
  incomeId: string | number;
  recipientAccountId: string;
  state: string;
  sum: number;
  currency: string;
  title: string;
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
  | PaymentIncomeRecord
  | PaymentAcceptedRecord
  | VedPaymentIncomeRecord
  | UnsupportedTochkaRecord;

type SbpTypeCode = 'SbpB2CPayment' | 'SbpC2BPayment' | 'SbpC2BRefund' | 'SbpC2CPayment';
type SupportedTochkaTypeCode =
  | 'CardTransactionInfo'
  | SbpTypeCode
  | 'PaymentWrittenOff'
  | 'PaymentIncome'
  | 'PaymentAccepted'
  | 'VedPaymentIncome';

function isSupportedTochkaTypeCode(typeCode: string): typeCode is SupportedTochkaTypeCode {
  return (
    typeCode === 'CardTransactionInfo' ||
    typeCode === 'SbpB2CPayment' ||
    typeCode === 'SbpC2BPayment' ||
    typeCode === 'SbpC2BRefund' ||
    typeCode === 'SbpC2CPayment' ||
    typeCode === 'PaymentWrittenOff' ||
    typeCode === 'PaymentIncome' ||
    typeCode === 'PaymentAccepted' ||
    typeCode === 'VedPaymentIncome'
  );
}

function isCardTransactionInfoRecord(record: TochkaSyncRecord): record is CardTransactionInfoRecord {
  return record.meta_data.system_data.type_code === 'CardTransactionInfo';
}

function isSbpTransactionRecord(record: TochkaSyncRecord): record is SbpTransactionRecord {
  const typeCode = record.meta_data.system_data.type_code;
  return (
    typeCode === 'SbpB2CPayment' ||
    typeCode === 'SbpC2BPayment' ||
    typeCode === 'SbpC2BRefund' ||
    typeCode === 'SbpC2CPayment'
  );
}

function isPaymentWrittenOffRecord(record: TochkaSyncRecord): record is PaymentWrittenOffRecord {
  return record.meta_data.system_data.type_code === 'PaymentWrittenOff';
}

function isPaymentIncomeRecord(record: TochkaSyncRecord): record is PaymentIncomeRecord {
  return record.meta_data.system_data.type_code === 'PaymentIncome';
}

function isPaymentAcceptedRecord(record: TochkaSyncRecord): record is PaymentAcceptedRecord {
  return record.meta_data.system_data.type_code === 'PaymentAccepted';
}

function isVedPaymentIncomeRecord(record: TochkaSyncRecord): record is VedPaymentIncomeRecord {
  return record.meta_data.system_data.type_code === 'VedPaymentIncome';
}

type BankPaymentRecord = SbpTransactionRecord | PaymentWrittenOffRecord | PaymentIncomeRecord | PaymentAcceptedRecord;

function isBankPaymentRecord(record: TochkaSyncRecord): record is BankPaymentRecord {
  return (
    isSbpTransactionRecord(record) ||
    isPaymentWrittenOffRecord(record) ||
    isPaymentIncomeRecord(record) ||
    isPaymentAcceptedRecord(record)
  );
}

function getTransactionId(record: TochkaSyncRecord): string | number | undefined {
  if (isCardTransactionInfoRecord(record)) {
    return record.data.tranId;
  }

  if (isSbpTransactionRecord(record)) {
    return record.data.transactionId;
  }

  if (isPaymentWrittenOffRecord(record) || isPaymentIncomeRecord(record) || isPaymentAcceptedRecord(record)) {
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

  if (isPaymentIncomeRecord(record)) {
    return record.data.payeeAccountId;
  }

  if (isPaymentAcceptedRecord(record)) {
    return record.data.payerAccountId;
  }

  if (isVedPaymentIncomeRecord(record)) {
    return record.data.recipientAccountId;
  }

  return undefined;
}

function getCounterpartyAccount(record: TochkaSyncRecord): string | undefined {
  if (isSbpTransactionRecord(record)) {
    return record.data.incoming ? record.data.payerAccountId : record.data.payeeAccountId;
  }

  if (isPaymentIncomeRecord(record) || isPaymentAcceptedRecord(record) || isPaymentWrittenOffRecord(record)) {
    return record.data.incoming ? record.data.payerAccountId : record.data.payeeAccountId;
  }

  return undefined;
}

function getSourceCurrency(record: TochkaSyncRecord): string | undefined {
  if (isCardTransactionInfoRecord(record)) {
    return record.data.currency;
  }

  if (
    isSbpTransactionRecord(record) ||
    isPaymentWrittenOffRecord(record) ||
    isPaymentIncomeRecord(record) ||
    isPaymentAcceptedRecord(record) ||
    isVedPaymentIncomeRecord(record)
  ) {
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

  if (isPaymentWrittenOffRecord(record) || isPaymentIncomeRecord(record) || isPaymentAcceptedRecord(record)) {
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
    isPaymentIncomeRecord(record) ||
    isPaymentAcceptedRecord(record) ||
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
    isPaymentIncomeRecord(record) ||
    isPaymentAcceptedRecord(record) ||
    isVedPaymentIncomeRecord(record)
  ) {
    return record.data.title;
  }

  return undefined;
}

function getNormalizedType(
  sourceRecord: TochkaSyncRecord,
  registry: AccountRegistry
): 'income' | 'expense' | 'transfer' {
  if (isCardTransactionInfoRecord(sourceRecord)) {
    return sourceRecord.data.tranCode === 'ReverseByCard' ? 'income' : 'expense';
  }

  // By transfer we mean transaction between two accounts that belong to me and are registered as such in honey money.
  const isTransferMatched =
    isBankPaymentRecord(sourceRecord) &&
    registry.isOwned(sourceRecord.data.payerAccountId, sourceRecord.data.payerBankBic) &&
    registry.isOwned(sourceRecord.data.payeeAccountId, sourceRecord.data.payeeBankBic);

  if (isTransferMatched) {
    return 'transfer';
  }

  if (isSbpTransactionRecord(sourceRecord)) {
    return sourceRecord.data.incoming ? 'income' : 'expense';
  }

  if (isPaymentWrittenOffRecord(sourceRecord)) {
    return 'expense';
  }

  if (isPaymentIncomeRecord(sourceRecord)) {
    return 'income';
  }

  if (isPaymentAcceptedRecord(sourceRecord)) {
    return 'expense';
  }

  if (isVedPaymentIncomeRecord(sourceRecord)) {
    return 'income';
  }

  throw new Error('Unsupported record shape for normalized type derivation');
}

function classifyByRule(
  record: TochkaSyncRecord,
  options: TochkaNormalizationOptions
): {
  identified: boolean;
  save: boolean;
  reason: string | null;
} {
  const typeCode = record.meta_data.system_data.type_code;
  const rules = options.typeCodeRules[typeCode]?.conditions;
  if (!rules) {
    return { identified: false, save: false, reason: `no rules for type_code: ${typeCode}` };
  }

  const context = {
    record,
    accountRegistry: options.accountRegistry
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

    const classification = classifyByRule(sourceRecord, options);

    if (!classification.identified) {
      return {
        identified: false,
        save: false,
        reason: classification.reason,
        sourceRecord
      };
    }

    const normalizedType = getNormalizedType(sourceRecord, options.accountRegistry);
    const counterpartyAccount = getCounterpartyAccount(sourceRecord);

    const normalized: NormalizedRecord = {
      transactionId: String(transactionId),
      account: sourceAccount,
      status,
      date: toDateInTimezone(timeData.event_date, options.timeZone),
      type: normalizedType,
      amount,
      currency: sourceCurrency,
      description,
      mcc: getMcc(sourceRecord),
      counterpartyAccountId: counterpartyAccount
    };

    if (normalized.type === 'transfer' && !normalized.counterpartyAccountId) {
      throw new Error('Normalized transfer record missing counterpartyAccountId');
    }

    if (normalized.type === 'transfer') {
      if (!isBankPaymentRecord(sourceRecord)) {
        throw new Error('Transfer must be a bank payment record');
      }

      const payerHmId = options.accountRegistry.getHmAccountId(sourceRecord.data.payerAccountId);
      const payeeHmId = options.accountRegistry.getHmAccountId(sourceRecord.data.payeeAccountId);

      if (!payerHmId) {
        throw new Error(`Unable to resolve payer HM account ID for transfer`);
      }

      if (!payeeHmId) {
        throw new Error(`Unable to resolve payee HM account ID for transfer`);
      }

      return {
        identified: true,
        save: classification.save,
        reason: classification.reason,
        sourceRecord,
        normalized,
        hmbee: buildHoneyMoneyTransferTransaction(normalized, payerHmId, payeeHmId)
      };
    }

    const tochkaAccountId = options.accountMappings[normalized.account];

    if (!tochkaAccountId)
      throw new Error(`No Honey Money account mapping found for Tochka account ${normalized.account}`);

    const hmbee = buildHoneyMoneyIncomeExpenseTransaction(
      sourceRecord,
      normalized,
      tochkaAccountId,
      options.categoryMapping,
      options.accountRegistry
    );

    if (classification.save && hmbee.category === null) {
      return {
        identified: true,
        save: false,
        reason: MISSING_CATEGORY_REASON,
        sourceRecord,
        normalized,
        hmbee
      };
    }

    return {
      identified: true,
      save: classification.save,
      reason: classification.reason,
      sourceRecord,
      normalized,
      hmbee
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

function buildHoneyMoneyIncomeExpenseTransaction(
  sourceRecord: TochkaSyncRecord,
  normalized: NormalizedRecord,
  accountId: number,
  categoryMapping: CategoryMapping,
  accountRegistry: AccountRegistry
): HoneyMoneyTransaction {
  const entry = mapTochkaCategory(
    sourceRecord,
    normalized.description,
    normalized.mcc,
    categoryMapping,
    accountRegistry
  );
  const subtype = normalized.type === 'income' ? 'i' : 'e';
  const normalizedAmount = normalizeHoneyMoneyAmount(normalized.amount, subtype);
  const absAmount = Math.abs(normalizedAmount);
  const description = entry?.description ? `${absAmount} ${entry.description}` : String(absAmount);

  return {
    subtype,
    date: normalized.date.slice(0, 10),
    account_id: accountId,
    currency: normalized.currency.toLowerCase(),
    id: null,
    type: 'unplanned',
    virtual_id: -1,
    category: entry ? entry.category : null,
    description,
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

function buildHoneyMoneyTransferTransaction(
  normalized: NormalizedRecord,
  payerHmId: number,
  payeeHmId: number
): HoneyMoneyTransaction {
  const realAmount = Math.round(Math.abs(normalized.amount));

  return {
    subtype: 't',
    date: normalized.date.slice(0, 10),
    account_id: payerHmId,
    currency: normalized.currency.toLowerCase(),
    id: null,
    type: 'unplanned',
    virtual_id: -1,
    category: null,
    description: String(realAmount),
    planned_repeat_days: 0,
    planned_repeat_end: 'always',
    planned_repeat_end_date: null,
    transfer_to_amount: realAmount,
    transfer_type: 'a',
    real_amount: realAmount,
    plan_amount: null,
    common_id: null,
    transfer_to_currency: null,
    transfer_from_id: payerHmId,
    transfer_to_id: payeeHmId
  };
}

export function normalizeHoneyMoneyAmount(amount: number, subtype: 'e' | 'i'): number {
  const normalizedAmount = Math.round(Math.abs(amount));
  return subtype === 'e' ? -normalizedAmount : normalizedAmount;
}

function mapTochkaCategory(
  sourceRecord: TochkaSyncRecord,
  description: string,
  mcc: string | undefined,
  categoryMapping: CategoryMapping,
  accountRegistry: AccountRegistry
): MappingEntry | null {
  for (const rule of categoryMapping.rules) {
    if (evaluateRule(rule.when, { record: sourceRecord, accountRegistry })) {
      return { category: rule.category, description: rule.description };
    }
  }

  for (const { pattern, entry } of categoryMapping.title) {
    if (pattern.test(description)) {
      return entry;
    }
  }

  if (mcc && categoryMapping.mcc[mcc]) {
    return categoryMapping.mcc[mcc];
  }

  return null;
}
