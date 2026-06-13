import { HoneyMoneyClient } from 'src/hmbee/client.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockEnv = {
  HM_USER_EMAIL: 'user@example.com',
  HM_USER_TOKEN: 'secret-token',
  HM_API_BASE_URL: 'https://app.hmbee.ru/api',
  HM_SOURCE: 'HM3',
  HM_COOKIE: 'session=super-secret-cookie'
};

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
