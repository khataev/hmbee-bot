export interface NormalizedRecord {
  transactionId: string;
  account: string;
  status: string;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency: string;
  description: string;
  mcc?: string | undefined;
  counterpartyAccountId?: string | undefined;
}

export type MatchStatus =
  | 'matched-exact'
  | 'matched-tolerance'
  | 'no-candidate'
  | 'out-of-tolerance'
  | 'ambiguous'
  | 'beaten-match';

export interface PlanMatch {
  status: MatchStatus;
  lostPlanId?: number;
  beatenById?: string;
}

export interface HoneyMoneyIncomeExpenseTransaction {
  subtype: 'e' | 'i';
  date: string;
  account_id: number;
  currency: string;
  id: null;
  type: 'unplanned';
  virtual_id: -1;
  category: string | null;
  description: string;
  planned_repeat_days: 0;
  planned_repeat_end: 'always';
  planned_repeat_end_date: null;
  transfer_to_amount: null;
  transfer_type: 'a';
  real_amount: number;
  plan_amount: null;
  common_id: null;
  transfer_to_currency: null;
}

export interface HoneyMoneyTransferTransaction {
  subtype: 't';
  date: string;
  account_id: number;
  currency: string;
  id: null;
  type: 'unplanned';
  virtual_id: -1;
  category: null;
  description: string;
  planned_repeat_days: 0;
  planned_repeat_end: 'always';
  planned_repeat_end_date: null;
  transfer_to_amount: number;
  transfer_type: 'a';
  real_amount: number;
  plan_amount: null;
  common_id: null;
  transfer_to_currency: null;
  transfer_from_id: number;
  transfer_to_id: number;
}

export interface HoneyMoneyConfirmIncomeExpenseTransaction {
  subtype: 'e' | 'i';
  date: string;
  account_id: number;
  currency: string;
  id: number;
  type: 'planned';
  virtual_id: number | null;
  category: string | null;
  description: string;
  planned_repeat_days: number;
  planned_repeat_end: string;
  planned_repeat_end_date: string | null;
  transfer_to_amount: null;
  transfer_type: 'a';
  real_amount: number;
  plan_amount: number;
  common_id: string | null;
  transfer_to_currency: null;
}

export interface HoneyMoneyConfirmTransferTransaction {
  subtype: 't';
  date: string;
  account_id: number;
  currency: string;
  id: number;
  type: 'planned';
  virtual_id: number | null;
  category: null;
  description: string;
  planned_repeat_days: number;
  planned_repeat_end: string;
  planned_repeat_end_date: string | null;
  transfer_to_amount: number;
  transfer_type: 'a';
  real_amount: number;
  plan_amount: number;
  common_id: string | null;
  transfer_to_currency: null;
  transfer_from_id: number;
  transfer_to_id: number;
}

export type HoneyMoneyTransaction =
  | HoneyMoneyIncomeExpenseTransaction
  | HoneyMoneyTransferTransaction
  | HoneyMoneyConfirmIncomeExpenseTransaction
  | HoneyMoneyConfirmTransferTransaction;

export interface PreviewRecord {
  identified: boolean;
  save: boolean;
  reason: string | null;
  sourceRecord: unknown;
  normalized?: NormalizedRecord;
  hmbee?: HoneyMoneyTransaction;
  planMatch?: PlanMatch;
}
