import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { normalizeHoneyMoneyAmount, normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { AppConfig } from 'src/config.js';
import { createAccountRegistry } from 'src/config.js';
import { describe, expect, it } from 'vitest';

describe('Tochka Normalization', () => {
  const normalizationOptions = {
    accountMappings: {
      '40802810309500012345': 67890
    },
    accountRegistry: createAccountRegistry({
      sources: {
        tochka: {
          accountMappings: { '40802810309500012345': 67890 },
          hmAccounts: {},
          typeCodes: {}
        }
      }
    } as AppConfig),
    typeCodeRules: {
      CardTransactionInfo: {
        conditions: {
          included: {
            or: [
              {
                and: [
                  { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
                  { '==': [{ var: 'record.data.status' }, 'InProgress'] }
                ]
              },
              {
                and: [
                  { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
                  { '==': [{ var: 'record.data.status' }, 'Withdraw'] }
                ]
              }
            ]
          },
          excluded: {
            or: [
              { '==': [{ var: 'record.data.tranCode' }, 'CheckCard'] },
              {
                and: [
                  { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
                  { '==': [{ var: 'record.data.status' }, 'Canceled'] }
                ]
              }
            ]
          }
        }
      }
    }
  };

  const mockBaseRecord = {
    meta_data: {
      system_data: {
        type_code: 'CardTransactionInfo'
      },
      time_data: {
        event_date: '2026-04-27T11:48:03.000+05:00'
      }
    },
    data: {
      tranId: 4223584703,
      account: '40802810309500012345',
      currency: 'RUB',
      sum: 241.07,
      tranCode: 'Purchase',
      status: 'InProgress',
      title: 'ART-MOSKVA',
      description: '*0114',
      mcc: '1234'
    }
  };

  it('should identify supported Purchase with InProgress status', () => {
    const result = normalizeTochkaRecord(mockBaseRecord, normalizationOptions);
    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.transactionId).toBe('4223584703');
    expect(result.normalized?.amount).toBe(241.07);
    expect(result.normalized?.status).toBe('InProgress');
    expect(result.hmbee?.category).toBe('Услуги / Коворкинг');
    expect(result.hmbee?.subtype).toBe('e');
    expect(result.hmbee?.date).toBe('2026-04-27');
    expect(result.hmbee?.currency).toBe('rub');
    expect(result.hmbee?.real_amount).toBe(-241);
    expect(result.hmbee?.account_id).toBe(67890);
  });

  it('should map Yandex Taxi to Проезд / Такси', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, title: 'Yandex*4121*Taxi', description: undefined, mcc: '4121' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.hmbee?.category).toBe('Проезд / Такси');
  });

  it('should mark CheckCard as identified but excluded', () => {
    const record = {
      ...mockBaseRecord,
      data: {
        ...mockBaseRecord.data,
        tranCode: 'CheckCard',
        status: 'InProgress'
      }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('excluded');
    expect(result.normalized).toBeDefined();
    expect(result.hmbee).toBeDefined();
  });

  it('should mark canceled Purchase as identified but excluded', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Canceled' }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('excluded');
  });

  it('should identify supported Purchase with Withdraw status', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Withdraw' }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(true);
    expect(result.save).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.normalized?.status).toBe('Withdraw');
  });

  it('should not identify record with no matching include or exclude rule', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Received' }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('no matching included/excluded condition');
    expect(result.normalized).toBeUndefined();
  });

  it('should fail identification on included/excluded ambiguity', () => {
    const optionsWithAmbiguity = {
      ...normalizationOptions,
      typeCodeRules: {
        CardTransactionInfo: {
          conditions: {
            included: { '==': [{ var: 'record.data.tranCode' }, 'Purchase'] },
            excluded: { '==': [{ var: 'record.data.status' }, 'InProgress'] }
          }
        }
      }
    };

    const result = normalizeTochkaRecord(mockBaseRecord, optionsWithAmbiguity);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('included/excluded ambiguity');
    expect(result.normalized).toBeUndefined();
  });

  it('should not identify unsupported type_code values', () => {
    const record = {
      ...mockBaseRecord,
      meta_data: {
        ...mockBaseRecord.meta_data,
        system_data: {
          type_code: 'UnknownType'
        }
      }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBe('unsupported type_code: UnknownType');
  });

  it('should return identified: false on parsing error', () => {
    const result = normalizeTochkaRecord({ wrong: 'shape' } as unknown as TochkaSyncRecord, normalizationOptions);
    expect(result.identified).toBe(false);
    expect(result.save).toBe(false);
    expect(result.reason).toBeTypeOf('string');
    expect(result.sourceRecord).toEqual({ wrong: 'shape' });
    expect(result.normalized).toBeUndefined();
  });

  it('should map category based on MCC', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '5411', title: 'Unknown Merchant' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.hmbee?.category).toBe('Покупки / Продукты');
  });

  it('should map category based on merchant title keyword (exact-ish)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '0000', title: 'WHOOSH' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.hmbee?.category).toBe('Услуги / Аренда самокатов');
  });

  it('should map category based on merchant title keyword (partial match)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, mcc: '0000', title: 'CP* WHOOSH.BIKE' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.hmbee?.category).toBe('Услуги / Аренда самокатов');
  });

  it('should normalize outgoing and incoming amounts for Honey Money', () => {
    expect(normalizeHoneyMoneyAmount(241.07, 'e')).toBe(-241);
    expect(normalizeHoneyMoneyAmount(169.99, 'e')).toBe(-170);
    expect(normalizeHoneyMoneyAmount(241.07, 'i')).toBe(241);
  });
});
