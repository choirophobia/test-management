'use client';

/**
 * A GET filter form. Next keeps visited pages mounted but hidden, and a hidden form keeps whatever
 * was selected in it; resetting on hide means returning to a list shows the filters in its URL.
 */
export function FilterForm({ action, className, children }: { action: string; className?: string; children: React.ReactNode }) {
  return (
    <form action={action} className={className} ref={(form) => () => form?.reset()}>
      {children}
    </form>
  );
}
