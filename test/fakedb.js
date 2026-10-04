// In-memory stand-in for src/db (NOT PostgreSQL). Exercises route/middleware logic only.
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('password123', 4);
let uid = 100;
const users = [
  { id: 1, name: 'Aarav Patel', email: 'aarav@example.com', avatar: 'A', is_host_verified: false, bio: 'x', password_hash: hash, created_at: new Date() },
  { id: 2, name: 'Rahul Sharma', email: 'rahul@example.com', avatar: 'R', is_host_verified: false, bio: 'x', password_hash: hash, created_at: new Date() },
  { id: 9, name: 'Real Person', email: 'real@person.com', avatar: 'R', is_host_verified: false, bio: 'x', password_hash: hash, created_at: new Date() }
];
const notifications = [];
const services = [{ id: 'canva', name: 'Canva', category: 'Design', b1: '#0', b2: '#1', default_plan: 'Teams', typical_price: 1499, max_seats: 5 }];
const groups = [{ id: 'P-1042', service_id: 'canva', plan: 'Teams plan', type: 'Team', price: '249', total_seats: 3, host_id: 2, is_active: true, days_ago: 1, created_at: new Date(), service_name: 'Canva', b1: '#0', b2: '#1', host_name: 'Rahul Sharma', host_check_passed: true }];
const seats = [1, 2, 3].map(n => ({ id: n, group_id: 'P-1042', seat_number: n, status: n === 1 ? 'mem' : 'open', member_id: n === 1 ? 2 : null }));
const memberships = [];
const log = { notifications, memberships, sql: [] };
const pub = u => { const { password_hash, ...r } = u; return r; };

