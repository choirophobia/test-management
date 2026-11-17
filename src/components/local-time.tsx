'use client';

import { useId } from 'react';

const OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Times are shown in the reader's own zone (the team spans time zones; the server runs in UTC).
 * The inline script corrects the server-rendered text before paint on a full load; on client
 * navigations this component renders in the browser and formats directly.
 */
export function LocalTime({ date }: { date: Date | string }) {
  const id = useId();
  const iso = typeof date === 'string' ? date : date.toISOString();
  return (
    <>
      <time id={id} dateTime={iso} suppressHydrationWarning className="whitespace-nowrap">
        {new Date(iso).toLocaleString('en-GB', OPTIONS)}
      </time>
      <InlineScript
        html={`{var n=document.getElementById(${JSON.stringify(id)});if(n)n.textContent=new Date(${JSON.stringify(iso)}).toLocaleString("en-GB",${JSON.stringify(OPTIONS)})}`}
      />
    </>
  );
}
