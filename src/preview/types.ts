export interface NormalizedRecord {
  identified: boolean;
  transactionId: string;
  account: string;
  status: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
}

export interface PreviewRecord {
  normalized: NormalizedRecord;
  hmbee: {
    category?: string | null;
  };
}
