// Runs the lost-post check-in job on both APIs against the same three cases and compares the outcome:
// a week-old post (gets asked), a post asked a week ago (auto-cancelled) and a fresh post (untouched).
//
//   SECRET_KEY=... node test/cron-diff.mjs
// Needs the Python API on :8001 (SQLite at PY_SQLITE) and `wrangler dev` on :8787 with EXTERNAL_EFFECTS=on.
import {execFileSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'backend');
const PY_SQLITE = process.env.PY_SQLITE ?? '/tmp/petapp-diff.db';
const DAY = 86_400_000;

async function setup(base) {
  const api = `${base}/api/v1`;
  const j = async (path, opts = {}) =>
    (await fetch(api + path, {...opts, headers: {'content-type': 'application/json', ...(opts.headers ?? {})}})).json();
  const reg = await j('/auth/register', {
    method: 'POST',
    body: JSON.stringify({email: `cron-${Date.now()}-${Math.random()}@example.org`, password: 'password123', display_name: 'c', accept_privacy: true, accept_data_access: true}),
  });
  const auth = {Authorization: `Bearer ${reg.data.access_token}`};
  const posts = {};
  for (const name of ['week', 'asked', 'fresh']) {
    const pet = await j('/pets', {method: 'POST', headers: auth, body: JSON.stringify({name: `น้อง${name}`, animal_type: 'dog'})});
    const lost = await j('/lost-posts', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({pet_id: pet.data.id, lost_at: '2026-09-20T10:00:00Z', latitude: 13.75, longitude: 100.5}),
    });
    posts[name] = {pet: pet.data.id, lost: lost.data.id};
  }
  const read = async () => {
    const out = {};
    for (const [name, ids] of Object.entries(posts)) {
      const lost = (await j(`/lost-posts/${ids.lost}`, {headers: auth})).data;
      const pet = (await j(`/pets/${ids.pet}`, {headers: auth})).data;
      out[name] = {
        post_status: lost.status,
        asked: lost.checkin_asked_at !== null,
        deadline: lost.checkin_deadline_at !== null,
        pet_status: pet.status,
      };
    }
    out.notifications = (await j('/notifications', {headers: auth})).data
      .map(n => ({type: n.type, title: n.title, body: n.body, reference_type: n.reference_type, is_read: n.is_read}))
      .sort((a, b) => a.title.localeCompare(b.title));
    return out;
  };
  return {posts, read};
}

function runPython(posts) {
  const script = `
from datetime import timedelta
from app.core.database import SessionLocal
from app.models.lost_found import LostPost
from app.services.lost_checkin_service import _utcnow, run_lost_checkins
db = SessionLocal()
now = _utcnow()
week = db.get(LostPost, "${posts.week.lost}")
week.created_at = now - timedelta(days=8)
week.checkin_base_at = now - timedelta(days=8)
asked = db.get(LostPost, "${posts.asked.lost}")
asked.checkin_asked_at = now - timedelta(days=8)
db.commit()
print(run_lost_checkins(db))
`;
  return execFileSync(join(BACKEND, '.venv/bin/python'), ['-c', script], {
    cwd: BACKEND,
    env: {...process.env, DATABASE_URL: `sqlite:///${PY_SQLITE}`, APP_ENV: 'test', SECRET_KEY: process.env.SECRET_KEY ?? 'x'.repeat(40)},
  })
    .toString()
    .trim();
}

async function runWorker(posts) {
  const ago = new Date(Date.now() - 8 * DAY).toISOString();
  const sql =
    `UPDATE lost_posts SET created_at='${ago}', checkin_base_at='${ago}' WHERE id='${posts.week.lost}'; ` +
    `UPDATE lost_posts SET checkin_asked_at='${ago}' WHERE id='${posts.asked.lost}'`;
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--command', sql], {stdio: 'ignore'});
  const res = await fetch('http://127.0.0.1:8787/cdn-cgi/handler/scheduled');
  await res.text();
  return res.status;
}

const py = await setup('http://127.0.0.1:8001');
const cf = await setup('http://127.0.0.1:8787');
console.log('python job:', runPython(py.posts));
console.log('worker job status:', await runWorker(cf.posts));
await new Promise(r => setTimeout(r, 500));
const [a, b] = [await py.read(), await cf.read()];
console.log('python:', JSON.stringify(a, null, 1));
const same = JSON.stringify(a) === JSON.stringify(b);
if (!same) console.log('worker:', JSON.stringify(b, null, 1));
console.log(same ? 'MATCH' : 'DIFF');
process.exit(same ? 0 : 1);
