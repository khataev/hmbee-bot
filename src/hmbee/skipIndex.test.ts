import type { HoneyMoneyTransaction, PreviewRecord } from 'src/apply/preview/types.js';
import type { HoneyMoneyCacheEntry } from 'src/hmbee/client.js';
import { applySkipPass, buildMatchIndex, consumeMatch, type MatchIndex } from 'src/hmbee/skipIndex.js';
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

function makeHmbee(overrides?: Partial<HoneyMoneyTransaction>): HoneyMoneyTransaction {
  return {
    subtype: 'e',
    date: '2026-05-01',
    account_id: 2053036,
    currency: 'rub',
    id: null,
    type: 'unplanned',
    virtual_id: -1,
    category: 'Продукты',
    description: '1000',
    planned_repeat_days: 0,
    planned_repeat_end: 'always',
    planned_repeat_end_date: null,
    transfer_to_amount: null,
    transfer_type: 'a',
    real_amount: -1000,
    plan_amount: null,
    common_id: null,
    transfer_to_currency: null,
    ...overrides
  } as HoneyMoneyTransaction;
}

function makePreviewRecord(overrides?: Partial<PreviewRecord>): PreviewRecord {
  return {
    identified: true,
    save: true,
    reason: null,
    sourceRecord: {},
    hmbee: makeHmbee(),
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

describe('applySkipPass', () => {
  function indexWith(...entries: HoneyMoneyCacheEntry[]): MatchIndex {
    return buildMatchIndex(entries);
  }

  it('marks matched record as identified=true, save=false, reason="Внесена вручную"', () => {
    const record = makePreviewRecord();
    const index = indexWith(makeEntry({ id: 1 }));

    const [result] = applySkipPass([record], index);

    expect(result?.identified).toBe(true);
    expect(result?.save).toBe(false);
    expect(result?.reason).toBe('Внесена вручную');
  });

  it('leaves unmatched record unchanged', () => {
    const record = makePreviewRecord({ hmbee: makeHmbee({ category: 'Другая' }) });
    const index = indexWith(makeEntry({ id: 1, category: 'Продукты' }));

    const [result] = applySkipPass([record], index);

    expect(result?.save).toBe(true);
    expect(result?.reason).toBeNull();
  });

  it('leaves record without hmbee unchanged', () => {
    const record: PreviewRecord = { identified: false, save: false, reason: 'unsupported', sourceRecord: {} };
    const index = indexWith(makeEntry({ id: 1 }));

    const [result] = applySkipPass([record], index);

    expect(result).toEqual(record);
  });

  it('skip record has save=false and does not go to write-path', () => {
    const record = makePreviewRecord();
    const index = indexWith(makeEntry({ id: 1 }));

    const [result] = applySkipPass([record], index);

    expect(result?.save).toBe(false);
  });

  it('excluded record (save=false) does not consume cache entry — sibling save=true record still gets matched', () => {
    // Regression: internal bank transfers produce two records for the same transaction
    // (e.g. PaymentIncome + PaymentAccepted). After sorting by timestamp, the excluded
    // PaymentIncome may arrive first. It must NOT consume the cache entry so that the
    // included PaymentAccepted can still be matched and skipped.
    const excludedRecord = makePreviewRecord({ save: false, reason: 'excluded' });
    const includedRecord = makePreviewRecord({ save: true, reason: null });
    const index = indexWith(makeEntry({ id: 1 }));

    const [excludedResult, includedResult] = applySkipPass([excludedRecord, includedRecord], index);

    expect(excludedResult?.save).toBe(false);
    expect(excludedResult?.reason).toBe('excluded'); // unchanged
    expect(includedResult?.save).toBe(false);
    expect(includedResult?.reason).toBe('Внесена вручную');
  });
});
