'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/cases', label: 'Test cases' },
  { href: '/runs', label: 'Runs' },
  { href: '/setup', label: 'Setup' },
];

/** The current-page marker needs the URL, which is only known per request; MainNavShell renders the same links without it. */
export function MainNav() {
  return (
    <>
      {LINKS.map((l) => (
        <NavLink key={l.href} href={l.href}>
          {l.label}
        </NavLink>
      ))}
    </>
  );
}

export function MainNavShell() {
  return (
    <>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="inline-flex min-h-[44px] items-center px-2 text-muted hover:text-ink hover:underline underline-offset-[6px]">
          {l.label}
        </Link>
      ))}
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const current = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      // Current page: heavier weight plus an underline, so it does not rely on color alone.
      className={`inline-flex min-h-[44px] items-center px-2 hover:text-ink hover:underline underline-offset-[6px] ${
        current ? 'font-semibold text-ink underline decoration-2' : 'text-muted'
      }`}
    >
      {children}
    </Link>
  );
}
