import { describe, it, expect, afterEach } from 'vitest';
import { istLocalToUtcIso, utcToIstLocalInput } from '../../../src/lib/istDateTime';

describe('istLocalToUtcIso', () => {
  it('converts the documented bug example: 10 PM IST tonight', () => {
    // The live bug: an HOD typing 2026-08-11T22:00 (10 PM IST) must store as
    // 16:30 UTC, not be cast as if 22:00 were already UTC.
    expect(istLocalToUtcIso('2026-08-11T22:00')).toBe('2026-08-11T16:30:00.000Z');
  });

  it('crosses the UTC date boundary backwards for an early-morning IST time', () => {
    expect(istLocalToUtcIso('2026-08-11T02:00')).toBe('2026-08-10T20:30:00.000Z');
  });

  it('maps IST midnight to vms_day_start_ist for that day', () => {
    // This is exactly what public.vms_day_start_ist(2026-08-11) returns.
    expect(istLocalToUtcIso('2026-08-11T00:00')).toBe('2026-08-10T18:30:00.000Z');
  });

  it('accepts a seconds-bearing input', () => {
    expect(istLocalToUtcIso('2026-08-11T22:00:45')).toBe('2026-08-11T16:30:45.000Z');
  });

  it.each(['', '   ', 'garbage', '2026-08-11', '2026/08/11T22:00'])(
    'returns null for unusable input %j',
    (input) => {
      expect(istLocalToUtcIso(input)).toBeNull();
    },
  );
});

describe('utcToIstLocalInput', () => {
  it('inverts the documented bug example', () => {
    expect(utcToIstLocalInput('2026-08-11T16:30:00.000Z')).toBe('2026-08-11T22:00');
  });

  it('inverts the backwards date-boundary example', () => {
    expect(utcToIstLocalInput('2026-08-10T20:30:00.000Z')).toBe('2026-08-11T02:00');
  });

  it('inverts the IST-midnight / vms_day_start_ist example', () => {
    expect(utcToIstLocalInput('2026-08-10T18:30:00.000Z')).toBe('2026-08-11T00:00');
  });

  it('drops seconds when formatting for the input', () => {
    expect(utcToIstLocalInput('2026-08-11T16:30:45.000Z')).toBe('2026-08-11T22:00');
  });

  it.each([null, undefined, '', 'garbage'])('returns "" for %j', (input) => {
    expect(utcToIstLocalInput(input as string | null | undefined)).toBe('');
  });
});

describe('round-trip property', () => {
  const values = [
    '2026-01-01T00:00',
    '2026-08-11T22:00',
    '2026-08-11T02:00',
    '2026-12-31T23:59',
    '2026-08-11T00:00',
    '2026-06-15T13:37',
  ];

  it.each(values)('utcToIstLocalInput(istLocalToUtcIso(%s)) === %s', (value) => {
    const iso = istLocalToUtcIso(value);
    expect(iso).not.toBeNull();
    expect(utcToIstLocalInput(iso)).toBe(value);
  });
});

describe('machine timezone independence', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  // The whole bug this module fixes is a function that silently borrowed the
  // MACHINE's timezone (`new Date(localString)`) instead of a fixed IST
  // offset. Neither function here ever calls `new Date(bareLocalString)` —
  // istLocalToUtcIso builds the instant via Date.UTC() from parsed components,
  // and utcToIstLocalInput reads back only UTC-suffixed getters (getUTCFullYear,
  // getUTCHours, ...). Both are structurally incapable of depending on
  // process.env.TZ. This test proves it by asserting identical output across
  // several different machine timezones.
  it('istLocalToUtcIso gives the same UTC instant regardless of process.env.TZ', () => {
    const results = ['UTC', 'America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati'].map(
      (tz) => {
        process.env.TZ = tz;
        return istLocalToUtcIso('2026-08-11T22:00');
      },
    );
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe('2026-08-11T16:30:00.000Z');
  });

  it('utcToIstLocalInput gives the same wall-clock string regardless of process.env.TZ', () => {
    const results = ['UTC', 'America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati'].map(
      (tz) => {
        process.env.TZ = tz;
        return utcToIstLocalInput('2026-08-11T16:30:00.000Z');
      },
    );
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe('2026-08-11T22:00');
  });
});
