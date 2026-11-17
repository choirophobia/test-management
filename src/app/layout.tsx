import type { Metadata } from 'next';
import { themeScript } from '@/components/theme-select';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'MSL Test Hub', template: '%s · MSL Test Hub' },
  description: 'MyStudyLife test cases, run results and reports in one place.',
  // No icon has been chosen yet; an empty one stops browsers asking for /favicon.ico.
  icons: { icon: 'data:,' },
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
        {children}
      </body>
    </html>
  );
}
