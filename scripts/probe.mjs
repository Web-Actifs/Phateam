import pg from 'pg';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]; })
);
const REF = 'ipegezhjqdvbnyaxjdzq';
const PWD = env.SUPABASE_DB_PASSWORD;

const regions = ['eu-west-3','eu-central-1','eu-west-1','eu-central-2','us-east-1','us-east-2'];
const candidates = [
  { label:'direct (IPv6)', host:`db.${REF}.supabase.co`, port:5432, user:'postgres' },
];
for (const p of ['aws-0','aws-1']) for (const r of regions)
  candidates.push({ label:`pooler ${p}-${r}`, host:`${p}-${r}.pooler.supabase.com`, port:5432, user:`postgres.${REF}` });

const tryOne = async (c) => {
  const client = new pg.Client({
    host:c.host, port:c.port, user:c.user, password:PWD, database:'postgres',
    ssl:{ rejectUnauthorized:false }, connectionTimeoutMillis:6000,
  });
  try {
    await client.connect();
    const r = await client.query('select current_database() db, version() v');
    await client.end();
    return { ok:true, ...c, db:r.rows[0].db, v:r.rows[0].v.split(',')[0] };
  } catch (e) {
    try { await client.end(); } catch {}
    return { ok:false, ...c, err:(e.message||'').slice(0,70) };
  }
};

const results = await Promise.all(candidates.map(tryOne));
for (const r of results) console.log(`${r.ok?'✅':'❌'} ${r.label.padEnd(22)} ${r.ok ? r.v : r.err}`);
const win = results.find(r => r.ok);
if (win) console.log(`\nGAGNANT: host=${win.host} user=${win.user}`);
else console.log('\nAucune connexion établie.');
