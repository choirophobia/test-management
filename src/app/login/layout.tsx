import { ThemeSelect } from '@/components/theme-select';

export default function LoginLayout({ children }: LayoutProps<'/login'>) {
  return (
    <>
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 px-4 py-1">
          <span className="inline-flex min-h-[44px] items-center font-semibold">MSL Test Hub</span>
          <div className="ml-auto">
            <ThemeSelect />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[440px] flex-1 px-4 py-10">
        {children}
      </main>
    </>
  );
}
