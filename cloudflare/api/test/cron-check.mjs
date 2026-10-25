// Compares the lost-post check-in job of both APIs: a week-old post gets a "found yet?" question, and a
// question left unanswered for 7 days auto-cancels the post. Posts are backdated directly in each database.
//
//   node test/cron-check.mjs <python-base> <worker-base>
// The Worker must run with --var EXTERNAL_EFFECTS:on (the cron is a no-op otherwise). The Python job is
// run in-process against PY_SQLITE; CF_PERSIST is the Worker's --persist-to directory.
import {execFileSync} from 'node:child_process';

const [pyBase, cfBase] = process.argv.slice(2);
const PY_SQLITE = process.env.PY_SQLITE ?? '/tmp/petapp-diff.db';
const BACKEND = new URL('../../../backend/', import.meta.url).pathname;
const persist = process.env.CF_PERSIST ? ['--persist-to', process.env.CF_PERSIST] : [];

function sql(kind, statement) {
  if (kind === 'py') execFileSync('sqlite3', [PY_SQLITE, statement]);
  else execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '--command', statement], {stdio: 'ignore'});
}

const daysAgo = (kind, days) =>
  kind === 'py' ? `datetime('now', '-${days} days')` : `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${days} days')`;

async function runJob(kind, base) {
  if (kind === 'py') {
    execFileSync(`${BACKEND}.venv/bin/python`, ['-c', 'from app.core.database import SessionLocal\nfrom app.services.lost_checkin_service import run_lost_checkins\nprint(run_lost_checkins(SessionLocal()))'], {
      cwd: BACKEND,
      env: {...process.env, DATABASE_URL: `sqlite:///${PY_SQLITE}`, APP_ENV: 'test'},
      stdio: 'ignore',
    });
  } else {
    const res = await fetch(`${base}/cdn-cgi/local/scheduled`);
    if (!res.ok) throw new Error(`scheduled trigger failed: ${res.status}`);
    await new Promise(r => setTimeout(r, 500));
  }
}

async function scenario(kind, base) {
  const api = `${base}/api/v1`;
  const call = async (method, path, token, body) => {
    const res = await fetch(`${api}${path}`, {
      method,
      headers: {'content-type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };
  const register = async name =>
    (
      await call('POST', '/auth/register', null, {
        email: `${name}-${kind}-${Date.now()}@example.org`,
        password: 'password123',
        display_name: name,
        accept_privacy: true,
        accept_data_access: true,
      })
    ).data.access_token;
  const owner = await register('owner');
  const follower = await register('follower');
  const pet = (await call('POST', '/pets', owner, {name: 'Tora', animal_type: 'dog'})).data;
  const post = (await call('POST', '/lost-posts', owner, {pet_id: pet.id, lost_at: '2026-09-20T08:00:00Z', latitude: 13.7, longitude: 100.5})).data;
  await call('POST', `/lost-posts/${post.id}/follow`, follower);

  const snapshot = async () => {
    const p = (await call('GET', `/lost-posts/${post.id}`, owner)).data;
    const notes = (await call('GET', '/notifications', owner)).data;
    return {
      post_status: p?.status ?? '(hidden from owner)',
      asked: Boolean(p?.checkin_asked_at),
      deadline: Boolean(p?.checkin_deadline_at),
      pet_status: (await call('GET', `/pets/${pet.id}`, owner)).data.status,
      owner_notifications: notes.map(n => ({type: n.type, title: n.title, body: n.body, ref: n.reference_type, read: n.is_read})),
      follower_notifications: (await call('GET', '/notifications', follower)).data.map(n => ({type: n.type, title: n.title})),
    };
  };

  const steps = {};
  steps.fresh = await snapshot();
  sql(kind, `UPDATE lost_posts SET created_at = ${daysAgo(kind, 8)}, checkin_base_at = NULL WHERE id = '${post.id}'`);
  await runJob(kind, base);
  steps.after_week = await snapshot();
  await runJob(kind, base);
  steps.rerun_no_duplicate = await snapshot();
  sql(kind, `UPDATE lost_posts SET checkin_asked_at = ${daysAgo(kind, 8)} WHERE id = '${post.id}'`);
  await runJob(kind, base);
  steps.after_no_answer = await snapshot();
  return steps;
}

const py = await scenario('py', pyBase);
const cf = await scenario('cf', cfBase);
let differences = 0;
for (const step of Object.keys(py)) {
  const same = JSON.stringify(py[step]) === JSON.stringify(cf[step]);
  if (!same) differences++;
  console.log(`${same ? '✓' : '✗'} ${step}`);
  console.log(`    python: ${JSON.stringify(py[step])}`);
  if (!same) console.log(`    worker: ${JSON.stringify(cf[step])}`);
}
process.exit(differences ? 1 : 0);
