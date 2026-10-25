// Differential contract test: runs one scenario against the Python API and the Worker and compares
// status codes, error codes and JSON shapes (keys and value types) of every response.
//
//   node test/contract.mjs <python-base> <worker-base>
//   (defaults: http://127.0.0.1:8001 and http://127.0.0.1:8787)
//
// Start both APIs on empty databases: global lists (feed, admin lists) are compared by length too.
//
// Admin steps promote a user directly in each database, so it needs the local SQLite path of the
// Python API (PY_SQLITE, default /tmp/petapp-diff.db) and runs `wrangler d1 execute --local` for the Worker
// (CF_PERSIST when wrangler dev runs with --persist-to).
//
// Both APIs must run with the same SECRET_KEY (env SECRET_KEY here) so the test can plant a known
// password reset code; the real code only goes out by email.
import {execFileSync} from 'node:child_process';
import {createHmac} from 'node:crypto';

const [pyBase = 'http://127.0.0.1:8001', cfBase = 'http://127.0.0.1:8787'] = process.argv.slice(2);
const PY_SQLITE = process.env.PY_SQLITE ?? '/tmp/petapp-diff.db';
const SECRET_KEY = process.env.SECRET_KEY;
const RUN = Date.now().toString(36);

function sql(kind, statement) {
  if (kind === 'py') return execFileSync('sqlite3', [PY_SQLITE, statement]).toString().trim();
  const persist = process.env.CF_PERSIST ? ['--persist-to', process.env.CF_PERSIST] : [];
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', ...persist, '--json', '--command', statement]);
  return JSON.parse(out.toString())[0].results;
}

function promote(kind, email, role) {
  sql(kind, `UPDATE users SET role='${role}' WHERE email='${email}'`);
}

function plantResetCode(kind, email, code) {
  if (!SECRET_KEY) throw new Error('Set SECRET_KEY to the key both APIs run with');
  const rows = sql(kind, `SELECT id FROM users WHERE email='${email}'`);
  const userId = kind === 'py' ? rows : rows[0].id;
  const hash = createHmac('sha256', SECRET_KEY).update(`${userId}:${code}`).digest('hex');
  sql(kind, `UPDATE password_reset_codes SET code_hash='${hash}' WHERE user_id='${userId}'`);
}

const PNG_1PX = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  c => c.charCodeAt(0),
);

