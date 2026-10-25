// After migrating a database into D1, checks that the Worker returns the same values as the Python API
// for read endpoints. Timestamps are compared to the second, and absolute API hosts are ignored.
//
//   node test/read-compare.mjs <python-base> <worker-base> <email>[,<email>...] [password]
const [pyBase, cfBase, emails, password = 'password123'] = process.argv.slice(2);

const TS = /(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(\.\d+)?(Z|[+-]\d\d:\d\d)?/g;
const normalize = v => JSON.parse(JSON.stringify(v).replace(TS, '$1').replace(/https?:\/\/[^/"]+\/api\/v1/g, '<api>'));

async function session(base, email) {
  const api = `${base}/api/v1`;
  const login = await (
    await fetch(`${api}/auth/login`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({email, password})})
  ).json();
  const token = login.data?.access_token;
  return async path => {
    const res = await fetch(`${api}${path}`, {headers: token ? {Authorization: `Bearer ${token}`} : {}});
    return {status: res.status, body: normalize(await res.json())};
  };
}

function diff(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => diff(a[k], b[k], `${path}.${k}`));
  }
  return [`${path}: python=${JSON.stringify(a)} worker=${JSON.stringify(b)}`];
}

let failures = 0;
for (const email of emails.split(',')) {
  const [py, cf] = await Promise.all([session(pyBase, email), session(cfBase, email)]);
  const paths = ['/users/me', '/pets', '/users/me/posts', '/conversations', '/notifications', '/me/following-cases', '/feed', '/lost-posts', '/found-posts', '/notification-preferences'];
  const pets = (await py('/pets')).body.data ?? [];
  for (const pet of pets) paths.push(`/pets/${pet.id}`, `/pets/${pet.id}/images`, `/pets/${pet.id}/guardians`, `/pets/${pet.id}/health`, `/pets/${pet.id}/emergency`);
  const convs = (await py('/conversations')).body.data ?? [];
  for (const conv of convs) paths.push(`/conversations/${conv.id}`);
  for (const path of paths) {
    const [a, b] = await Promise.all([py(path), cf(path)]);
    const problems = diff(a, b);
    if (problems.length) {
      failures++;
      console.log(`✗ ${email} ${path}\n    ${problems.slice(0, 8).join('\n    ')}`);
    }
  }
  console.log(`${email}: ${paths.length} endpoints checked`);
}
process.exit(failures ? 1 : 0);
