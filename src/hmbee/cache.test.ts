import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PreviewRecord } from 'src/apply/preview/types.js';
import { CACHE_PATH, type HoneyMoneyFetcher, refreshCache, trimEntries } from 'src/hmbee/cache.js';
import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';
import { applySkipPass, buildMatchIndex, loadCache } from 'src/hmbee/skipIndex.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeEntry(id: number, date: string, overrides: Partial<HoneyMoneyCacheEntry> = {}): HoneyMoneyCacheEntry {
  return {
    id,
    type: 'unplanned',
    subtype: 'e',
    real_amount: -100,
    currency: 'rub',
    description: 'test',
    date,
    category: 'Тест',
    account_id: 5695,
    ...overrides
  };
}

describe('trimEntries', () => {
  it('keeps records on or after from − 10 days (inclusive boundary)', () => {
    // from = 2026-05-01, boundary = 2026-04-21
    const entries = [
      makeEntry(1, '2026-04-20'), // before boundary → excluded
      makeEntry(2, '2026-04-21'), // exactly boundary → included
      makeEntry(3, '2026-04-22'), // after boundary → included
      makeEntry(4, '2026-05-01') //  from date → included
    ];

    const result = trimEntries(entries, '2026-05-01');

    expect(result.map((e) => e.id)).toEqual([2, 3, 4]);
  });
});

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hmbee-cache-test-'));
  originalCwd = process.cwd();
  process.chdir(tempDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('refreshCache', () => {
  it('fetches, trims against from, and overwrites the cache file', async () => {
    const client: HoneyMoneyFetcher = {
      getAllTransactions: vi
        .fn()
        .mockResolvedValue([makeEntry(1, '2026-04-20'), makeEntry(2, '2026-05-01')] satisfies HoneyMoneyCacheEntry[])
    };

    await refreshCache(client, '2026-05-01');

    const written = JSON.parse(fs.readFileSync(path.join(tempDir, CACHE_PATH), 'utf8'));
    expect(written.map((e: HoneyMoneyCacheEntry) => e.id)).toEqual([2]);
  });

  it('leaves any existing cache file untouched when the fetch fails', async () => {
    fs.mkdirSync(path.dirname(path.join(tempDir, CACHE_PATH)), { recursive: true });
    fs.writeFileSync(path.join(tempDir, CACHE_PATH), JSON.stringify([makeEntry(1, '2026-05-01')]));

    const client: HoneyMoneyFetcher = { getAllTransactions: vi.fn().mockRejectedValue(new Error('network down')) };

    await expect(refreshCache(client, '2026-05-01')).rejects.toThrow('network down');

    const untouched = JSON.parse(fs.readFileSync(path.join(tempDir, CACHE_PATH), 'utf8'));
    expect(untouched.map((e: HoneyMoneyCacheEntry) => e.id)).toEqual([1]);
  });
});

describe('refreshCache prevents duplicate sends on a repeated apply', () => {
  function makeRecord(): PreviewRecord {
    return {
      identified: true,
      save: true,
      reason: null,
      sourceRecord: {},
      hmbee: {
        subtype: 'e',
        date: '2026-05-01',
        account_id: 5695,
        currency: 'rub',
        id: null,
        type: 'unplanned',
        virtual_id: -1,
        category: 'Тест',
        description: 'test',
        planned_repeat_days: 0,
        planned_repeat_end: 'always',
        planned_repeat_end_date: null,
        transfer_to_amount: null,
        transfer_type: 'a',
        real_amount: -100,
        plan_amount: null,
        common_id: null,
        transfer_to_currency: null
      }
    };
  }

  it('a record sent on the first apply is skipped on the second, once the cache is refreshed', async () => {
    // First apply: Honey Money has nothing yet for this record → it is selected for send.
    const firstFetch: HoneyMoneyFetcher = { getAllTransactions: vi.fn().mockResolvedValue([]) };
    await refreshCache(firstFetch, '2026-05-01');

    const firstPass = applySkipPass([makeRecord()], buildMatchIndex(loadCache()));
    expect(firstPass[0]?.save).toBe(true);

    // Between the two applies, Honey Money now reflects the transaction created by the first run.
    const secondFetch: HoneyMoneyFetcher = {
      getAllTransactions: vi.fn().mockResolvedValue([makeEntry(101, '2026-05-01')])
    };
    await refreshCache(secondFetch, '2026-05-01');

    const secondPass = applySkipPass([makeRecord()], buildMatchIndex(loadCache()));
    expect(secondPass[0]?.save).toBe(false);
    expect(secondPass[0]?.reason).toBe('Внесена вручную');
  });
});
