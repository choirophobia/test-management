import { describe, expect, it } from 'vitest';
import { hashToken, isAllowed, isValidEmail, newToken, parseAllowlist, safeNextPath } from './rules';

describe('allowlist', () => {
  const list = parseAllowlist(' Fikri@Example.com , @mystudylife.com\nqa.lead@other.io ');

  it.each([
    ['fikri@example.com', true],
    ['FIKRI@EXAMPLE.COM ', true],
    ['anyone@mystudylife.com', true],
    ['qa.lead@other.io', true],
    ['someone@example.com', false],
    ['anyone@mystudylife.com.evil.io', false],
    ['anyone@sub.mystudylife.com', false],
  ])('%s -> %s', (email, expected) => {
    expect(isAllowed(email, list)).toBe(expected);
  });

  it('allows nobody when ALLOWED_EMAILS is unset', () => {
    expect(isAllowed('fikri@example.com', parseAllowlist(undefined))).toBe(false);
  });
});

describe('safeNextPath', () => {
  it.each([
    ['/cases?last=failing', '/cases?last=failing'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['https://evil.com', '/'],
    ['/login', '/'],
    ['/login/verify?token=x', '/'],
    [undefined, '/'],
  ])('%s -> %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe('tokens', () => {
  it('are long, random, and stored only as a hash', () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });

  it('validates email shape', () => {
    expect(isValidEmail('qa@example.com')).toBe(true);
    expect(isValidEmail('not an email')).toBe(false);
    expect(isValidEmail('missing@tld')).toBe(false);
  });
});
