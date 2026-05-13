import { describe, expect, it } from 'vitest';
import { filterApplyRecords, parseOnlyIdsOption, type ReadyApplyRecord } from './apply.js';

function createRecord(transactionId: string): ReadyApplyRecord {
  return {
    identified: true,
    sourceRecord: { id: transactionId },
    normalized: {
      transactionId,
      account: '40802810309500023530',
      status: 'Withdraw',
      date: '2026-04-27T11:48:03.000+05:00',
      type: 'Purchase',
      amount: 241.07,
      currency: 'RUB',
      description: 'Test',
      mcc: '5411'
    },
    hmbee: {
      subtype: 'e',
      date: '2026-04-27',
      account_id: 2053036,
      currency: 'rub',
      id: null,
      type: 'unplanned',
      virtual_id: -1,
      category: 'Покупки / Продукты',
      description: '241',
      planned_repeat_days: 0,
      planned_repeat_end: 'always',
      planned_repeat_end_date: null,
      transfer_to_amount: null,
      transfer_type: 'a',
      real_amount: -241,
      plan_amount: null,
      common_id: null,
      transfer_to_currency: null
    }
  };
}

describe('apply selection', () => {
  it('parses only-id as a trimmed id set', () => {
    expect(parseOnlyIdsOption('1, 2 ,3')).toEqual(new Set(['1', '2', '3']));
  });

  it('returns null when only-id is not provided', () => {
    expect(parseOnlyIdsOption(undefined)).toBeNull();
  });

  it('throws when only-id contains no ids', () => {
    expect(() => parseOnlyIdsOption(' , , ')).toThrow(
      'The --only-id option requires a comma-separated list of transaction ids.'
    );
  });

  it('keeps all identified records by default', () => {
    const records = [createRecord('1'), createRecord('2')];

    expect(filterApplyRecords(records, null)).toEqual(records);
  });

  it('keeps only explicitly requested transaction ids', () => {
    const records = [createRecord('1'), createRecord('2'), createRecord('3')];

    expect(filterApplyRecords(records, new Set(['2', '3']))).toEqual([records[1], records[2]]);
  });
});
