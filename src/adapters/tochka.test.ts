import { TochkaAdapter } from 'src/adapters/tochka.js';
import { credentialProvider } from 'src/credentials/credentialProvider.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('TochkaAdapter.sync', () => {
  const originalCustomerId = process.env.TOCHKA_CUSTOMER_ID;

  beforeEach(() => {
    process.env.TOCHKA_CUSTOMER_ID = 'test-customer-id';
    vi.spyOn(credentialProvider, 'getSession').mockReturnValue('X-CSRF-TOKEN=test-csrf-token; other=value');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: { time_line_list: [] } })
      })
    );
  });

  afterEach(() => {
    process.env.TOCHKA_CUSTOMER_ID = originalCustomerId;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('builds start_date/end_date via getDayBoundsInTimezone for the configured time_zone', async () => {
    const adapter = new TochkaAdapter();

    await adapter.sync({ from: '2026-08-17', to: '2026-08-17', timeZone: 'Europe/Moscow' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);

    // 2026-08-17T00:00:00.000+03:00 / T23:59:59.999+03:00 (Europe/Moscow, no DST)
    expect(body.params.start_date).toBe('2026-08-16T21:00:00.000Z');
    expect(body.params.end_date).toBe('2026-08-17T20:59:59.999Z');
  });
});
