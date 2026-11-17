import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { MainNav, MainNavShell } from '@/components/nav-link';
import { ThemeSelect, themeScript } from '@/components/theme-select';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'MSL Test Hub', template: '%s · MSL Test Hub' },
  description: 'MyStudyLife test cases, run results and reports in one place.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-surface focus:p-2">
          Skip to content
        </a>
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
            <div className="ml-auto">
              <ThemeSelect />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
