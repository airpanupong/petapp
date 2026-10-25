// Deploys the API Worker with its secrets copied from the Railway api service, so existing JWTs,
// web push subscriptions and email keep working. Secret values are never printed; they go through a
// temporary owner-only file that is removed right after the deploy.
//
//   node migrate/deploy.mjs
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND_DIR = join(API_DIR, '..', '..', 'backend');
const SECRETS = ['SECRET_KEY', 'RESEND_API_KEY', 'VAPID_PRIVATE_KEY', 'SUPER_ADMIN_PASSWORD'];

const vars = spawnSync('railway', ['variables', '--service', 'api', '--json'], {cwd: BACKEND_DIR, encoding: 'utf8'});
if (vars.status !== 0) throw new Error('Could not read Railway variables');
const all = JSON.parse(vars.stdout);
const secrets = Object.fromEntries(SECRETS.map(name => [name, all[name] ?? '']));
const missing = SECRETS.filter(name => !secrets[name]);
if (missing.length) throw new Error(`Railway is missing: ${missing.join(', ')}`);

const dir = mkdtempSync(join(tmpdir(), 'pethaii-secrets-'));
const file = join(dir, 'secrets.json');
try {
  writeFileSync(file, JSON.stringify(secrets), {mode: 0o600});
  const res = spawnSync('npx', ['wrangler', 'deploy', '--secrets-file', file], {cwd: API_DIR, stdio: 'inherit'});
  process.exitCode = res.status ?? 1;
} finally {
  rmSync(dir, {recursive: true, force: true});
}
