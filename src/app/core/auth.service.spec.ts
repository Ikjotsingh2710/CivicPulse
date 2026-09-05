import { formatPhone, normalisePhone } from './auth.service';

/**
 * These two functions decide who you are. `normalisePhone` produces the string
 * that becomes the auth email, the JWT phone claim and every `user_phone` value
 * that RLS compares — so a change in its output is an identity change, and
 * these cases are here to make that impossible to do by accident.
 */
describe('normalisePhone', () => {
  it('strips formatting from a plain ten-digit number', () => {
    expect(normalisePhone('7428892131')).toBe('7428892131');
    expect(normalisePhone('74288 92131')).toBe('7428892131');
    expect(normalisePhone('74288-92131')).toBe('7428892131');
  });

  it('collapses every way of writing the same Indian number to one identity', () => {
    const canonical = '7428892131';

    expect(normalisePhone('+91 74288 92131')).toBe(canonical);
    expect(normalisePhone('917428892131')).toBe(canonical);
    expect(normalisePhone('0917428892131')).toBe(canonical);
    expect(normalisePhone('00917428892131')).toBe(canonical);
    expect(normalisePhone('07428892131')).toBe(canonical);
  });

  it('leaves numbers it does not recognise as Indian untouched', () => {
    // A US number is 11 digits with country code and must not lose its '1',
    // and an unrecognised length is passed through rather than guessed at.
    expect(normalisePhone('+1 415 555 0199')).toBe('14155550199');
    expect(normalisePhone('+44 20 7946 0958')).toBe('442079460958');
  });

  it('is idempotent — normalising an already-normal number changes nothing', () => {
    const once = normalisePhone('+91 74288 92131');
    expect(normalisePhone(once)).toBe(once);
  });

  it('tolerates empty and nullish input', () => {
    expect(normalisePhone('')).toBe('');
    expect(normalisePhone(null as unknown as string)).toBe('');
  });
});

describe('formatPhone', () => {
  it('groups a ten-digit number as an Indian mobile', () => {
    expect(formatPhone('7428892131')).toBe('+91 74288 92131');
  });

  it('returns an empty string for no number', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('')).toBe('');
  });
});
