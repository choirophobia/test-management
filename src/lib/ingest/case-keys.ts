// Sheet IDs look like AUTH-001, ON-04, TZK-32 or SUB-WB-01.
const ID = String.raw`[A-Z][A-Z0-9]*(?:-[A-Z]{2,})?-\d+`;
const ID_PATTERN = new RegExp(`^${ID}$`);
// Titles start with the ID, or several joined by "/": "RESET-006 / ON-04 a new password works".
// Bracketed markers such as "[known bug]" or "[simulated Stripe]" may come first.
const LEADING_IDS = new RegExp(`^(?:\\[[^\\]]*\\]\\s*)*(${ID}(?:\\s*/\\s*${ID})*)\\b`);

export function isCaseKey(value: string): boolean {
  return ID_PATTERN.test(value);
}

/**
 * Case IDs a test claims to cover. Only the leading IDs count: a Jira key later in the title
 * ("MSL-33 Part 1") is not a test case.
 */
export function caseKeysFromTitle(title: string): string[] {
  const match = title.trim().match(LEADING_IDS);
  if (!match) return [];
  return match[1].split('/').map((s) => s.trim());
}

export function mergeCaseKeys(...lists: string[][]): string[] {
  return [...new Set(lists.flat().filter(isCaseKey))].sort();
}
