const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./loadapp');
const jwt = require('jsonwebtoken');

async function serve(env) {
  const { app, fake } = load(env);
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, url, { body, token, headers } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(headers || {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    let json = null; try { json = await res.clone().json(); } catch (e) {}
    return { status: res.status, json, headers: res.headers };
  };
  return { call, fake, base, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }) };
}
const SECRET = 'unit-test-secret-unit-test-secret-1234';
const DEV = { NODE_ENV: 'development', JWT_SECRET: SECRET, DEMO_MODE: 'true', DEV_TOOLS: 'true' };
const PROD = { NODE_ENV: 'production', JWT_SECRET: 'Prod-Secret-' + 'y'.repeat(30) };
const login = async (s, email = 'real@person.com') => (await s.call('POST', '/api/auth/login', { body: { email, password: 'password123' } })).json.token;

test('AUTH: signup creates an unverified normal account; host/verified claims are ignored', async () => {
  const s = await serve(DEV);
  const r = await s.call('POST', '/api/auth/register', { body: { name: 'New Host', email: 'new@x.com', password: 'secret12', isHost: true, is_host_verified: true } });
  assert.equal(r.status, 201);
  assert.equal(r.json.user.is_host_verified, false);
  assert.notEqual(r.json.user.bio, 'Verified Host');
  assert.equal(s.fake.log.lastInsertUserParams[4], false);
  // login with the new account still works
  const l = await s.call('POST', '/api/auth/login', { body: { email: 'new@x.com', password: 'secret12' } });
  assert.equal(l.status, 200); assert.equal(l.json.user.is_host_verified, false);
  assert.equal((await s.call('POST', '/api/auth/register', { body: { name: 'A', email: { $ne: 1 }, password: 'secret12' } })).status, 400);
  assert.equal((await s.call('POST', '/api/auth/login', { body: { email: 'real@person.com', password: 'wrong' } })).status, 401);
  await s.close();
});

test('DASHBOARD: logged out gets 401 and no data; logged in gets only own data', async () => {
  const s = await serve(DEV);
  const r = await s.call('GET', '/api/dashboard');
  assert.equal(r.status, 401);
  assert.equal(JSON.stringify(r.json).includes('Aarav'), false);
  assert.equal(s.fake.log.sql.some(q => q.includes('aarav@example.com')), false, 'no query for the demo user');
  assert.equal((await s.call('GET', '/api/dashboard', { token: 'garbage' })).status, 401);
  const mine = await s.call('GET', '/api/dashboard', { token: await login(s) });
  assert.equal(mine.status, 200); assert.equal(mine.json.user.email, 'real@person.com');
  await s.close();
});

test('DEMO: works only when DEMO_MODE=true in development, allow-listed accounts only', async () => {
  const s = await serve(DEV);
  assert.equal((await s.call('GET', '/api/config')).json.demoMode, true);
  assert.equal((await s.call('GET', '/api/auth/demo-users')).status, 200);
  assert.equal((await s.call('POST', '/api/auth/switch-demo', { body: { email: 'aarav@example.com' } })).status, 200);
  assert.equal((await s.call('POST', '/api/auth/switch-demo', { body: { email: 'real@person.com' } })).status, 400, 'real user cannot be impersonated');
  assert.equal((await s.call('POST', '/api/auth/switch-demo', { body: { userId: 9 } })).status, 400, 'id-based impersonation gone');
  assert.equal((await s.call('POST', '/api/auth/switch-demo', { body: {} })).status, 400, 'no default account');
  await s.close();
  // development but flag off
  const off = await serve({ NODE_ENV: 'development', JWT_SECRET: SECRET });
  assert.equal((await off.call('GET', '/api/config')).json.demoMode, false);
  assert.equal((await off.call('GET', '/api/auth/demo-users')).status, 404);
  assert.equal((await off.call('POST', '/api/auth/switch-demo', { body: { email: 'aarav@example.com' } })).status, 404);
  await off.close();
});

