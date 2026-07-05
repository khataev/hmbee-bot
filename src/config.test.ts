import { readFileSync } from 'node:fs';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry, loadConfig } from 'src/config.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn()
}));

const mockReadFileSync = vi.mocked(readFileSync);

function makeSourcesJson(
  sources: Record<string, unknown>,
  categoryMapping: Record<string, unknown> = { mcc: {}, title: {}, ignored: { mcc: [], title: [] } }
): string {
  return JSON.stringify({
    time_zone: 'Europe/Moscow',
    hmbee: { currenciesMapping: {}, categoryMapping },
    sources
  });
}

const singleBankSources = {
  sber: {
    hmAccounts: { 'sber-zarpl': { id: 1000001, name: 'Сбер', currency: 'rub' } },
    accountMappings: { '40817810000000000010': 'sber-zarpl' }
  }
};

describe('loadConfig — schema validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 6.5: empty sources rejected; single bank passes
  it('rejects empty sources', () => {
    mockReadFileSync.mockReturnValue(makeSourcesJson({}));
    expect(() => loadConfig()).toThrow('sources must not be empty');
  });

  it('accepts config with a single bank (no tochka required by schema)', () => {
    mockReadFileSync.mockReturnValue(
      makeSourcesJson({
        sber: {
          hmAccounts: { 'sber-zarpl': { id: 1000001, name: 'Сбер', currency: 'rub' } },
          accountMappings: { '40817810000000000010': 'sber-zarpl' }
        }
      })
    );
    expect(() => loadConfig()).not.toThrow();
  });
});

describe('loadConfig — categoryMapping.rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts config without rules and defaults them to an empty array', () => {
    mockReadFileSync.mockReturnValue(makeSourcesJson(singleBankSources));

    const config = loadConfig();

    expect(config.hmbee.categoryMapping.rules).toEqual([]);
  });

  it('parses config with rules', () => {
    const rules = [
      {
        when: {
          and: [
            { '==': [{ var: 'record.meta_data.system_data.type_code' }, 'PaymentWrittenOff'] },
            { matches: ['смс-информирование', { var: 'record.data.purpose' }] }
          ]
        },
        category: 'Банки / Периодические списания',
        description: 'СМС-информирование'
      },
      {
        when: { '==': [{ var: 'record.data.phoneNumber' }, '+79000000000'] },
        category: 'Услуги'
      }
    ];
    mockReadFileSync.mockReturnValue(
      makeSourcesJson(singleBankSources, { mcc: {}, title: {}, rules, ignored: { mcc: [], title: [] } })
    );

    const config = loadConfig();

    expect(config.hmbee.categoryMapping.rules).toEqual(rules);
  });

  it('rejects a rule without category', () => {
    const rules = [{ when: { '==': [1, 1] } }];
    mockReadFileSync.mockReturnValue(
      makeSourcesJson(singleBankSources, { mcc: {}, title: {}, rules, ignored: { mcc: [], title: [] } })
    );

    expect(() => loadConfig()).toThrow();
  });
});

describe('loadConfig — account collision detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 6.3: same account number → different HM ids across banks → error
  it('throws when the same account number maps to different Honey Money ids in different banks', () => {
    mockReadFileSync.mockReturnValue(
      makeSourcesJson({
        tochka: {
          bankBic: '044525104',
          hmAccounts: { 'tochka-rub': { id: 100, name: 'Точка', currency: 'rub' } },
          accountMappings: { '40802810000000000001': 'tochka-rub' }
        },
        sber: {
          hmAccounts: { 'sber-rub': { id: 999, name: 'Сбер', currency: 'rub' } },
          accountMappings: { '40802810000000000001': 'sber-rub' }
        }
      })
    );
    expect(() => loadConfig()).toThrow("Account number '40802810000000000001'");
  });

  it('does not throw when the same account number maps to the same Honey Money id in different banks', () => {
    mockReadFileSync.mockReturnValue(
      makeSourcesJson({
        tochka: {
          bankBic: '044525104',
          hmAccounts: { shared: { id: 100, name: 'Счёт', currency: 'rub' } },
          accountMappings: { '40802810000000000001': 'shared' }
        },
        sber: {
          hmAccounts: { shared: { id: 100, name: 'Счёт', currency: 'rub' } },
          accountMappings: { '40802810000000000001': 'shared' }
        }
      })
    );
    expect(() => loadConfig()).not.toThrow();
  });
});

describe('createAccountRegistry — multi-bank allAccountMappings', () => {
  const tochkaAccount = '40802810100000000001';
  const tinkoffAccount = '40817810000000000020';
  const allAccountMappings = { [tochkaAccount]: 2053036, [tinkoffAccount]: 1000003 };

  const config: AppConfig = {
    time_zone: 'Europe/Moscow',
    hmbee: {
      currenciesMapping: {},
      categoryMapping: { mcc: {}, title: [], rules: [], ignored: { mcc: [], title: [] } }
    },
    sources: {
      tochka: {
        bankBic: '044525104',
        accountMappings: { [tochkaAccount]: 2053036 },
        hmAccounts: {},
        typeCodes: {}
      }
    },
    allAccountMappings
  } as AppConfig;

  const registry = createAccountRegistry(config);

  it('resolves getHmAccountId from allAccountMappings for accounts in any configured bank', () => {
    expect(registry.getHmAccountId(tochkaAccount)).toBe(2053036);
    expect(registry.getHmAccountId(tinkoffAccount)).toBe(1000003);
    expect(registry.getHmAccountId('40817810000000000099')).toBeUndefined();
  });

  it('isOwned returns true for accounts in allAccountMappings regardless of bank', () => {
    expect(registry.isOwned(tochkaAccount, '044525104')).toBe(true);
    expect(registry.isOwned(tinkoffAccount, '044525974')).toBe(true);
    expect(registry.isOwned('40817810000000000099', '044525974')).toBe(false);
  });
});
