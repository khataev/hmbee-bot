import {
  dispatchTransaction,
  filterApplyRecords,
  parseOnlyIdsOption,
  promptSend,
  type ReadyApplyRecord
} from 'src/apply/index.js';
import type { HoneyMoneyTransaction } from 'src/apply/preview/types.js';
import { describe, expect, it, vi } from 'vitest';

function createRecord(transactionId: string): ReadyApplyRecord {
  return {
    identified: true,
    save: true,
    reason: null,
    sourceRecord: { id: transactionId },
    normalized: {
      transactionId,
      account: '40802810309500023530',
      status: 'Withdraw',
      date: '2026-04-27T11:48:03.000+05:00',
      type: 'expense',
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

describe('promptSend', () => {
  it('y → returns y', async () => {
    const ask = vi.fn().mockResolvedValue('y');
    expect(await promptSend('summary', ask)).toBe('y');
    expect(ask).toHaveBeenCalledOnce();
  });

  it('n → returns n', async () => {
    expect(await promptSend('summary', vi.fn().mockResolvedValue('n'))).toBe('n');
  });

  it('q → returns q', async () => {
    expect(await promptSend('summary', vi.fn().mockResolvedValue('q'))).toBe('q');
  });

  it('a → returns a', async () => {
    expect(await promptSend('summary', vi.fn().mockResolvedValue('a'))).toBe('a');
  });

  it('unknown input → re-asks until valid', async () => {
    const ask = vi.fn().mockResolvedValueOnce('x').mockResolvedValueOnce('').mockResolvedValueOnce('n');
    expect(await promptSend('summary', ask)).toBe('n');
    expect(ask).toHaveBeenCalledTimes(3);
  });
});

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

describe('dispatchTransaction', () => {
  const createDraft: HoneyMoneyTransaction = {
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
  };

  const confirmDraft: HoneyMoneyTransaction = {
    subtype: 'e',
    date: '2026-04-27',
    account_id: 2053036,
    currency: 'rub',
    id: 42,
    type: 'planned',
    virtual_id: 1,
    category: 'Покупки / Продукты',
    description: '500',
    planned_repeat_days: 30,
    planned_repeat_end: 'always',
    planned_repeat_end_date: null,
    transfer_to_amount: null,
    transfer_type: 'a',
    real_amount: -500,
    plan_amount: -500,
    common_id: 'abc123',
    transfer_to_currency: null
  };

  it('routes id=null to createTransaction', async () => {
    const client = {
      createTransaction: vi.fn().mockResolvedValue(101),
      confirmPlannedTransaction: vi.fn()
    };
    const result = await dispatchTransaction(createDraft, client);
    expect(result).toBe(101);
    expect(client.createTransaction).toHaveBeenCalledWith(createDraft);
    expect(client.confirmPlannedTransaction).not.toHaveBeenCalled();
  });

  it('routes id!=null to confirmPlannedTransaction', async () => {
    const client = {
      createTransaction: vi.fn(),
      confirmPlannedTransaction: vi.fn().mockResolvedValue(202)
    };
    const result = await dispatchTransaction(confirmDraft, client);
    expect(result).toBe(202);
    expect(client.confirmPlannedTransaction).toHaveBeenCalledWith(confirmDraft);
    expect(client.createTransaction).not.toHaveBeenCalled();
  });
});
