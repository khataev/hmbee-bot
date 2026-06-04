import type { ReadyApplyRecord } from 'src/apply/index.js';
import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('SbpC2BRefund classification', () => {
  const accountMappings = {
    '40802810100000000001': 2053036
  };

  const options = {
    accountMappings,
    accountRegistry: createAccountRegistry({
      hmbee: {
        currenciesMapping: {}
      },
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
      SbpC2BRefund: {
        conditions: {
          included: {
            and: [
              { '==': [{ var: 'record.data.status' }, 'ACCEPTED'] },
              { '==': [{ var: 'record.data.incoming' }, true] }
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
              { '==': [{ var: 'record.data.incoming' }, false] }
            ]
          }
        }
      }
    }
  };

  it('classifies SbpC2BRefund as save-ready income (happy path)', () => {
    const fixture = loadFixture('sbp-c2b-refund.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('income');
    expect(result.hmbee.account_id).toBe(2053036);
    expect(result.hmbee.subtype).toBe('i');
    expect(result.hmbee.currency).toBe('rub');
    expect(result.hmbee.real_amount).toBe(439);
  });

  it('marks SbpC2BRefund invalid forms as identified but excluded (CANCELED/REJECTED/incoming=false)', () => {
    const invalidFixtures = [
      'sbp-c2b-refund-canceled.json',
      'sbp-c2b-refund-rejected.json',
      'sbp-c2b-refund-outgoing.json'
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
