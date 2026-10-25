// Copies all data from the Railway Postgres + upload volume into D1 + R2. Railway is only read.
//
//   node migrate/run.mjs                          rehearsal: Railway -> local D1/R2 (wrangler dev state)
//   node migrate/run.mjs --target remote --replace   Railway -> production D1/R2 (replaces all D1 rows)
//
// Options:
//   --source railway|sqlite   sqlite reads PY_SQLITE (default /tmp/petapp-diff.db) with the local backend venv
//   --skip-data / --skip-uploads
//
// The D1 import deletes every row first, so it can be re-run for the final resync before cutover.
// Never run it against remote after cutover: it would replace live D1 data with the old Railway copy.
//
//   node migrate/run.mjs --target remote --catchup
// After cutover: copies rows that changed on Railway since the last full import (while DNS was still
// pointing some clients at Railway) and uploads new files. Rows are upserted by id; rows deleted on
// Railway are only reported.
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(HERE, '..');
const BACKEND_DIR = join(API_DIR, '..', '..', 'backend');
const OUT = join(API_DIR, 'migrate-out');
const BUCKET = 'pethaii-uploads';

const args = process.argv.slice(2);
const opt = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined;
};
const target = opt('target') ?? 'local';
const source = opt('source') ?? 'railway';
if (!['local', 'remote'].includes(target)) throw new Error('--target must be local or remote');
if (target === 'remote' && !opt('replace') && !opt('catchup')) {
  console.error('Refusing to touch remote D1 without --replace (it deletes every D1 row before importing).');
  process.exit(1);
}
const where = target === 'remote' ? '--remote' : '--local';

function run(cmd, cmdArgs, {cwd = API_DIR, input} = {}) {
  const res = spawnSync(cmd, cmdArgs, {cwd, input, maxBuffer: 1 << 30, encoding: 'buffer'});
  if (res.status !== 0) {
    const output = `${res.stdout?.toString() ?? ''}\n${res.stderr?.toString() ?? ''}`.trim();
    throw new Error(`${cmd} ${cmdArgs.slice(0, 3).join(' ')} failed (${res.status}):\n${output.slice(-2000)}`);
  }
  return res.stdout;
}

function between(output) {
  const text = output.toString('utf8');
  const start = text.indexOf('@@BEGIN\n');
  const end = text.lastIndexOf('@@END');
  if (start < 0 || end < 0) throw new Error(`markers not found in output:\n${text.slice(0, 500)}`);
  return text.slice(start + '@@BEGIN\n'.length, end);
}

function railway(shellCommand) {
  return run('railway', ['ssh', '--service', 'api', '--', 'sh', '-c', shellCommand], {cwd: BACKEND_DIR});
}

// ---------- data ----------

function exportRows() {
  const script = readFileSync(join(HERE, 'export_pg.py'));
  if (source === 'sqlite') {
    const sqlite = process.env.PY_SQLITE ?? '/tmp/petapp-diff.db';
    const res = spawnSync(join(BACKEND_DIR, '.venv/bin/python'), ['-'], {
      cwd: BACKEND_DIR,
      input: script,
      maxBuffer: 1 << 30,
      env: {...process.env, DATABASE_URL: `sqlite:///${sqlite}`, SECRET_KEY: 'export-only-secret-key-32-bytes-long!', APP_ENV: 'test'},
    });
    if (res.status !== 0) throw new Error(res.stderr.toString());
    return between(res.stdout);
  }
  const b64 = script.toString('base64');
  return between(railway(`cd /app && echo ${b64} | base64 -d | PYTHONIOENCODING=utf-8 python -`));
}

const sqlValue = v => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`non-finite number ${v}`);
    return String(v);
  }
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replaceAll("'", "''")}'`;
};

function d1Json(sql) {
  const out = run('npx', ['wrangler', 'd1', 'execute', 'DB', where, '--json', '--command', sql]);
  return JSON.parse(out.toString())[0].results;
}

