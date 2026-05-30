import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('SbpC2BPayment classification', () => {
  const accountMappings = {
    '40802810100000000001': 2053036
  };

  const options = {
    accountMappings,
    accountRegistry: createAccountRegistry({
      sources: {
        tochka: {
          accountMappings,
          hmAccounts: {},
          typeCodes: {}
        }
      }
    } as AppConfig),
    typeCodeRules: {
      SbpC2BPayment: {
        conditions: {
          included: {
            and: [
              { '==': [{ var: 'record.data.status' }, 'ACCEPTED'] },
              { '==': [{ var: 'record.data.incoming' }, false] }
            ]
          },
          excluded: {
            or: [
              { '==': [{ var: 'record.data.status' }, 'CANCELED'] },
              { '==': [{ var: 'record.data.status' }, 'REJECTED'] },
              { '==': [{ var: 'record.data.incoming' }, true] }
            ]
          }
        }
      }
    }
  };

  it('classifies SbpC2BPayment as save-ready expense (happy path)', () => {
    const fixture = loadFixture('sbp-c2b-payment.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.hmbee?.subtype).toBe('e');
    expect(result.hmbee?.real_amount).toBe(-3392);
    expect(result.hmbee?.account_id).toBe(2053036);
  });

  it('marks SbpC2BPayment invalid forms as identified but excluded (CANCELED/REJECTED/incoming=true)', () => {
    const invalidFixtures = [
      'sbp-c2b-payment-canceled.json',
      'sbp-c2b-payment-rejected.json',
      'sbp-c2b-payment-incoming.json'
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
