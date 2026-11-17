import Link from 'next/link';
import { Suspense } from 'react';
import { MainNav, MainNavShell } from '@/components/nav-link';
import { ThemeSelect } from '@/components/theme-select';
import { getCurrentUser } from '@/lib/auth/session';
import { signOut } from '../login/actions';

export default function HubLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-1">
          <Link href="/" className="inline-flex min-h-[44px] items-center font-semibold">
            MSL Test Hub
          </Link>
          <nav aria-label="Main" className="order-3 -mx-2 flex w-full flex-wrap sm:order-none sm:w-auto">
            <Suspense fallback={<MainNavShell />}>
              <MainNav />
            </Suspense>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-x-4">
            <Suspense fallback={null}>
              <SignedInAs />
            </Suspense>
            <ThemeSelect />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
        {children}
      </main>
    </>
  );
}

async function SignedInAs() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <form action={signOut} className="flex items-center gap-2">
      <span className="hidden text-muted md:inline">{user.email}</span>
      <button type="submit" className="inline-flex min-h-[44px] items-center text-muted underline-offset-[6px] hover:text-ink hover:underline">
        Sign out
      </button>
    </form>
  );
}
