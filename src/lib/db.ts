import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import { connection } from 'next/server';
import postgres from 'postgres';
import * as schema from '@/db/schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.');

// One pool per server process; dev hot reload would otherwise open a new pool on every edit.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };
const client = globalForDb.sql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== 'production') globalForDb.sql = client;

export const db = drizzle(client, { schema });

/** Every page read goes through this: results are live, so they are never part of a prerendered shell. */
export async function liveDb() {
  await connection();
  return db;
}
