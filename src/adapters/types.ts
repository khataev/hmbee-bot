export interface SyncOptions {
  from: string;
  to: string;
}

export interface SyncResult {
  source: string;
  records: unknown[];
  raw?: unknown;
}

export interface SourceAdapter {
  name: string;
  sync(options: SyncOptions): Promise<SyncResult>;
}
