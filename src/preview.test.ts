import { describe, expect, it } from 'vitest';
import { normalizeTochkaRecord } from './preview/tochka.js';

describe('Tochka Normalization', () => {
  const mockBaseRecord = {
    meta_data: {
      time_data: {
        event_date: '2026-04-27T11:48:03.000+05:00'
      }
    },
    data: {
      tranId: 4223584703,
      account: '40802810309500023530',
      currency: 'RUB',
      sum: 241.07,
      tranCode: 'Purchase',
      status: 'InProgress',
      title: 'PYATEROCHKA',
      description: '*0114'
    }
  };

  it('should identify supported Purchase with InProgress status', () => {
    const result = normalizeTochkaRecord(mockBaseRecord);
    expect(result.normalized.identified).toBe(true);
    expect(result.normalized.transactionId).toBe('4223584703');
    expect(result.normalized.amount).toBe(241.07);
    expect(result.normalized.status).toBe('InProgress');
    // Task 4.1: Category mapping
    expect(result.hmbee.category).toBe('Покупки / Продукты');
  });

  it('should map Yandex Taxi to Проезд / Такси', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, title: 'YANDEX*4121*TAXI', description: undefined }
    };
    const result = normalizeTochkaRecord(record);
    expect(result.hmbee.category).toBe('Проезд / Такси');
  });

  it('should identify supported Purchase with Withdraw status', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Withdraw' }
    };
    const result = normalizeTochkaRecord(record);
    expect(result.normalized.identified).toBe(true);
    expect(result.normalized.status).toBe('Withdraw');
  });

  it('should not identify record with unsupported status (e.g., Received)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, status: 'Received' }
    };
    const result = normalizeTochkaRecord(record);
    expect(result.normalized.identified).toBe(false);
    expect(result.normalized.status).toBe('Received');
  });

  it('should not identify record with unsupported type (e.g., Transfer)', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, tranCode: 'Transfer' }
    };
    const result = normalizeTochkaRecord(record);
    expect(result.normalized.identified).toBe(false);
    expect(result.normalized.type).toBe('Transfer');
  });

  it('should handle missing description by falling back to title', () => {
    const record = {
      ...mockBaseRecord,
      data: { ...mockBaseRecord.data, description: undefined, title: 'Fallback Title' }
    };
    const result = normalizeTochkaRecord(record);
    expect(result.normalized.description).toBe('Fallback Title');
  });
});
