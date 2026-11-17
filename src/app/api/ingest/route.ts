import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ingestBody, storeRun } from '@/lib/ingest/store';

function authorized(request: Request): boolean {
  const expected = process.env.INGEST_TOKEN;
  // An unset or short token would make the endpoint open to anyone who finds it.
  if (!expected || expected.length < 16) return false;
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'Missing or wrong ingest token.' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const body = ingestBody.safeParse(json);
  if (!body.success) {
    return Response.json({ error: 'Body does not match the ingest format.', issues: z.treeifyError(body.error) }, { status: 400 });
  }

  const stored = await storeRun(body.data);
  const origin = new URL(request.url).origin;
  return Response.json({ ...stored, url: `${origin}/runs/${stored.runId}` }, { status: 201 });
}
