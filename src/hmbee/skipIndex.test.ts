import { buildMatchIndex, consumeMatch } from 'src/hmbee/skipIndex.js';
import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';
import { describe, expect, it } from 'vitest';

function makeEntry(overrides: Partial<HoneyMoneyCacheEntry> & Pick<HoneyMoneyCacheEntry, 'id'>): HoneyMoneyCacheEntry {
  return {
    type: 'unplanned',
    subtype: 'e',
    real_amount: -1000,
    plan_amount: null,
    currency: 'rub',
    description: 'test',
    date: '2026-05-01',
    category: 'Продукты',
    account_id: 2053036,
    ...overrides
  };
}

describe('buildMatchIndex', () => {
  it('excludes entries without real_amount', () => {
    const entries = [makeEntry({ id: 1, real_amount: null }), makeEntry({ id: 2, real_amount: undefined })];
    const index = buildMatchIndex(entries);
    expect(index.size).toBe(0);
  });

  it('excludes entries without account_id', () => {
    const entries = [makeEntry({ id: 1, account_id: undefined })];
    const index = buildMatchIndex(entries);
    expect(index.size).toBe(0);
  });
});

describe('consumeMatch', () => {
  it('matches income by full key', () => {
    const entry = makeEntry({ id: 1, subtype: 'i', real_amount: 5000, category: 'Доходы / Выручка' });
    const index = buildMatchIndex([entry]);

    const match = consumeMatch(index, 2053036, '2026-05-01', 5000, 'i', 'Доходы / Выручка', 'rub');

    expect(match?.id).toBe(1);
  });

  it('matches expense by full key', () => {
    const entry = makeEntry({ id: 2, subtype: 'e', real_amount: -1500, category: 'Продукты' });
    const index = buildMatchIndex([entry]);

    const match = consumeMatch(index, 2053036, '2026-05-01', -1500, 'e', 'Продукты', 'rub');

    expect(match?.id).toBe(2);
  });

  it('matches transfer without category', () => {
    const entry = makeEntry({ id: 3, subtype: 't', real_amount: 10000, category: null });
    const index = buildMatchIndex([entry]);

    // category is irrelevant for transfers — any value yields same key
    const match = consumeMatch(index, 2053036, '2026-05-01', 10000, 't', 'some-ignored-category', 'rub');

    expect(match?.id).toBe(3);
  });

  it('rounds amount before comparison', () => {
    // HM stores -1500, source sends -1500.49 (fractional kopecks)
    const entry = makeEntry({ id: 4, real_amount: -1500 });
    const index = buildMatchIndex([entry]);

    const match = consumeMatch(index, 2053036, '2026-05-01', -1500.49, 'e', 'Продукты', 'rub');

    expect(match?.id).toBe(4);
  });

  it('does not match when key differs (wrong category)', () => {
    const entry = makeEntry({ id: 5, category: 'Продукты' });
    const index = buildMatchIndex([entry]);

    const match = consumeMatch(index, 2053036, '2026-05-01', -1000, 'e', 'Другая', 'rub');

    expect(match).toBeNull();
  });

  it('greedy 1:1: two source records, one cache entry — only first matches', () => {
    const entry = makeEntry({ id: 6, real_amount: -1000 });
    const index = buildMatchIndex([entry]);

    const first = consumeMatch(index, 2053036, '2026-05-01', -1000, 'e', 'Продукты', 'rub');
    const second = consumeMatch(index, 2053036, '2026-05-01', -1000, 'e', 'Продукты', 'rub');

    expect(first?.id).toBe(6);
    expect(second).toBeNull();
  });

  it('greedy 1:1: two cache entries with same key — each consumed once', () => {
    const e1 = makeEntry({ id: 7, real_amount: -1000 });
    const e2 = makeEntry({ id: 8, real_amount: -1000 });
    const index = buildMatchIndex([e1, e2]);

    const first = consumeMatch(index, 2053036, '2026-05-01', -1000, 'e', 'Продукты', 'rub');
    const second = consumeMatch(index, 2053036, '2026-05-01', -1000, 'e', 'Продукты', 'rub');
    const third = consumeMatch(index, 2053036, '2026-05-01', -1000, 'e', 'Продукты', 'rub');

    expect(first?.id).toBe(7);
    expect(second?.id).toBe(8);
    expect(third).toBeNull();
  });
});
