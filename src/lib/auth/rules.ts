import { createHash, randomBytes } from 'node:crypto';

export const LINK_MINUTES = 15;
export const SESSION_DAYS = 30;
// Requests per address inside one link lifetime. Stops anyone from flooding a colleague's inbox.
export const MAX_LINKS_PER_WINDOW = 5;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface Allowlist {
  emails: Set<string>;
  domains: Set<string>;
}

/** ALLOWED_EMAILS: comma or newline separated; "name@x.com" allows one address, "@x.com" a whole domain. */
export function parseAllowlist(raw: string | undefined): Allowlist {
  const emails = new Set<string>();
  const domains = new Set<string>();
  for (const entry of (raw ?? '').split(/[,\n]/).map(normalizeEmail).filter(Boolean)) {
    if (entry.startsWith('@')) domains.add(entry.slice(1));
    else emails.add(entry);
  }
  return { emails, domains };
}

export function isAllowed(email: string, list: Allowlist): boolean {
  const e = normalizeEmail(email);
  const domain = e.split('@')[1] ?? '';
  return list.emails.has(e) || list.domains.has(domain);
}

export const allowlistIsEmpty = (list: Allowlist) => list.emails.size === 0 && list.domains.size === 0;

/** Only paths on this site, never another origin ("//evil.com", "/\evil.com") or the sign-in pages themselves. */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw === '/login' || raw.startsWith('/login/') || raw.startsWith('/login?')) return '/';
  return raw.slice(0, 500);
}

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
