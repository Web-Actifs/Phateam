import pg from 'pg';
import fs from 'fs';

export function env() {
  return Object.fromEntries(
    fs.readFileSync('.env.local','utf8').split(/\r?\n/)
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]; })
  );
}

export async function connect() {
  const e = env();
  const client = new pg.Client({
    host: e.SUPABASE_DB_HOST, port: 5432, user: e.SUPABASE_DB_USER,
    password: e.SUPABASE_DB_PASSWORD, database: 'postgres',
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
  });
  await client.connect();
  return client;
}
