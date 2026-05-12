export interface NormalizedRecord {
  transactionId: string;
  account: string;
  status: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  mcc?: string | undefined;
}

export interface HoneyMoneyTransaction {
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

export interface PreviewRecord {
  identified: boolean;
  identificationError?: string;
  sourceRecord: unknown;
  normalized?: NormalizedRecord;
  hmbee?: HoneyMoneyTransaction;
}
