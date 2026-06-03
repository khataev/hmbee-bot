import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { HoneyMoneyTransferTransaction } from 'src/apply/preview/types.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('PaymentWrittenOff classification', () => {
  const accountMappings = {
    '40802810000000000011': 2053036,
    '40802810901500303852': 2053036,
    '40802810100000000002': 2053036,
    '40802810100000000001': 2053036
  };

  const options = {
    accountMappings,
    accountRegistry: createAccountRegistry({
      hmbee: {
        currenciesMapping: {
          '810': 'rub'
        }
      },
      sources: {
        tochka: {
          bankBic: '044525104',
          accountMappings,
          hmAccounts: {
            'tochka-ip-deposits': {
              id: 8846259,
              name: 'Точка ИП. Депозиты',
              currency: 'rub',
              isDeposit: true
            }
          },
          typeCodes: {}
        }
      }
    } as AppConfig),
    typeCodeRules: {
      PaymentWrittenOff: {
        conditions: {
          included: {
            or: [
              {
                and: [
                  { '==': [{ var: 'record.data.incoming' }, false] },
                  { '==': [{ var: 'record.data.objectState' }, 'Processed'] },
                  { '==': [{ var: 'record.data.failed' }, false] },
                  { '==': [{ var: 'record.data.isComission' }, true] }
                ]
              },
              {
                and: [
                  { '==': [{ var: 'record.data.incoming' }, false] },
                  { '==': [{ var: 'record.data.isComission' }, false] },
                  {
                    is_owned: [
                      { var: 'record.data.payerAccountId' },
                      { var: 'record.data.payerBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  },
                  {
                    is_owned: [
                      { var: 'record.data.payeeAccountId' },
                      { var: 'record.data.payeeBankBic' },
                      { var: 'accountRegistry' }
                    ]
                  }
                ]
              }
            ]
          },
          excluded: { or: [] }
        }
      }
    }
  };

  it('classifies PaymentWrittenOff commission as save-ready expense', () => {
    const fixture = loadFixture('payment-written-off-commission.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.type).toBe('expense');
    expect(result.hmbee?.account_id).toBe(2053036);
    expect(result.hmbee?.subtype).toBe('e');
    expect(result.hmbee?.real_amount).toBe(-100);
  });

  it('canonicalizes deposit opening as a save-ready transfer with counterparty account', () => {
    const fixture = loadFixture('payment-written-off-deposit-open-transfer.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.type).toBe('transfer');
    expect(result.normalized?.counterpartyAccountId).toBe('42109810000000000033');
    expect(result.hmbee?.subtype).toBe('t');

    const hmbee = result.hmbee as HoneyMoneyTransferTransaction;
    expect(hmbee.transfer_from_id).toBe(2053036);
    expect(hmbee.transfer_to_id).toBe(8846259);
    expect(hmbee.real_amount).toBeGreaterThan(0);
  });

  it('remains unmatched for unknown PaymentWrittenOff shapes', () => {
    const fixture = loadFixture('payment-written-off-unknown.json');
    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(false);
    expect(result.reason).toBe('no matching included/excluded condition');
  });
});
