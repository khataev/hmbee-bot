import { describe, expect, it } from 'vitest';
import { normalizeHoneyMoneyAmount, normalizeTochkaRecord } from './preview/tochka.js';

describe('Tochka Normalization', () => {
  const normalizationOptions = {
    accountMappings: {
      '40802810309500012345': 67890
    }
  };

  const mockBaseRecord = {
    meta_data: {
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

  it('should build an income draft with a positive rounded amount', () => {
    const record = {
      ...mockBaseRecord,
      data: {
        ...mockBaseRecord.data,
        tranCode: 'Income',
        title: 'Incoming Payment',
        sum: 1000.5,
        mcc: ''
      }
    };

    const result = normalizeTochkaRecord(record, normalizationOptions);

    expect(result.hmbee?.subtype).toBe('i');
    expect(result.hmbee?.real_amount).toBe(1001);
    expect(result.hmbee?.category).toBeNull();
  });

  it('should identify supported Purchase with Withdraw status', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Withdraw' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.identified).toBe(true);
    expect(result.normalized?.status).toBe('Withdraw');
  });

  it('should not identify record with unsupported status (e.g., Received)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Received' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.identified).toBe(false);
    expect(result.normalized).toBeUndefined();
  });

  it('should not identify record with unsupported type (e.g., Transfer)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, tranCode: 'Transfer' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.identified).toBe(false);
    expect(result.normalized).toBeUndefined();
  });

  it('should handle missing description by falling back to title', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, description: undefined, title: 'Fallback Title' }
    };
    const result = normalizeTochkaRecord(record, normalizationOptions);
    expect(result.normalized?.description).toBe('Fallback Title');
  });

  it('should return identified: false on parsing error', () => {
    const result = normalizeTochkaRecord({ wrong: 'shape' } as never, normalizationOptions);
    expect(result.identified).toBe(false);
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
