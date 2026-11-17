'use client';

import { useSyncExternalStore } from 'react';

type Choice = 'system' | 'light' | 'dark';

const listeners = new Set<() => void>();

function read(): Choice {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: Choice) {
  try {
    if (choice === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', choice);
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  if (choice === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', choice);
  listeners.forEach((l) => l());
}

export function ThemeSelect() {
  const choice = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => 'system' as Choice,
  );

  return (
    <label className="flex items-center gap-2 text-muted">
      <span>Theme</span>
      <select
        className="field w-auto min-h-[36px] py-1 text-ink"
        value={choice}
        onChange={(e) => apply(e.target.value as Choice)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

/** Runs in <head> before paint so a saved choice never flashes the other theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
