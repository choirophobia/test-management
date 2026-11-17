import 'server-only';
import { appendFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import { LINK_MINUTES } from './rules';

export type MailResult = { ok: true } | { ok: false; reason: string };

/** Which way sign-in emails leave the app, if any. Checked before a link is created. */
export function mailMode(): 'smtp' | 'file' | 'console' | null {
  if (process.env.SMTP_URL) return 'smtp';
  // Tests only: writes each email as one JSON line so a test can read the link.
  if (process.env.MAIL_OUTBOX_FILE) return 'file';
  if (process.env.NODE_ENV !== 'production') return 'console';
  return null;
}

export async function sendSignInEmail(to: string, link: string): Promise<MailResult> {
  const subject = 'Your sign-in link for MSL Test Hub';
  const text = [
    'Use this link to sign in to MSL Test Hub:',
    '',
    link,
    '',
    `It works once and expires in ${LINK_MINUTES} minutes. If you did not ask for it, you can ignore this email.`,
  ].join('\n');
  const html = `<p>Use this link to sign in to MSL Test Hub:</p>
<p><a href="${link}">Sign in to MSL Test Hub</a></p>
<p>It works once and expires in ${LINK_MINUTES} minutes. If you did not ask for it, you can ignore this email.</p>`;

  switch (mailMode()) {
    case 'smtp': {
      try {
        const transport = nodemailer.createTransport(process.env.SMTP_URL);
        await transport.sendMail({ from: process.env.MAIL_FROM ?? 'MSL Test Hub <no-reply@localhost>', to, subject, text, html });
        return { ok: true };
      } catch (error) {
        console.error('Sign-in email failed:', error instanceof Error ? error.message : error);
        return { ok: false, reason: 'The email could not be sent. Try again in a minute.' };
      }
    }
    case 'file':
      await appendFile(process.env.MAIL_OUTBOX_FILE!, `${JSON.stringify({ to, subject, link, at: new Date().toISOString() })}\n`);
      return { ok: true };
    case 'console':
      console.log(`\nSign-in link for ${to} (no SMTP_URL set, so it is printed here instead of emailed):\n${link}\n`);
      return { ok: true };
    default:
      return { ok: false, reason: 'Sign-in emails are not set up on this server (SMTP_URL is missing).' };
  }
}
