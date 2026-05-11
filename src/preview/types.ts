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

export interface PreviewRecord {
  identified: boolean;
  identificationError?: string;
  sourceRecord: unknown;
  normalized?: NormalizedRecord;
  hmbee?: {
    category: string | null;
  };
}