async function scenario(kind, base) {
  const api = `${base}/api/v1`;
  const log = [];
  const tokens = {};

  async function call(label, method, path, {body, as, form, raw} = {}) {
    const headers = {};
    if (as) headers.Authorization = `Bearer ${tokens[as]}`;
    let payload;
    if (form) payload = form;
    else if (raw !== undefined) {
      payload = raw;
      headers['Content-Type'] = 'application/json';
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${api}${path}`, {method, headers, body: payload});
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = {__text: text.slice(0, 80)};
    }
    log.push({label, status: res.status, json});
    return json;
  }

  const email = n => `${n}-${kind}-${RUN}@example.org`;
  const register = async (n, extra = {}) => {
    const r = await call(`register ${n}`, 'POST', '/auth/register', {
      body: {email: email(n), password: 'password123', display_name: n, accept_privacy: true, accept_data_access: true, ...extra},
    });
    if (r?.data?.access_token) {
      tokens[n] = r.data.access_token;
      tokens[`${n}_refresh`] = r.data.refresh_token;
    }
    return r?.data?.user;
  };

  const alice = await register('alice');
  const bob = await register('bob');
  const boss = await register('boss');
  await call('register no consent', 'POST', '/auth/register', {
    body: {email: email('x'), password: 'password123', display_name: 'x'},
  });
  await call('register duplicate', 'POST', '/auth/register', {
    body: {email: email('alice'), password: 'password123', display_name: 'a', accept_privacy: true, accept_data_access: true},
  });
  await call('register invalid', 'POST', '/auth/register', {body: {email: 'nope', password: 'short'}});
  await call('register bad json', 'POST', '/auth/register', {raw: '{bad'});
  await call('login wrong', 'POST', '/auth/login', {body: {email: email('alice'), password: 'wrongpass'}});
  const login = await call('login ok', 'POST', '/auth/login', {body: {email: email('alice'), password: 'password123'}});
  tokens.alice = login.data.access_token;
  const refreshed = await call('refresh', 'POST', '/auth/refresh', {body: {refresh_token: login.data.refresh_token}});
  await call('refresh reused', 'POST', '/auth/refresh', {body: {refresh_token: login.data.refresh_token}});
  await call('refresh garbage', 'POST', '/auth/refresh', {body: {refresh_token: 'abc'}});
  await call('logout', 'POST', '/auth/logout', {body: {refresh_token: refreshed.data.refresh_token}});
  await call('me anon', 'GET', '/users/me');
  await call('me bad token', 'GET', '/users/me', {as: 'nobody'});
  await call('me', 'GET', '/users/me', {as: 'alice'});
  await call('patch me', 'PATCH', '/users/me', {as: 'alice', body: {phone: '0812345678', display_name: 'Alice A'}});
  await call('forgot unknown', 'POST', '/auth/password/forgot', {body: {email: email('ghost')}});
  await call('forgot', 'POST', '/auth/password/forgot', {body: {email: email('bob')}});
  await call('forgot cooldown', 'POST', '/auth/password/forgot', {body: {email: email('bob')}});
  await call('verify wrong code', 'POST', '/auth/password/verify', {body: {email: email('bob'), code: '000000'}});
  await call('verify bad format', 'POST', '/auth/password/verify', {body: {email: email('bob'), code: '12'}});
  plantResetCode(kind, email('bob'), '424242');
  await call('verify code', 'POST', '/auth/password/verify', {body: {email: email('bob'), code: '424242'}});
  await call('reset short password', 'POST', '/auth/password/reset', {body: {email: email('bob'), code: '424242', new_password: 'short'}});
  const reset = await call('reset password', 'POST', '/auth/password/reset', {
    body: {email: email('bob'), code: '424242', new_password: 'newpass1234'},
  });
  await call('reset reused code', 'POST', '/auth/password/reset', {body: {email: email('bob'), code: '424242', new_password: 'newpass1234'}});
  await call('refresh after reset', 'POST', '/auth/refresh', {body: {refresh_token: tokens.bob_refresh}});
  await call('login old password', 'POST', '/auth/login', {body: {email: email('bob'), password: 'password123'}});
  await call('login new password', 'POST', '/auth/login', {body: {email: email('bob'), password: 'newpass1234'}});
  tokens.bob = reset.data.access_token;

  // Pets
  const pet = (
    await call('create pet', 'POST', '/pets', {
      as: 'alice',
      body: {name: 'Mochi', animal_type: 'cat', breed: 'สก็อตติช โฟลด์', color: 'ขาว', weight: 4.5, birth_date: '2022-05-01', gender: 'female'},
    })
  ).data;
  await call('create pet invalid', 'POST', '/pets', {as: 'alice', body: {name: '', animal_type: 'fish'}});
  await call('list pets', 'GET', '/pets', {as: 'alice'});
  await call('get pet', 'GET', `/pets/${pet.id}`, {as: 'alice'});
  await call('get pet other', 'GET', `/pets/${pet.id}`, {as: 'bob'});
  await call('get pet missing', 'GET', '/pets/nope', {as: 'alice'});
  await call('patch pet', 'PATCH', `/pets/${pet.id}`, {as: 'alice', body: {description: 'fluffy', weight: '5', microchip_id: '123'}});
  const img1 = (await call('add image', 'POST', `/pets/${pet.id}/images`, {as: 'alice', body: {image_url: 'https://x/1.jpg'}})).data;
  const img2 = (await call('add image 2', 'POST', `/pets/${pet.id}/images`, {as: 'alice', body: {image_url: 'https://x/2.jpg'}})).data;
  await call('list images', 'GET', `/pets/${pet.id}/images`, {as: 'alice'});
  await call('primary image', 'POST', `/pets/${pet.id}/images/${img2.id}/primary`, {as: 'alice'});
  await call('delete image', 'DELETE', `/pets/${pet.id}/images/${img2.id}`, {as: 'alice'});
  await call('delete image missing', 'DELETE', `/pets/${pet.id}/images/nope`, {as: 'alice'});
  void img1;
  const guardian = (
    await call('add guardian', 'POST', `/pets/${pet.id}/guardians`, {as: 'alice', body: {email: email('bob'), can_edit: true}})
  ).data;
  await call('add guardian dup', 'POST', `/pets/${pet.id}/guardians`, {as: 'alice', body: {email: email('bob')}});
  await call('add guardian self', 'POST', `/pets/${pet.id}/guardians`, {as: 'alice', body: {email: email('alice')}});
  await call('add guardian unknown', 'POST', `/pets/${pet.id}/guardians`, {as: 'alice', body: {email: email('ghost')}});
  await call('list guardians', 'GET', `/pets/${pet.id}/guardians`, {as: 'alice'});
  await call('patch guardian', 'PATCH', `/pets/${pet.id}/guardians/${guardian.id}`, {as: 'alice', body: {can_mark_lost: false}});
  await call('get health', 'GET', `/pets/${pet.id}/health`, {as: 'alice'});
  await call('put health', 'PUT', `/pets/${pet.id}/health`, {as: 'alice', body: {allergies: 'fish', vet_name: 'Dr. A'}});
  const vac = (
    await call('add vaccine', 'POST', `/pets/${pet.id}/vaccinations`, {
      as: 'alice',
      body: {name: 'Rabies', given_at: '2026-01-10', next_due_at: '2027-01-10'},
    })
  ).data;
  await call('add vaccine bad date', 'POST', `/pets/${pet.id}/vaccinations`, {as: 'alice', body: {name: 'X', given_at: '2026-13-40'}});
  await call('list vaccines', 'GET', `/pets/${pet.id}/vaccinations`, {as: 'alice'});
  await call('delete vaccine', 'DELETE', `/pets/${pet.id}/vaccinations/${vac.id}`, {as: 'alice'});
  await call('get emergency', 'GET', `/pets/${pet.id}/emergency`, {as: 'alice'});
  await call('put emergency', 'PUT', `/pets/${pet.id}/emergency`, {
    as: 'alice',
    body: {emergency_note: 'shy', emergency_contact_name: 'Alice', emergency_contact_phone: '081', show_contact_phone: true},
  });
  await call('get ownership none', 'GET', `/pets/${pet.id}/ownership-verification`, {as: 'alice'});
  const ov = (
    await call('submit ownership', 'POST', `/pets/${pet.id}/ownership-verification`, {as: 'alice', body: {method: 'photos', evidence_note: 'pics'}})
  ).data;
  await call('get ownership', 'GET', `/pets/${pet.id}/ownership-verification`, {as: 'alice'});

  // Public QR
  await call('public qr', 'GET', `/public/pets/qr/${pet.qr_token}`);
  await call('public qr missing', 'GET', '/public/pets/qr/nope');
  await call('qr contact', 'POST', `/public/pets/qr/${pet.qr_token}/contact`, {as: 'bob'});
  await call('qr found alert', 'POST', `/public/pets/qr/${pet.qr_token}/found-alert`, {
    as: 'bob',
    body: {latitude: 13.75, longitude: 100.5, note: 'near park'},
  });
  await call('qr found alert own', 'POST', `/public/pets/qr/${pet.qr_token}/found-alert`, {as: 'alice', body: {latitude: 13.75, longitude: 100.5}});

  // Locations and preferences
  await call('location alice', 'PUT', '/me/location', {as: 'alice', body: {latitude: 13.75, longitude: 100.5}});
  await call('location bob', 'PUT', '/me/location', {as: 'bob', body: {latitude: 13.751, longitude: 100.501}});
  await call('location invalid', 'PUT', '/me/location', {as: 'bob', body: {latitude: 99, longitude: 100.501}});
  await call('get prefs', 'GET', '/notification-preferences', {as: 'bob'});
  await call('put prefs', 'PUT', '/notification-preferences', {as: 'bob', body: {radius_km: 10, animal_type: 'all'}});
  await call('put prefs invalid', 'PUT', '/notification-preferences', {as: 'bob', body: {radius_km: 100}});

  // Lost posts
  const lost = (
    await call('create lost', 'POST', '/lost-posts', {
      as: 'alice',
      body: {
        pet_id: pet.id,
        lost_at: '2026-09-30T10:00:00Z',
        latitude: 13.75,
        longitude: 100.5,
        location_text: 'Lumpini',
        image_urls: ['https://x/a.jpg', 'https://x/b.jpg', 'https://x/a.jpg'],
        reward_enabled: true,
        reward_text: '1000',
      },
    })
  ).data;
  await call('create lost dup', 'POST', '/lost-posts', {
    as: 'alice',
    body: {pet_id: pet.id, lost_at: '2026-09-30T10:00:00Z', latitude: 13.75, longitude: 100.5},
  });
  await call('list lost', 'GET', '/lost-posts');
  await call('list lost cats', 'GET', '/lost-posts?animal_type=cat');
  await call('list lost hidden', 'GET', '/lost-posts?status=hidden');
  await call('get lost anon', 'GET', `/lost-posts/${lost.id}`);
  await call('get lost missing', 'GET', '/lost-posts/nope');
  await call('patch lost', 'PATCH', `/lost-posts/${lost.id}`, {as: 'alice', body: {description: 'help', image_urls: ['https://x/c.jpg']}});
  await call('patch lost other', 'PATCH', `/lost-posts/${lost.id}`, {as: 'bob', body: {description: 'x'}});
  await call('create sighting', 'POST', `/lost-posts/${lost.id}/sightings`, {
    as: 'bob',
    body: {seen_at: '2026-10-01T08:00:00+07:00', latitude: 13.752, longitude: 100.502, direction: 'north', image_url: 'https://x/s.jpg'},
  });
  await call('list sightings', 'GET', `/lost-posts/${lost.id}/sightings`);
  await call('follow', 'POST', `/lost-posts/${lost.id}/follow`, {as: 'bob'});
  await call('follow again', 'POST', `/lost-posts/${lost.id}/follow`, {as: 'bob'});
  await call('follow status', 'GET', `/lost-posts/${lost.id}/follow`, {as: 'bob'});
  const following = await call('following cases', 'GET', '/me/following-cases?limit=1', {as: 'bob'});
  await call('following cases page 2', 'GET', `/me/following-cases?before=${encodeURIComponent(following.data[0]?.cursor ?? '')}`, {as: 'bob'});
  await call('following bad cursor', 'GET', '/me/following-cases?before=garbage', {as: 'bob'});
  await call('feed anon', 'GET', '/feed');
  await call('feed bob', 'GET', '/feed?kind=lost&animal_type=cat', {as: 'bob'});
  await call('feed alice', 'GET', '/feed', {as: 'alice'});
  await call('feed filter breed', 'GET', '/feed?breed=scottish_fold');
  await call('feed bad limit', 'GET', '/feed?limit=0');
  await call('nearby', 'GET', '/nearby?latitude=13.75&longitude=100.5&radius_km=5');
  await call('nearby lost only', 'GET', '/nearby?latitude=13.75&longitude=100.5&post_type=lost&days=7');
  await call('nearby invalid', 'GET', '/nearby?latitude=200&longitude=100.5');
  await call('my posts', 'GET', '/users/me/posts', {as: 'alice'});
  await call('lost share card', 'POST', `/lost-posts/${lost.id}/share-card`, {as: 'alice'});

  // Found posts
  const found = (
    await call('create found', 'POST', '/found-posts', {
      as: 'bob',
      body: {animal_type: 'cat', color: 'white', found_at: '2026-10-01T09:00:00Z', latitude: 13.7505, longitude: 100.5005, image_url: 'https://x/f.jpg'},
    })
  ).data;
  await call('create found invalid', 'POST', '/found-posts', {as: 'bob', body: {animal_type: 'cow'}});
  await call('list found', 'GET', '/found-posts');
  await call('get found', 'GET', `/found-posts/${found.id}`);
  await call('patch found', 'PATCH', `/found-posts/${found.id}`, {as: 'bob', body: {breed_guess: 'Persian', image_urls: []}});
  await call('patch found other', 'PATCH', `/found-posts/${found.id}`, {as: 'alice', body: {breed_guess: 'x'}});
  await call('contact found', 'POST', `/found-posts/${found.id}/contact`, {as: 'alice'});
  await call('found share card', 'POST', `/found-posts/${found.id}/share-card`, {as: 'bob'});

  // Chat
  const convs = await call('alice conversations', 'GET', '/conversations', {as: 'alice'});
  const convId = convs.data[0]?.id;
  await call('bob unread chat', 'GET', '/conversations/unread-count', {as: 'bob'});
  await call('get conversation', 'GET', `/conversations/${convId}`, {as: 'alice'});
  await call('get conversation other', 'GET', `/conversations/${convId}`, {as: 'boss'});
  await call('send message', 'POST', `/conversations/${convId}/messages`, {as: 'alice', body: {content: 'hello bob'}});
  await call('send empty', 'POST', `/conversations/${convId}/messages`, {as: 'alice', body: {content: ''}});
  await call('send image', 'POST', `/conversations/${convId}/messages`, {as: 'bob', body: {message_type: 'image', image_url: 'https://x/m.jpg'}});
  log.push({
    label: 'legacy ws send',
    status: 0,
    json: await wsLegacy(`${base.replace(/^http/, 'ws')}/api/v1/conversations/ws/${convId}?token=${tokens.alice}`),
  });
  log.push({label: 'legacy ws bad token', status: 0, json: await wsProbe(`${base.replace(/^http/, 'ws')}/api/v1/conversations/ws/${convId}?token=bad`)});
  log.push({label: 'legacy ws not member', status: 0, json: await wsProbe(`${base.replace(/^http/, 'ws')}/api/v1/conversations/ws/${convId}?token=${tokens.boss}`)});
  await call('bob unread chat after', 'GET', '/conversations/unread-count', {as: 'bob'});
  await call('bob messages', 'GET', `/conversations/${convId}/messages`, {as: 'bob'});
  const msgs = await call('bob messages limit', 'GET', `/conversations/${convId}/messages?limit=2`, {as: 'bob'});
  await call('bob conversations', 'GET', '/conversations', {as: 'bob'});
  await call('conversations page', 'GET', `/conversations?before=${encodeURIComponent(convs.data[0]?.cursor ?? '')}`, {as: 'alice'});
  await call('messages page', 'GET', `/conversations/${convId}/messages?before=${encodeURIComponent((msgs.data[0]?.created_at ?? '') + '|' + (msgs.data[0]?.id ?? ''))}`, {as: 'bob'});
  await call('create conversation', 'POST', '/conversations', {as: 'boss', body: {member_user_id: alice.id}});
  await call('create conversation self', 'POST', '/conversations', {as: 'boss', body: {member_user_id: boss.id}});

  // Notifications
  const notes = await call('bob notifications', 'GET', '/notifications', {as: 'bob'});
  await call('alice notifications', 'GET', '/notifications', {as: 'alice'});
  await call('bob unread notifications', 'GET', '/notifications/unread-count', {as: 'bob'});
  await call('notifications page', 'GET', `/notifications?limit=1&before=${encodeURIComponent((notes.data[0]?.created_at ?? '') + '|' + (notes.data[0]?.id ?? ''))}`, {as: 'bob'});
  await call('mark read', 'POST', `/notifications/${notes.data[0]?.id}/read`, {as: 'bob'});
  await call('mark read missing', 'POST', '/notifications/nope/read', {as: 'bob'});
  await call('read all', 'POST', '/notifications/read-all', {as: 'bob'});
  await call('delete notification', 'DELETE', `/notifications/${notes.data[0]?.id}`, {as: 'bob'});
  await call('push config', 'GET', '/push/web/config');
  await call('push subscribe', 'POST', '/push/web/subscriptions', {
    as: 'bob',
    body: {endpoint: 'https://push.example.org/abc', keys: {p256dh: 'BKey', auth: 'auth'}},
  });
  await call('push test', 'POST', '/push/web/test', {as: 'bob'});
  await call('push unsubscribe', 'POST', '/push/web/unsubscribe', {as: 'bob', body: {endpoint: 'https://push.example.org/abc'}});
  await call('device register', 'POST', '/devices', {as: 'bob', body: {platform: 'android', token: 'dev-token-1'}});
  await call('device register again', 'POST', '/devices', {as: 'bob', body: {platform: 'android', token: 'dev-token-1', device_id: 'd1'}});

  // Moderation
  await call('report', 'POST', '/reports', {as: 'bob', body: {target_type: 'lost_post', target_id: lost.id, reason: 'spam'}});
  await call('report invalid', 'POST', '/reports', {as: 'bob', body: {target_type: 'x', target_id: '1', reason: 'spam'}});
  await call('block', 'POST', `/users/${boss.id}/block`, {as: 'bob'});
  await call('block self', 'POST', `/users/${bob.id}/block`, {as: 'bob'});
  await call('blocks', 'GET', '/users/me/blocks', {as: 'bob'});
  await call('chat blocked', 'POST', '/conversations', {as: 'boss', body: {member_user_id: bob.id}});
  await call('unblock', 'DELETE', `/users/${boss.id}/block`, {as: 'bob'});
  await call('ads', 'GET', '/ads?latitude=13.7&longitude=100.5');
  await call('ad event missing', 'POST', '/ads/nope/events', {body: {event_type: 'click'}});

  // Uploads
  const form = new FormData();
  form.append('file', new Blob([PNG_1PX], {type: 'image/png'}), 'dot.png');
  const up = await call('upload', 'POST', '/uploads', {as: 'alice', form});
  const badForm = new FormData();
  badForm.append('file', new Blob(['hello'], {type: 'text/plain'}), 'a.txt');
  await call('upload bad type', 'POST', '/uploads', {as: 'alice', form: badForm});
  await call('presign', 'POST', '/uploads/presign', {as: 'alice', body: {content_type: 'image/png'}});
  const fileName = up?.data?.filename;
  const fileRes = await fetch(`${api}/uploads/files/${fileName}`);
  log.push({label: 'get upload', status: fileRes.status, json: {type: fileRes.headers.get('content-type'), cache: fileRes.headers.get('cache-control')}});
  await fileRes.arrayBuffer();
  await call('get upload missing', 'GET', '/uploads/files/nope.jpg');

  // Admin
  await call('admin metrics forbidden', 'GET', '/admin/metrics', {as: 'boss'});
  promote(kind, email('boss'), 'super_admin');
  await call('admin metrics', 'GET', '/admin/metrics', {as: 'boss'});
  await call('admin users', 'GET', `/admin/users?q=${RUN}&page_size=2`, {as: 'boss'});
  const reports = await call('admin reports', 'GET', '/admin/reports', {as: 'boss'});
  await call('admin resolve report', 'POST', `/admin/reports/${reports.data[0]?.id}/resolve`, {as: 'boss', body: {status: 'dismissed'}});
  await call('admin ownership', 'GET', '/admin/ownership-verifications', {as: 'boss'});
  await call('admin review ownership', 'POST', `/admin/ownership-verifications/${ov.id}/review`, {as: 'boss', body: {status: 'verified'}});
  await call('admin lost posts', 'GET', '/admin/lost-posts', {as: 'boss'});
  await call('admin found posts', 'GET', '/admin/found-posts', {as: 'boss'});
  await call('admin hide lost', 'POST', `/admin/lost-posts/${lost.id}/hide`, {as: 'boss'});
  await call('get hidden lost anon', 'GET', `/lost-posts/${lost.id}`);
  await call('get hidden lost owner', 'GET', `/lost-posts/${lost.id}`, {as: 'alice'});
  await call('admin unhide lost', 'POST', `/admin/lost-posts/${lost.id}/unhide`, {as: 'boss'});
  await call('admin unhide again', 'POST', `/admin/lost-posts/${lost.id}/unhide`, {as: 'boss'});
  await call('admin role', 'POST', `/admin/users/${bob.id}/role`, {as: 'boss', body: {role: 'admin'}});
  await call('admin role invalid', 'POST', `/admin/users/${bob.id}/role`, {as: 'boss', body: {role: 'god'}});
  await call('admin block', 'POST', `/admin/users/${alice.id}/block`, {as: 'boss'});
  await call('blocked user me', 'GET', '/users/me', {as: 'alice'});
  await call('admin unblock', 'POST', `/admin/users/${alice.id}/unblock`, {as: 'boss'});
  await call('public qr verified', 'GET', `/public/pets/qr/${pet.qr_token}`);

  // Lost lifecycle
  await call('checkin answer', 'POST', `/lost-posts/${lost.id}/checkin`, {as: 'alice', body: {found: false}});
  await call('resolve lost', 'POST', `/lost-posts/${lost.id}/resolve`, {as: 'alice'});
  await call('resolve lost again', 'POST', `/lost-posts/${lost.id}/resolve`, {as: 'alice'});
  await call('bob notifications after resolve', 'GET', '/notifications', {as: 'bob'});
  const newLost = async label =>
    (
      await call(label, 'POST', '/lost-posts', {
        as: 'alice',
        body: {pet_id: pet.id, lost_at: '2026-10-01T10:00:00Z', latitude: 13.75, longitude: 100.5},
      })
    ).data;
  const lost2 = await newLost('create lost 2');
  await call('contact lost', 'POST', `/lost-posts/${lost2.id}/contact`, {as: 'boss'});
  await call('contact own lost', 'POST', `/lost-posts/${lost2.id}/contact`, {as: 'alice'});
  await call('checkin other', 'POST', `/lost-posts/${lost2.id}/checkin`, {as: 'bob', body: {found: true}});
  await call('checkin found', 'POST', `/lost-posts/${lost2.id}/checkin`, {as: 'alice', body: {found: true}});
  await call('pet after found', 'GET', `/pets/${pet.id}`, {as: 'alice'});
  const lost3 = await newLost('create lost 3');
  await call('cancel lost other', 'POST', `/lost-posts/${lost3.id}/cancel`, {as: 'bob'});
  await call('cancel lost', 'POST', `/lost-posts/${lost3.id}/cancel`, {as: 'alice'});
  await call('cancel lost again', 'POST', `/lost-posts/${lost3.id}/cancel`, {as: 'alice'});
  const lost4 = await newLost('create lost 4');
  await call('admin close lost', 'POST', `/admin/lost-posts/${lost4.id}/close`, {as: 'boss'});
  await call('admin close lost again', 'POST', `/admin/lost-posts/${lost4.id}/close`, {as: 'boss'});
  await call('admin hide found', 'POST', `/admin/found-posts/${found.id}/hide`, {as: 'boss'});
  await call('get hidden found anon', 'GET', `/found-posts/${found.id}`);
  await call('admin unhide found', 'POST', `/admin/found-posts/${found.id}/unhide`, {as: 'boss'});
  await call('admin reports all', 'GET', '/admin/reports?status=dismissed', {as: 'boss'});
  await call('admin ownership reject', 'POST', `/admin/ownership-verifications/${ov.id}/review`, {as: 'boss', body: {status: 'rejected', review_note: 'blurry'}});
  await call('resolve found', 'POST', `/found-posts/${found.id}/resolve`, {as: 'bob'});
  await call('cancel found again', 'POST', `/found-posts/${found.id}/cancel`, {as: 'bob'});
  await call('admin close found', 'POST', `/admin/found-posts/${found.id}/close`, {as: 'boss'});
  await call('delete notifications', 'DELETE', '/notifications', {as: 'bob'});
  await call('unfollow', 'DELETE', `/lost-posts/${lost.id}/follow`, {as: 'bob'});
  await call('remove guardian', 'DELETE', `/pets/${pet.id}/guardians/${guardian.id}`, {as: 'alice'});

  // Accounts
  await call('delete account wrong password', 'DELETE', '/users/me', {as: 'bob', body: {password: 'nope'}});
  await call('delete account', 'DELETE', '/users/me', {as: 'bob', body: {password: 'newpass1234'}});
  await call('deleted user me', 'GET', '/users/me', {as: 'bob'});
  await call('delete super admin', 'DELETE', '/users/me', {as: 'boss', body: {password: 'password123'}});
  await call('delete pet', 'DELETE', `/pets/${pet.id}`, {as: 'alice'});
  await call('get deleted pet', 'GET', `/pets/${pet.id}`, {as: 'alice'});
  await call('unknown route', 'GET', '/nope');

  // Inbox websocket
  const wsBase = base.replace(/^http/, 'ws');
  log.push({label: 'ws bad token', status: 0, json: await wsProbe(`${wsBase}/api/v1/conversations/inbox?token=bad`)});
  log.push({label: 'ws ok', status: 0, json: await wsProbe(`${wsBase}/api/v1/conversations/inbox?token=${tokens.alice}`)});
  return log;
}

function wsProbe(url) {
  return new Promise(resolve => {
    const events = [];
    const ws = new WebSocket(url);
    const done = () => resolve({events});
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      done();
    }, 2500);
    ws.onmessage = e => {
      events.push(String(e.data).startsWith('{') ? {msg: shapeOf(JSON.parse(e.data))} : {text: e.data});
      if (!events.some(x => x.text === 'pong')) ws.send('ping');
      else {
        clearTimeout(timer);
        ws.close();
        done();
      }
    };
    ws.onclose = e => {
      events.push({close: e.code});
      clearTimeout(timer);
      done();
    };
    ws.onerror = () => events.push({error: true});
  });
}

function wsLegacy(url) {
  return new Promise(resolve => {
    const events = [];
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      resolve({events, timeout: true});
    }, 3000);
    ws.onopen = () => ws.send(JSON.stringify({content: 'via websocket'}));
    ws.onmessage = e => {
      events.push(shapeOf(JSON.parse(String(e.data))));
      clearTimeout(timer);
      ws.close();
      resolve({events});
    };
    ws.onclose = e => {
      clearTimeout(timer);
      resolve({events, close: e.code});
    };
  });
}

function shapeOf(v) {
  if (v === null) return null;
  if (Array.isArray(v)) return v.length ? [shapeOf(v[0])] : [];
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, shapeOf(v[k])]));
  return typeof v;
}

function summary(entry) {
  const j = structuredClone(entry.json);
  if (Array.isArray(j?.error?.details)) for (const d of j.error.details) if (d && typeof d === 'object') delete d.ctx;
  return {
    status: entry.status,
    code: j?.error?.code ?? null,
    message: j?.message ?? null,
    shape: entry.label.startsWith('ws ') ? j : shapeOf(j),
    count: Array.isArray(j?.data) ? j.data.length : Array.isArray(j?.data?.items) ? j.data.items.length : null,
  };
}

function diff(a, b, path = '') {
  const out = [];
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diff(a[k], b[k], `${path}.${k}`));
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length && b.length) return diff(a[0], b[0], `${path}[0]`);
  out.push(`${path || '.'}: python=${JSON.stringify(a)} worker=${JSON.stringify(b)}`);
  return out;
}

const [py, cf] = await Promise.all([scenario('py', pyBase), scenario('cf', cfBase)]);

// Geocoding goes to the public Nominatim service (1 request/second), so it runs sequentially.
const GEO = [
  ['geo search', '/geo/search?q=' + encodeURIComponent('สวนลุมพินี') + '&lat=13.73&lng=100.54'],
  ['geo reverse', '/geo/reverse?lat=13.7314&lng=100.5414'],
  ['geo search short', '/geo/search?q=a'],
  ['geo reverse invalid', '/geo/reverse?lat=200&lng=1'],
];
for (const [label, path] of GEO) {
  for (const [base, log] of [[pyBase, py], [cfBase, cf]]) {
    const res = await fetch(`${base}/api/v1${path}`);
    log.push({label, status: res.status, json: await res.json()});
    await new Promise(r => setTimeout(r, 1200));
  }
}
let failures = 0;
for (let i = 0; i < Math.max(py.length, cf.length); i++) {
  const label = py[i]?.label ?? cf[i]?.label;
  const problems = diff(summary(py[i] ?? {json: null}), summary(cf[i] ?? {json: null}));
  if (process.env.VERBOSE) console.log(`${py[i]?.status}\t${cf[i]?.status}\t${label}`);
  if (problems.length) {
    failures++;
    console.log(`✗ ${label}\n    ${problems.join('\n    ')}`);
  }
}
console.log(`\n${py.length} steps, ${failures} with differences`);
process.exit(failures ? 1 : 0);