function migrateData() {
  console.log(`Exporting rows from ${source}...`);
  const lines = exportRows().split('\n').filter(Boolean);
  writeFileSync(join(OUT, 'data.jsonl'), lines.join('\n') + '\n');
  const tables = [];
  const counts = {};
  const inserts = [];
  for (const line of lines) {
    const {t, r} = JSON.parse(line);
    if (!(t in counts)) {
      tables.push(t);
      counts[t] = 0;
    }
    counts[t]++;
    const cols = Object.keys(r);
    inserts.push(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(c => sqlValue(r[c])).join(', ')});`);
  }

  const existing = d1Json("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'").map(
    row => row.name,
  );
  const missing = tables.filter(t => !existing.includes(t));
  if (missing.length) throw new Error(`D1 is missing tables: ${missing.join(', ')}`);

  const sql = [
    'PRAGMA defer_foreign_keys = true;',
    ...[...existing].reverse().map(t => `DELETE FROM ${t};`),
    ...inserts,
  ].join('\n');
  const file = join(OUT, 'import.sql');
  writeFileSync(file, sql + '\n');
  console.log(`Importing ${lines.length} rows into ${target} D1...`);
  run('npx', ['wrangler', 'd1', 'execute', 'DB', where, '--file', file, '--yes']);

  const imported = d1Json(`SELECT ${tables.map(t => `(SELECT COUNT(*) FROM ${t}) AS ${t}`).join(', ')}`)[0];
  let ok = true;
  for (const t of tables) {
    const mark = imported[t] === counts[t] ? 'ok' : 'MISMATCH';
    if (mark !== 'ok') ok = false;
    console.log(`  ${t.padEnd(32)} ${String(counts[t]).padStart(6)} -> ${String(imported[t]).padStart(6)}  ${mark}`);
  }
  if (!ok) throw new Error('Row counts differ after import');
  writeFileSync(join(OUT, `baseline-${target}.jsonl`), lines.join('\n') + '\n');
}

function catchupData() {
  const baselineFile = join(OUT, `baseline-${target}.jsonl`);
  const key = line => {
    const {t, r} = JSON.parse(line);
    return `${t}:${r.id}`;
  };
  const baseline = new Map(readFileSync(baselineFile, 'utf8').split('\n').filter(Boolean).map(line => [key(line), line]));
  console.log(`Exporting rows from ${source} to compare with the last full import...`);
  const lines = exportRows().split('\n').filter(Boolean);
  const current = new Map(lines.map(line => [key(line), line]));

  const upserts = [];
  const changed = [];
  for (const [k, line] of current) {
    if (baseline.get(k) === line) continue;
    const {t, r} = JSON.parse(line);
    const cols = Object.keys(r);
    const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`);
    upserts.push(
      `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(c => sqlValue(r[c])).join(', ')})` +
        ` ON CONFLICT(id) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'};`,
    );
    changed.push(`${baseline.has(k) ? 'changed' : 'new'}  ${k}`);
  }
  const deleted = [...baseline.keys()].filter(k => !current.has(k));

  console.log(`${changed.length} new/changed rows, ${deleted.length} deleted on Railway since the last import.`);
  for (const line of changed) console.log(`  ${line}`);
  for (const k of deleted) console.log(`  deleted on Railway (not applied): ${k}`);
  if (upserts.length) {
    const file = join(OUT, 'catchup.sql');
    writeFileSync(file, ['PRAGMA defer_foreign_keys = true;', ...upserts].join('\n') + '\n');
    run('npx', ['wrangler', 'd1', 'execute', 'DB', where, '--file', file, '--yes']);
    console.log(`Applied to ${target} D1.`);
  }
  writeFileSync(baselineFile, lines.join('\n') + '\n');
}

// ---------- uploads ----------

const CONTENT_TYPES = {'.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'};

function putUpload(dir, name) {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  run('npx', [
    'wrangler', 'r2', 'object', 'put', `${BUCKET}/uploads/${name}`, where,
    '--file', join(dir, name),
    '--content-type', CONTENT_TYPES[ext] ?? 'application/octet-stream',
    '--cache-control', 'public, max-age=31536000, immutable',
  ]);
  console.log(`  ${name}`);
}

function catchupUploads() {
  const dir = join(OUT, 'uploads');
  mkdirSync(dir, {recursive: true});
  const known = new Set(readdirSync(dir));
  const remote = between(railway('echo @@BEGIN; ls -1 /data/uploads; echo @@END')).split('\n').map(s => s.trim()).filter(Boolean);
  const fresh = remote.filter(name => !known.has(name) && /^[\w.-]+$/.test(name));
  console.log(`${fresh.length} new upload files on Railway.`);
  if (!fresh.length) return;
  const b64 = between(railway(`echo @@BEGIN; cd /data/uploads && tar -cf - ${fresh.join(' ')} | base64; echo @@END`));
  run('tar', ['-xf', '-', '-C', dir], {input: Buffer.from(b64.replace(/\s+/g, ''), 'base64')});
  for (const name of fresh) putUpload(dir, name);
}

function migrateUploads() {
  const dir = join(OUT, 'uploads');
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  if (source === 'sqlite') {
    console.log('Uploads are only copied from Railway; skipping for the sqlite source.');
    return;
  }
  console.log('Downloading uploads from Railway...');
  const b64 = between(railway('echo @@BEGIN; cd /data/uploads && tar -cf - . | base64; echo @@END'));
  run('tar', ['-xf', '-', '-C', dir], {input: Buffer.from(b64.replace(/\s+/g, ''), 'base64')});

  const files = readdirSync(dir).filter(name => statSync(join(dir, name)).isFile());
  console.log(`Uploading ${files.length} files to ${target} R2...`);
  for (const name of files) putUpload(dir, name);
}

mkdirSync(OUT, {recursive: true});
if (opt('catchup')) {
  if (!opt('skip-data')) catchupData();
  if (!opt('skip-uploads')) catchupUploads();
} else {
  if (!opt('skip-data')) migrateData();
  if (!opt('skip-uploads')) migrateUploads();
}
console.log('Done.');
