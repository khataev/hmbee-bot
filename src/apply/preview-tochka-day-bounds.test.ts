import { getDayBoundsInTimezone } from 'src/apply/preview/tochka.js';
import { describe, expect, it } from 'vitest';

describe('getDayBoundsInTimezone', () => {
  const tz = 'Asia/Yekaterinburg'; // UTC+05:00, no DST — matches the offset Tochka annotates event_date with

  it('produces exact UTC instant boundaries for a fixed positive offset', () => {
    const { start, end } = getDayBoundsInTimezone('2026-08-17', tz);

    expect(start).toBe('2026-08-16T19:00:00.000Z');
    expect(end).toBe('2026-08-17T18:59:59.999Z');
  });

  it('keeps an early-local-morning event (00:00-05:00 at +05:00) inside its own requested day window', () => {
    const day = '2026-08-17';
    const { start, end } = getDayBoundsInTimezone(day, tz);
    const earlyMorningEvent = new Date('2026-08-17T02:00:00+05:00').toISOString();

    expect(earlyMorningEvent >= start && earlyMorningEvent <= end).toBe(true);
    // Would have been wrongly excluded by the old literal-UTC-day window (`${day}T00:00:00.000Z`..`${day}T23:59:59.999Z`)
    expect(earlyMorningEvent < `${day}T00:00:00.000Z`).toBe(true);
  });

  it('keeps a daytime event inside the requested day window, unchanged from prior behavior', () => {
    const day = '2026-08-17';
    const { start, end } = getDayBoundsInTimezone(day, tz);
    const daytimeEvent = new Date('2026-08-17T12:00:00+05:00').toISOString();

    expect(daytimeEvent >= start && daytimeEvent <= end).toBe(true);
  });
});
