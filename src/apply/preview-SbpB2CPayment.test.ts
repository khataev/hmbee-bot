import type { ReadyApplyRecord } from 'src/apply/index.js';
import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { HoneyMoneyTransferTransaction } from 'src/apply/preview/types.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('SbpB2CPayment classification', () => {
  const accountMappings = {
    '40802810100000000001': 2053036,
    '40817810000000000001': 26755
  };

  const options = {
    accountMappings,
    categoryMapping: {
      mcc: {},
      title: [{ pattern: /.*/, entry: { category: 'Прочее' } }],
      rules: [],
      ignored: { mcc: [], title: [] }
    },
    accountRegistry: createAccountRegistry({
      time_zone: 'Europe/Moscow',
      hmbee: {
        currenciesMapping: {},
        categoryMapping: { mcc: {}, title: [], rules: [], ignored: { mcc: [], title: [] } }
      },
      sources: {
        tochka: {
          bankBic: '044525104',
          accountMappings,
          hmAccounts: {},
          typeCodes: {}
        }
      },
      allAccountMappings: accountMappings
    } as AppConfig),
    timeZone: 'Europe/Moscow',
    typeCodeRules: {
      SbpB2CPayment: {
        conditions: {
          included: {
            or: [
              {
                and: [
                  { '==': [{ var: 'record.data.status' }, 'ACCEPTED'] },
                  { '==': [{ var: 'record.data.incoming' }, false] },
                  {
                    is_owned: [
                      { var: 'record.data.payerAccountId' },
                      { var: 'record.data.payerBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  }
                ]
              },
              {
                and: [
                  { '==': [{ var: 'record.data.status' }, 'ACCEPTED'] },
                  { '==': [{ var: 'record.data.incoming' }, true] },
                  {
                    is_owned: [
                      { var: 'record.data.payerAccountId' },
                      { var: 'record.data.payerBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  }
                ]
              }
            ]
          },
          excluded: {
            or: [
              { '==': [{ var: 'record.data.status' }, 'CANCELED'] },
              { '==': [{ var: 'record.data.status' }, 'REJECTED'] }
            ]
          }
        }
      }
    }
  };

  it('classifies non-transfer SbpB2CPayment as save-ready expense', () => {
    const fixture = loadFixture('sbp-b2c-payment-non-transfer.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('expense');
    expect(result.hmbee.account_id).toBe(2053036);
    expect(result.hmbee.subtype).toBe('e');
    expect(result.hmbee.currency).toBe('rub');
    expect(result.hmbee.real_amount).toBe(-4000);
  });

  it('identifies transfer-like SbpB2CPayment as save-ready canonical transfer', () => {
    const fixture = loadFixture('sbp-b2c-payment-own-transfer.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('transfer');
    expect(result.normalized.counterpartyAccountId).toBe('40817810000000000001');
    expect(result.hmbee.subtype).toBe('t');
    expect(result.hmbee.currency).toBe('rub');

    const hmbee = result.hmbee as HoneyMoneyTransferTransaction;
    expect(hmbee.transfer_from_id).toBe(2053036);
    expect(hmbee.transfer_to_id).toBe(26755);
    expect(hmbee.real_amount).toBeGreaterThan(0);
  });

  it('marks SbpB2CPayment invalid forms as identified but excluded (CANCELED/REJECTED/incoming=true)', () => {
    const invalidFixtures = [
      'sbp-b2c-payment-canceled.json',
      'sbp-b2c-payment-rejected.json',
      'sbp-b2c-payment-incoming.json'
    ];

    for (const fixtureName of invalidFixtures) {
      const fixture = loadFixture(fixtureName);
      const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

      expect(result.identified).toBe(true);
      expect(result.save).toBe(false);
      expect(result.reason).toBe('excluded');
    }
  });

  it('transfer records with null category remain save-ready (missing-category rule does not apply)', () => {
    const fixture = loadFixture('sbp-b2c-payment-own-transfer.json');
    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, {
      ...options,
      categoryMapping: { mcc: {}, title: [], rules: [] }
    }) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('transfer');
    expect(result.hmbee.category).toBeNull();
    expect(result.hmbee.subtype).toBe('t');
  });
});

describe('SbpB2CPayment cross-bank transfer (multi-bank registry)', () => {
  const tochkaAccountId = 2053036;
  const tinkoffAccountId = 1000003;
  const tochkaAccountMappings = { '40802810100000000001': tochkaAccountId };
  const tinkoffAccountMappings = { '40817810000000000020': tinkoffAccountId };
  const allAccountMappings = { ...tochkaAccountMappings, ...tinkoffAccountMappings };

  const multiRegistry = createAccountRegistry({
    time_zone: 'Europe/Moscow',
    hmbee: {
      currenciesMapping: {},
      categoryMapping: { mcc: {}, title: [], rules: [], ignored: { mcc: [], title: [] } }
    },
    sources: {
      tochka: {
        bankBic: '044525104',
        accountMappings: tochkaAccountMappings,
        hmAccounts: {},
        typeCodes: {}
      }
    },
    allAccountMappings
  } as AppConfig);

  const multiOptions = {
    accountMappings: tochkaAccountMappings,
    categoryMapping: {
      mcc: {},
      title: [{ pattern: /.*/, entry: { category: 'Прочее' } }],
      rules: [],
      ignored: { mcc: [], title: [] }
    },
    accountRegistry: multiRegistry,
    timeZone: 'Europe/Moscow',
    typeCodeRules: {
      SbpB2CPayment: {
        conditions: {
          included: {
            and: [
              { '==': [{ var: 'record.data.status' }, 'ACCEPTED'] },
              { '==': [{ var: 'record.data.incoming' }, false] },
              {
                is_owned: [
                  { var: 'record.data.payerAccountId' },
                  { var: 'record.data.payerBankBic' },
                  { var: 'accountRegistry' }
                ]
              }
            ]
          },
          excluded: {
            or: [
              {
                or: [
                  { '==': [{ var: 'record.data.status' }, 'CANCELED'] },
                  { '==': [{ var: 'record.data.status' }, 'REJECTED'] }
                ]
              },
              { '==': [{ var: 'record.data.incoming' }, true] }
            ]
          }
        }
      }
    }
  };

  // 6.4: unit test on registry recognizing accounts from both banks
  it('createAccountRegistry recognizes accounts from tochka and tinkoff as owned and resolves both hmIds', () => {
    expect(multiRegistry.isOwned('40802810100000000001', '044525104')).toBe(true);
    expect(multiRegistry.isOwned('40817810000000000020', '044525974')).toBe(true);
    expect(multiRegistry.isOwned('40817810000000000099', '044525974')).toBe(false);
    expect(multiRegistry.getHmAccountId('40802810100000000001')).toBe(tochkaAccountId);
    expect(multiRegistry.getHmAccountId('40817810000000000020')).toBe(tinkoffAccountId);
  });

  // 6.1: full flow — cross-bank transfer gives type=transfer with correct ids
  it('classifies SbpB2CPayment Tochka → T-Bank as transfer with correct counterpartyAccountId and transfer ids', () => {
    const fixture = loadFixture('sbp-b2c-payment-cross-bank-transfer.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, multiOptions) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('transfer');
    expect(result.normalized.counterpartyAccountId).toBe('40817810000000000020');
    expect(result.hmbee.subtype).toBe('t');
    expect(result.hmbee.currency).toBe('rub');

    const hmbee = result.hmbee as HoneyMoneyTransferTransaction;
    expect(hmbee.transfer_from_id).toBe(tochkaAccountId);
    expect(hmbee.transfer_to_id).toBe(tinkoffAccountId);
    expect(hmbee.real_amount).toBeGreaterThan(0);
  });

  // 6.2: payee absent from all banks stays expense
  it('classifies SbpB2CPayment to account absent from all banks as expense', () => {
    const fixture = loadFixture('sbp-b2c-payment-non-transfer.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, multiOptions) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.normalized.type).toBe('expense');
  });
});
