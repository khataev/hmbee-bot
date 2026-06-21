import type { ReadyApplyRecord } from 'src/apply/index.js';
import { loadFixture } from 'src/apply/preview/test-helpers.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { HoneyMoneyTransferTransaction } from 'src/apply/preview/types.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

const tochkaHmId = 2053036;
const tinkoffHmId = 5696;

const tochkaAccountMappings = { '40802810100000000001': tochkaHmId };
const allAccountMappings = {
  '40802810100000000001': tochkaHmId,
  '40817810000000000002': tinkoffHmId
};

const accountRegistry = createAccountRegistry({
  time_zone: 'Europe/Moscow',
  hmbee: {
    currenciesMapping: {},
    categoryMapping: { mcc: {}, title: [], ignored: { mcc: [], title: [] } }
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

const typeCodeRules = {
  SbpC2CPayment: {
    conditions: {
      included: {
        and: [{ '==': [{ var: 'record.data.status' }, 'DONE'] }, { '==': [{ var: 'record.data.incoming' }, true] }]
      },
      excluded: {
        '==': [{ var: 'record.data.incoming' }, false]
      }
    }
  }
};

const options = {
  accountMappings: tochkaAccountMappings,
  categoryMapping: {
    mcc: {},
    title: [{ pattern: /.*/, entry: { category: 'Прочее' } }],
    ignored: { mcc: [], title: [] }
  },
  accountRegistry,
  timeZone: 'Europe/Moscow',
  typeCodeRules
};

describe('SbpC2CPayment classification', () => {
  it('classifies external-payer incoming SbpC2CPayment as save-ready income', () => {
    const fixture = loadFixture('sbp-c2c-payment-income.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('income');
    expect(result.hmbee.account_id).toBe(tochkaHmId);
    expect(result.hmbee.subtype).toBe('i');
    expect(result.hmbee.currency).toBe('rub');
    expect(result.hmbee.real_amount).toBe(5000);
  });

  it('classifies own-account incoming SbpC2CPayment as save-ready transfer', () => {
    const fixture = loadFixture('sbp-c2c-payment-own-transfer.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options) as ReadyApplyRecord;

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized.type).toBe('transfer');
    expect(result.normalized.counterpartyAccountId).toBe('40817810000000000002');
    expect(result.hmbee.subtype).toBe('t');
    expect(result.hmbee.currency).toBe('rub');

    const hmbee = result.hmbee as HoneyMoneyTransferTransaction;
    expect(hmbee.transfer_from_id).toBe(tinkoffHmId);
    expect(hmbee.transfer_to_id).toBe(tochkaHmId);
    expect(hmbee.real_amount).toBe(10000);
  });

  it('marks outgoing SbpC2CPayment as identified but excluded', () => {
    const fixture = loadFixture('sbp-c2c-payment-incoming-false.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('excluded');
  });

  it('does not identify SbpC2CPayment with unknown status', () => {
    const fixture = loadFixture('sbp-c2c-payment-unknown-status.json');

    const result = normalizeTochkaRecord(fixture as TochkaSyncRecord, options);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
  });
});