async function run(text, p = []) {
  const t = text.replace(/\s+/g, ' ').trim();
  log.sql.push(t);
  if (t === 'BEGIN' || t === 'COMMIT' || t === 'ROLLBACK') return { rows: [] };
  if (t === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
  if (/FROM users WHERE id = \$1/.test(t)) { const u = users.find(x => x.id === p[0]); return { rows: u ? [pub(u)] : [] }; }
  if (/FROM users WHERE email = ANY\(\$1\)/.test(t) || /WHERE email = ANY\(\$1\) ORDER/.test(t)) return { rows: users.filter(u => p[0].includes(u.email)).map(pub) };
  if (/password_hash.* FROM users WHERE email/.test(t)) { const u = users.find(x => x.email === p[0]); return { rows: u ? [{ ...u }] : [] }; }
  if (/FROM users WHERE email = \$1/.test(t)) { const u = users.find(x => x.email === p[0]); return { rows: u ? [t.startsWith('SELECT id FROM') ? { id: u.id } : pub(u)] : [] }; }
  if (/^INSERT INTO users/.test(t)) {
    log.lastInsertUserSql = t;
    const u = { id: ++uid, name: p[0], email: p[1], password_hash: p[2], avatar: p[3], is_host_verified: p[4], bio: p[5], created_at: new Date() };
    log.lastInsertUserParams = p; users.push(u); return { rows: [pub(u)] };
  }
  if (/^INSERT INTO notifications/.test(t)) { notifications.push({ user_id: p[0], title: p[1] }); return { rows: [] }; }
  if (/^SELECT COUNT\(\*\) as groups_count FROM groups/.test(t)) return { rows: [{ groups_count: String(groups.length) }] };
  if (/^SELECT \* FROM services WHERE id = \$1/.test(t)) return { rows: services.filter(x => x.id === p[0]) };
  if (/^SELECT COUNT\(\*\) FROM groups$/.test(t)) return { rows: [{ count: String(groups.length) }] };
  if (/^SELECT id FROM groups WHERE id = \$1/.test(t)) return { rows: groups.filter(g => g.id === p[0]).map(g => ({ id: g.id })) };
  if (/^INSERT INTO groups/.test(t)) {
    const g = { id: p[0], service_id: p[1], plan: p[2], type: p[3], price: String(p[4]), total_seats: p[5], host_id: p[6], host_check_passed: p[7], is_active: true, days_ago: 0, created_at: new Date(), service_name: 'Canva', b1: '#0', b2: '#1', host_name: 'Host' };
    groups.push(g); log.lastGroup = g; return { rows: [g] };
  }
  if (/^INSERT INTO seats/.test(t)) { seats.push({ id: seats.length + 1, group_id: p[0], seat_number: p[1], status: 'open', member_id: null }); return { rows: [] }; }
  if (/^INSERT INTO activity_logs/.test(t)) return { rows: [] };
  if (/^SELECT COUNT\(\*\) FROM notifications/.test(t)) return { rows: [{ count: String(notifications.filter(n => n.user_id === p[0]).length) }] };
  if (/FROM notifications WHERE user_id/.test(t)) return { rows: notifications.filter(n => n.user_id === p[0]).map((n, i) => ({ id: i, title: n.title, type: 'info', is_read: false, created_at: new Date() })) };
  if (/FROM memberships m JOIN/.test(t)) {
    return { rows: memberships.filter(m => m.user_id === p[0] && ['reserved', 'active'].includes(m.status)).map(m => ({ membership_id: m.id, membership_status: m.status, payment_status: m.payment_status, seat_number: m.seat_number, amount: m.amount, created_at: new Date(), group_id: m.group_id, plan: 'Teams plan', type: 'Team', service_id: 'canva', service_name: 'Canva', b1: '#0', b2: '#1', host_name: 'Rahul Sharma' })) };
  }
  if (/^SELECT COUNT\(\*\) FROM groups WHERE host_id/.test(t)) return { rows: [{ count: String(groups.filter(g => g.host_id === p[0]).length) }] };
  if (/FROM groups g JOIN services s ON g.service_id = s.id WHERE g.host_id/.test(t)) return { rows: [] };
  if (/FROM services ORDER BY/.test(t)) return { rows: services };
  if (/SELECT group_id, seat_number, status, member_id FROM seats/.test(t)) return { rows: seats.filter(s => p[0].includes(s.group_id)) };
  if (/FROM groups g JOIN services s ON g.service_id = s.id JOIN users u ON g.host_id = u.id WHERE g.id = \$1/.test(t)) return { rows: groups.filter(g => g.id === p[0]) };
  if (/FROM groups g JOIN services s ON g.service_id = s.id JOIN users u ON g.host_id = u.id WHERE g.is_active/.test(t)) return { rows: groups };
  if (/^SELECT g\.\*, s\.name as service_name FROM groups g JOIN services s .* FOR SHARE/.test(t)) return { rows: groups.filter(g => g.id === p[0]) };
  if (/^SELECT \* FROM seats WHERE group_id = \$1 AND seat_number = \$2 FOR UPDATE/.test(t)) return { rows: seats.filter(s => s.group_id === p[0] && s.seat_number === p[1]).map(s => ({ ...s })) };
  if (/^SELECT 1 FROM seats WHERE group_id = \$1 AND member_id = \$2/.test(t)) return { rows: seats.filter(x => x.group_id === p[0] && x.member_id === p[1]).map(() => ({ '?column?': 1 })) };
  if (/^UPDATE seats SET status = 'rsv'/.test(t)) { const s = seats.find(x => x.id === p[1]); s.status = 'rsv'; s.member_id = p[0]; return { rows: [] }; }
  if (/^UPDATE seats SET status = 'open'/.test(t)) { const s = seats.find(x => x.id === p[0]); s.status = 'open'; s.member_id = null; return { rows: [] }; }
  if (/^INSERT INTO memberships/.test(t)) { memberships.push({ id: memberships.length + 1, user_id: p[0], group_id: p[1], seat_id: p[2], seat_number: p[3], amount: p[4], status: /'reserved', 'pending'\)/.test(t) ? 'reserved' : 'active', payment_status: /'pending'\)/.test(t) ? 'pending' : 'paid' }); return { rows: [] }; }
  if (/^UPDATE memberships SET status = 'cancelled'/.test(t)) { memberships.filter(m => m.seat_id === p[0] && m.user_id === p[1] && ['reserved', 'active'].includes(m.status)).forEach(m => m.status = 'cancelled'); return { rows: [] }; }
  throw new Error('fakedb: unhandled SQL: ' + t.slice(0, 120));
}
module.exports = {
  log, users, seats, memberships,
  pool: { query: run, on() {}, end() {} },
  query: run,
  getClient: async () => ({ query: run, release() {} }),
  initSchema: async () => {}
};
