import { trimEntries } from 'src/hmbee/cache.js';
import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';
import { describe, expect, it } from 'vitest';

function makeEntry(id: number, date: string): HoneyMoneyCacheEntry {
  return {
    id,
    type: 'unplanned',
    subtype: 'e',
    real_amount: -100,
    currency: 'rub',
    description: 'test',
    date,
    category: 'Тест',
    account_id: 5695
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
