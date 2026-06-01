import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
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
    accountRegistry: createAccountRegistry({
      sources: {
        tochka: {
          bankBic: '044525104',
          accountMappings,
          hmAccounts: {},
          typeCodes: {}
        }
      }
    } as AppConfig),
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

  it('classifies non-transfer SbpB2CPayment as save-ready expense', () => {
    const fixture = loadFixture('sbp-b2c-payment-non-transfer.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.hmbee?.subtype).toBe('e');
    expect(result.hmbee?.real_amount).toBe(-4000);
    expect(result.hmbee?.account_id).toBe(2053036);
  });

  it('identifies transfer-like SbpB2CPayment as save-ready canonical transfer', () => {
    const fixture = loadFixture('sbp-b2c-payment-own-transfer.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.type).toBe('transfer');
    expect(result.normalized?.counterpartyAccountId).toBe('40817810000000000001');
    expect(result.hmbee?.subtype).toBe('e');
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
});