test('PRODUCTION: demo + dev tools cannot be enabled, even with flags set; normal login unaffected', async () => {
  const s = await serve({ ...PROD, DEMO_MODE: 'true', DEV_TOOLS: 'true' });
  const cfg = (await s.call('GET', '/api/config')).json;
  assert.deepEqual(cfg, { demoMode: false, devTools: false });
  assert.equal((await s.call('GET', '/api/auth/demo-users')).status, 404);
  assert.equal((await s.call('POST', '/api/auth/switch-demo', { body: { email: 'aarav@example.com' } })).status, 404);
  assert.equal((await s.call('POST', '/api/auth/login', { body: { email: 'real@person.com', password: 'password123' } })).status, 200);
  await s.close();
});

test('STRICT BY DEFAULT: unset or unknown NODE_ENV is treated as production', () => {
  assert.throws(() => load({ JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => load({ NODE_ENV: 'staging' }), /JWT_SECRET/);
});

test('JWT: production refuses missing/weak/old-default secrets; development still boots', () => {
  for (const secret of [undefined, '', 'short', 'seatswap_super_secret_jwt_key_2026', 'replace-with-a-long-random-string']) {
    assert.throws(() => load({ NODE_ENV: 'production', ...(secret !== undefined ? { JWT_SECRET: secret } : {}) }), /JWT_SECRET/, 'secret=' + secret);
  }
  assert.doesNotThrow(() => load(PROD));
  assert.doesNotThrow(() => load({ NODE_ENV: 'development' }));
});

test('JWT: tokens signed with the old hardcoded secret or alg=none are rejected', async () => {
  const s = await serve(PROD);
  const forged = jwt.sign({ userId: 9 }, 'seatswap_super_secret_jwt_key_2026');
  assert.equal((await s.call('GET', '/api/dashboard', { token: forged })).status, 401);
  assert.equal((await s.call('GET', '/api/auth/me', { token: forged })).status, 401);
  const none = jwt.sign({ userId: 9 }, '', { algorithm: 'none' });
  assert.equal((await s.call('GET', '/api/auth/me', { token: none })).status, 401);
  await s.close();
});

test('CORS: production allows only configured origins; development allows localhost', async () => {
  const acao = (s, o) => s.call('GET', '/api/services', { headers: { Origin: o } }).then(r => r.headers.get('access-control-allow-origin'));
  const p = await serve({ ...PROD, CORS_ORIGINS: 'https://app.seatswap.example' });
  assert.equal(await acao(p, 'https://app.seatswap.example'), 'https://app.seatswap.example');
  assert.equal(await acao(p, 'https://evil.example'), null);
  assert.equal(await acao(p, 'http://localhost:5173'), null);
  await p.close();
  const p2 = await serve(PROD);
  assert.equal(await acao(p2, 'https://anything.example'), null);
  await p2.close();
  const d = await serve(DEV);
  assert.equal(await acao(d, 'http://localhost:5173'), 'http://localhost:5173');
  assert.equal(await acao(d, 'https://evil.example'), null);
  await d.close();
});

test('SSE: no wildcard CORS header and no personal data in seat broadcasts', async () => {
  const s = await serve(DEV);
  const ctrl = new AbortController();
  const res = await fetch(s.base + '/api/events/sse', { signal: ctrl.signal });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const reader = res.body.getReader();
  await reader.read();
  const join = await s.call('POST', '/api/groups/P-1042/seats/2/join', { token: await login(s) });
  assert.equal(join.status, 200);
  const chunk = new TextDecoder().decode((await reader.read()).value);
  assert.match(chunk, /seat_updated/);
  assert.equal(/Real Person|"user"|"name"/.test(chunk), false, chunk);
  ctrl.abort(); await s.close();
});

test('AUTHZ + HONESTY: protected routes need auth; ownership enforced; join does not claim payment', async () => {
  const s = await serve(DEV);
  for (const [m, u] of [['POST', '/api/groups'], ['POST', '/api/groups/P-1042/seats/2/join'], ['POST', '/api/groups/P-1042/seats/1/leave'], ['GET', '/api/auth/me'], ['GET', '/api/dashboard']]) {
    assert.equal((await s.call(m, u)).status, 401, m + ' ' + u);
  }
  const a = await login(s);
  const b = (await s.call('POST', '/api/auth/register', { body: { name: 'Other', email: 'other@x.com', password: 'secret12' } })).json.token;
  const j = await s.call('POST', '/api/groups/P-1042/seats/2/join', { token: a });
  assert.equal(j.status, 200);
  assert.match(j.json.message, /reserved/i);
  assert.match(j.json.message, /no payment was taken/i);
  assert.doesNotMatch(j.json.message, /payment completed|verified|\bpaid\b|is now active/i);
  assert.equal(s.fake.memberships[0].payment_status, 'pending', 'no payment is recorded as paid');
  // Phase 1 carryover B: seat, membership and payment records must agree (reserved, unpaid, not active)
  assert.equal(s.fake.seats.find(x => x.seat_number === 2).status, 'rsv', 'seat is reserved, not active');
  assert.equal(s.fake.memberships[0].status, 'reserved', 'membership is reserved, not active');
  assert.equal(j.json.status, 'rsv');
  const dash = await s.call('GET', '/api/dashboard', { token: a });
  assert.equal(dash.json.passes[0].status, 'Reserved');
  assert.equal(dash.json.passes[0].paymentStatus, 'pending');
  const grp = await s.call('GET', '/api/groups/P-1042', { token: a });
  assert.equal(grp.json.seats[1], 'rsv');
  assert.equal((await s.call('POST', '/api/groups/P-1042/seats/2/join', { token: b })).status, 409, 'cannot double-book');
  assert.equal((await s.call('POST', '/api/groups/P-1042/seats/3/join', { token: a })).status, 409, 'one seat per member per group');
  assert.equal((await s.call('POST', '/api/groups/P-1042/seats/2/leave', { token: b })).status, 403, "cannot leave someone else's seat");
  assert.equal((await s.call('POST', '/api/groups/P-1042/seats/1/leave', { token: a })).status, 403);
  assert.equal((await s.call('POST', '/api/groups/P-1042/seats/abc/leave', { token: a })).status, 400);
  // host cannot take a member seat in their own group
  const host = await login(s, 'rahul@example.com');
  assert.equal((await s.call('POST', '/api/groups/P-1042/seats/3/join', { token: host })).status, 403);
  assert.equal((await s.call('POST', '/api/groups/P-1042/seats/2/leave', { token: a })).status, 200);
  assert.equal(s.fake.seats.find(x => x.seat_number === 2).status, 'open');
  await s.close();
});

test('GROUPS: create works for a signed-in user; new group is not marked host-checked', async () => {
  const s = await serve(DEV);
  const r = await s.call('POST', '/api/groups', { token: await login(s), body: { serviceId: 'canva', type: 'Team', totalPrice: 1000, totalSeats: 4 } });
  assert.equal(r.status, 201);
  assert.equal(s.fake.log.lastGroup.host_check_passed, false);
  assert.doesNotMatch(JSON.stringify(r.json), /verified|host check/i);
  await s.close();
});

test('VERIFICATION: no group payload exposes a host-check / verified flag (Phase 1 carryover A)', async () => {
  const s = await serve(PROD);
  // the fake group is stored with host_check_passed = true; the API must not surface it
  const list = await s.call('GET', '/api/groups');
  assert.equal('hc' in list.json[0], false);
  assert.doesNotMatch(JSON.stringify(list.json), /verified|host_check|"hc"/i);
  const one = await s.call('GET', '/api/groups/P-1042');
  assert.doesNotMatch(JSON.stringify(one.json), /verified|host_check|"hc"/i);
  await s.close();
});

test('MARKETPLACE + MISC: groups/services load; activity endpoint gone; health minimal in production; unknown API is JSON 404', async () => {
  const s = await serve(PROD);
  const list = await s.call('GET', '/api/groups');
  assert.equal(list.status, 200); assert.equal(list.json.length, 1);
  assert.equal((await s.call('GET', '/api/groups/P-1042')).status, 200);
  assert.equal((await s.call('GET', '/api/groups/NOPE')).status, 404);
  assert.equal((await s.call('GET', '/api/services')).status, 200);
  const act = await s.call('GET', '/api/activity'); assert.equal(act.status, 404); assert.ok(act.json);
  const h = await s.call('GET', '/api/health'); assert.deepEqual(h.json, { status: 'ok' });
  assert.equal(h.headers.get('x-powered-by'), null);
  await s.close();
});
