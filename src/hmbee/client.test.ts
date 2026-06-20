import { HoneyMoneyClient } from 'src/hmbee/client.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockEnv = {
  HM_USER_EMAIL: 'user@example.com',
  HM_USER_TOKEN: 'secret-token',
  HM_API_BASE_URL: 'https://app.hmbee.ru/api',
  HM_SOURCE: 'HM3',
  HM_COOKIE: 'session=super-secret-cookie'
};

describe('HoneyMoneyClient.confirmPlannedTransaction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the confirmed transaction id on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          data: { id: 1, transaction: { id: 2580985713 } }
        })
      })
    );

    const client = new HoneyMoneyClient(mockEnv);
    const id = await client.confirmPlannedTransaction({
      subtype: 'e',
      date: '2026-05-02',
      account_id: 2053036,
      currency: 'rub',
      id: 2580985713,
      type: 'planned',
      virtual_id: null,
      category: 'Аренда квартиры',
      description: '31000 Аренда квартиры',
      planned_repeat_days: 7,
      planned_repeat_end: 'date',
      planned_repeat_end_date: '2026-06-28',
      transfer_to_amount: null,
      transfer_type: 'a',
      real_amount: -31000,
      plan_amount: -31000,
      common_id: null,
      transfer_to_currency: null
    });

    expect(id).toBe(2580985713);
  });

  it('throws when status is not success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'error', data: { id: 1, transaction: { id: 1 } } })
      })
    );

    const client = new HoneyMoneyClient(mockEnv);
    const promise = client.confirmPlannedTransaction({
      subtype: 'e',
      date: '2026-05-02',
      account_id: 2053036,
      currency: 'rub',
      id: 1,
      type: 'planned',
      virtual_id: null,
      category: null,
      description: '31000 Аренда',
      planned_repeat_days: 0,
      planned_repeat_end: 'always',
      planned_repeat_end_date: null,
      transfer_to_amount: null,
      transfer_type: 'a',
      real_amount: -31000,
      plan_amount: -31000,
      common_id: null,
      transfer_to_currency: null
    });

    await expect(promise).rejects.toThrow('Honey Money plan confirmation returned status error');
  });

  it('throws when HTTP fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 }));

    const client = new HoneyMoneyClient(mockEnv);
    const promise = client.confirmPlannedTransaction({
      subtype: 'e',
      date: '2026-05-02',
      account_id: 2053036,
      currency: 'rub',
      id: 1,
      type: 'planned',
      virtual_id: null,
      category: null,
      description: 'test',
      planned_repeat_days: 0,
      planned_repeat_end: 'always',
      planned_repeat_end_date: null,
      transfer_to_amount: null,
      transfer_type: 'a',
      real_amount: -1000,
      plan_amount: -1000,
      common_id: null,
      transfer_to_currency: null
    });

    await expect(promise).rejects.toThrow('Honey Money confirm request failed with status 422');
  });
});

describe('HoneyMoneyClient.getAllTransactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses array response and returns array of entries', async () => {
    const entry = {
      id: 737481,
      type: 'unplanned',
      subtype: 'e',
      real_amount: -1000,
      currency: 'rub',
      description: 'test',
      date: '2013-11-01',
      category: 'Спорт',
      account_id: 5695
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [entry]
      })
    );

    const client = new HoneyMoneyClient(mockEnv);
    const result = await client.getAllTransactions();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 737481 });
  });

  it('accepts entries without description', async () => {
    const entry = {
      id: 737481,
      type: 'unplanned',
      subtype: 'e',
      real_amount: -1000,
      currency: 'rub',
      date: '2013-11-01',
      account_id: 5695
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [entry]
      })
    );

    const client = new HoneyMoneyClient(mockEnv);
    const result = await client.getAllTransactions();

    expect(result).toHaveLength(1);
    expect(result[0]?.description).toBeUndefined();
  });

  it('throws an error without revealing secrets when HTTP fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      })
    );

    const client = new HoneyMoneyClient(mockEnv);
    await expect(client.getAllTransactions()).rejects.toThrow('Honey Money all_json request failed with status 401');
  });
});
