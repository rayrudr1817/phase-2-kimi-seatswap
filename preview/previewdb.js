// Preview-only in-memory stand-in for src/db (NOT PostgreSQL).
// Lets the real Express app run anywhere without a database, for homepage previews.
// Mirrors test/fakedb.js behaviour with a fuller seed so the marketplace looks real.
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('password123', 4);

const users = [
  { id: 1, name: 'Aarav Patel', email: 'aarav@example.com', avatar: 'A', is_host_verified: false, bio: 'SeatSwap Member', password_hash: hash, created_at: new Date() },
  { id: 2, name: 'Rahul Sharma', email: 'rahul@example.com', avatar: 'R', is_host_verified: false, bio: 'SeatSwap Member', password_hash: hash, created_at: new Date() },
  { id: 3, name: 'Meera Iyer', email: 'meera@example.com', avatar: 'M', is_host_verified: false, bio: 'SeatSwap Member', password_hash: hash, created_at: new Date() },
  { id: 4, name: 'Arjun Verma', email: 'arjun@example.com', avatar: 'A', is_host_verified: false, bio: 'SeatSwap Member', password_hash: hash, created_at: new Date() },
  { id: 5, name: 'Ishita Rao', email: 'ishita@example.com', avatar: 'I', is_host_verified: false, bio: 'SeatSwap Member', password_hash: hash, created_at: new Date() }
];
let uid = 100;

const services = [
  { id: 'canva', name: 'Canva', category: 'Design', b1: '#00C4CC', b2: '#7D2AE8', default_plan: 'Teams plan', typical_price: 1499, max_seats: 5 },
  { id: 'adobe', name: 'Adobe Creative Cloud', category: 'Design', b1: '#FA0F00', b2: '#B30B00', default_plan: 'All apps, team seats', typical_price: 4999, max_seats: 10 },
  { id: 'figma', name: 'Figma', category: 'Design', b1: '#F24E1E', b2: '#A259FF', default_plan: 'Professional seats', typical_price: 3100, max_seats: 10 },
  { id: 'ms365', name: 'Microsoft 365', category: 'Productivity', b1: '#0078D4', b2: '#00A4EF', default_plan: 'Family plan', typical_price: 1079, max_seats: 6 },
  { id: 'notion', name: 'Notion', category: 'Productivity', b1: '#6B6B6B', b2: '#B8B8B4', default_plan: 'Plus, team workspace', typical_price: 1625, max_seats: 10 },
  { id: 'spotify', name: 'Spotify', category: 'Entertainment', b1: '#1DB954', b2: '#14833B', default_plan: 'Family plan', typical_price: 179, max_seats: 6 },
  { id: 'youtube', name: 'YouTube Premium', category: 'Entertainment', b1: '#FF0000', b2: '#A80000', default_plan: 'Family plan', typical_price: 189, max_seats: 5 }
];

// price is the per-seat monthly price. No group is ever host-check passed.
const groups = [
  { id: 'P-1042', service_id: 'canva', plan: 'Teams plan', type: 'Team', price: '300', total_seats: 5, host_id: 2, host_check_passed: false, is_active: true, days_ago: 0, created_at: new Date() },
  { id: 'P-1043', service_id: 'notion', plan: 'Plus, team workspace', type: 'Team', price: '325', total_seats: 8, host_id: 5, host_check_passed: false, is_active: true, days_ago: 1, created_at: new Date() },
  { id: 'P-1044', service_id: 'spotify', plan: 'Family plan', type: 'Family', price: '45', total_seats: 6, host_id: 3, host_check_passed: false, is_active: true, days_ago: 2, created_at: new Date() },
  { id: 'P-1045', service_id: 'youtube', plan: 'Family plan', type: 'Family', price: '48', total_seats: 5, host_id: 4, host_check_passed: false, is_active: true, days_ago: 3, created_at: new Date() },
  { id: 'P-1046', service_id: 'ms365', plan: 'Family plan', type: 'Family', price: '180', total_seats: 6, host_id: 2, host_check_passed: false, is_active: true, days_ago: 4, created_at: new Date() },
  { id: 'P-1047', service_id: 'figma', plan: 'Professional seats', type: 'Team', price: '620', total_seats: 5, host_id: 5, host_check_passed: false, is_active: true, days_ago: 5, created_at: new Date() },
  { id: 'P-1048', service_id: 'adobe', plan: 'All apps, team seats', type: 'Team', price: '880', total_seats: 4, host_id: 3, host_check_passed: false, is_active: true, days_ago: 6, created_at: new Date() },
  { id: 'P-1049', service_id: 'canva', plan: 'Teams plan', type: 'Team', price: '320', total_seats: 5, host_id: 4, host_check_passed: false, is_active: true, days_ago: 7, created_at: new Date() }
];

// seat statuses: mem = taken · open · rsv = reserved (payment pending)
const seatSeed = {
  'P-1042': [['mem', 2], ['mem', 9], ['open', null], ['open', null], ['open', null]],
  'P-1043': [['mem', 5], ['mem', 9], ['mem', 8], ['open', null], ['open', null], ['open', null], ['open', null], ['open', null]],
  'P-1044': [['mem', 3], ['mem', 9], ['mem', 8], ['mem', 7], ['rsv', 1], ['open', null]],
  'P-1045': [['mem', 4], ['mem', 9], ['open', null], ['open', null], ['open', null]],
  'P-1046': [['mem', 2], ['rsv', 1], ['open', null], ['open', null], ['open', null], ['open', null]],
  'P-1047': [['mem', 5], ['mem', 9], ['mem', 8], ['mem', 7], ['open', null]],
  'P-1048': [['mem', 3], ['mem', 9], ['open', null], ['open', null]],
  'P-1049': [['open', null], ['open', null], ['open', null], ['open', null], ['open', null]]
};
let seatId = 0;
const seats = [];
for (const [gid, arr] of Object.entries(seatSeed)) {
  arr.forEach(([status, member], i) => seats.push({ id: ++seatId, group_id: gid, seat_number: i + 1, status, member_id: member }));
}

const memberships = [
  { id: 1, user_id: 1, group_id: 'P-1044', seat_id: seats.find(s => s.group_id === 'P-1044' && s.seat_number === 5).id, seat_number: 5, amount: 45, status: 'reserved', payment_status: 'pending', created_at: new Date() },
  { id: 2, user_id: 1, group_id: 'P-1046', seat_id: seats.find(s => s.group_id === 'P-1046' && s.seat_number === 2).id, seat_number: 2, amount: 180, status: 'reserved', payment_status: 'pending', created_at: new Date() }
];

const notifications = [
  { user_id: 1, title: 'You reserved Seat 5 in Spotify (Family plan). No payment was taken: payments are simulated in this prototype.', type: 'info', is_read: false, created_at: new Date() },
  { user_id: 1, title: 'You reserved Seat 2 in Microsoft 365 (Family plan). No payment was taken: payments are simulated in this prototype.', type: 'info', is_read: false, created_at: new Date() },
  { user_id: 2, title: 'Aarav Patel reserved Seat 2 in your Microsoft 365 group. Payment is still pending.', type: 'info', is_read: false, created_at: new Date() }
];

const svcOf = g => services.find(s => s.id === g.service_id) || {};
const hostOf = g => users.find(u => u.id === g.host_id) || {};
const enrichGroup = g => ({ ...g, service_name: svcOf(g).name, b1: svcOf(g).b1, b2: svcOf(g).b2, host_name: hostOf(g).name });
const pub = u => { const { password_hash, ...r } = u; return r; };

async function run(text, p = []) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t === 'BEGIN' || t === 'COMMIT' || t === 'ROLLBACK') return { rows: [] };
  if (t === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
  if (/FROM users WHERE id = \$1/.test(t)) { const u = users.find(x => x.id === p[0]); return { rows: u ? [pub(u)] : [] }; }
  if (/WHERE email = ANY\(\$1\)/.test(t)) return { rows: users.filter(u => p[0].includes(u.email)).map(pub) };
  if (/password_hash.* FROM users WHERE email/.test(t)) { const u = users.find(x => x.email === p[0]); return { rows: u ? [{ ...u }] : [] }; }
  if (/FROM users WHERE email = \$1/.test(t)) { const u = users.find(x => x.email === p[0]); return { rows: u ? [t.startsWith('SELECT id FROM') ? { id: u.id } : pub(u)] : [] }; }
  if (/^INSERT INTO users/.test(t)) {
    const u = { id: ++uid, name: p[0], email: p[1], password_hash: p[2], avatar: p[3], is_host_verified: p[4], bio: p[5], created_at: new Date() };
    users.push(u); return { rows: [pub(u)] };
  }
  if (/^INSERT INTO notifications/.test(t)) { notifications.push({ user_id: p[0], title: p[1], type: p[2] || 'info', is_read: false, created_at: new Date() }); return { rows: [] }; }
  if (/^SELECT COUNT\(\*\) as groups_count FROM groups/.test(t)) return { rows: [{ groups_count: String(groups.length) }] };
  if (/^SELECT \* FROM services WHERE id = \$1/.test(t)) return { rows: services.filter(x => x.id === p[0]) };
  if (/^SELECT COUNT\(\*\) FROM groups$/.test(t)) return { rows: [{ count: String(groups.length) }] };
  if (/^SELECT id FROM groups WHERE id = \$1/.test(t)) return { rows: groups.filter(g => g.id === p[0]).map(g => ({ id: g.id })) };
  if (/^INSERT INTO groups/.test(t)) {
    const g = { id: p[0], service_id: p[1], plan: p[2], type: p[3], price: String(p[4]), total_seats: p[5], host_id: p[6], host_check_passed: false, is_active: true, days_ago: 0, created_at: new Date() };
    groups.push(g); return { rows: [{ ...g }] };
  }
  if (/^INSERT INTO seats/.test(t)) { seats.push({ id: ++seatId, group_id: p[0], seat_number: p[1], status: 'open', member_id: null }); return { rows: [] }; }
  if (/^INSERT INTO activity_logs/.test(t)) return { rows: [] };
  if (/^SELECT COUNT\(\*\) FROM notifications/.test(t)) return { rows: [{ count: String(notifications.filter(n => n.user_id === p[0] && !n.is_read).length) }] };
  if (/FROM notifications WHERE user_id/.test(t)) return { rows: notifications.filter(n => n.user_id === p[0]).map((n, i) => ({ id: i, title: n.title, type: n.type || 'info', is_read: !!n.is_read, created_at: n.created_at || new Date() })) };
  if (/FROM memberships m JOIN/.test(t)) {
    return {
      rows: memberships
        .filter(m => m.user_id === p[0] && ['reserved', 'active'].includes(m.status))
        .map(m => {
          const g = groups.find(x => x.id === m.group_id) || {};
          return {
            membership_id: m.id, id: m.id, membership_status: m.status, status: m.status, payment_status: m.payment_status,
            seat_number: m.seat_number, amount: m.amount, created_at: m.created_at || new Date(),
            group_id: m.group_id, plan: g.plan, type: g.type,
            service_id: g.service_id, service_name: svcOf(g).name, b1: svcOf(g).b1, b2: svcOf(g).b2, host_name: hostOf(g).name
          };
        })
    };
  }
  if (/^SELECT COUNT\(\*\) FROM groups WHERE host_id/.test(t)) return { rows: [{ count: String(groups.filter(g => g.host_id === p[0] && g.is_active).length) }] };
  if (/FROM groups g JOIN services s ON g.service_id = s.id WHERE g.host_id/.test(t)) {
    return {
      rows: groups.filter(g => g.host_id === p[0]).map(g => ({
        ...enrichGroup(g),
        taken_seats: String(seats.filter(s => s.group_id === g.id && ['mem', 'rsv', 'act'].includes(s.status)).length)
      }))
    };
  }
  if (/FROM services ORDER BY/.test(t)) return { rows: services };
  if (/SELECT group_id, seat_number, status, member_id FROM seats/.test(t)) return { rows: seats.filter(s => p[0].includes(s.group_id)) };
  if (/FROM groups g JOIN services s ON g.service_id = s.id JOIN users u ON g.host_id = u.id WHERE g.id = \$1/.test(t)) return { rows: groups.filter(g => g.id === p[0]).map(enrichGroup) };
  if (/FROM groups g JOIN services s ON g.service_id = s.id JOIN users u ON g.host_id = u.id WHERE g.is_active/.test(t)) return { rows: groups.filter(g => g.is_active).map(enrichGroup) };
  if (/^SELECT g\.\*, s\.name as service_name FROM groups g JOIN services s .* FOR SHARE/.test(t)) {
    return { rows: groups.filter(g => g.id === p[0]).map(g => ({ ...g, service_name: svcOf(g).name })) };
  }
  if (/^SELECT \* FROM seats WHERE group_id = \$1 AND seat_number = \$2 FOR UPDATE/.test(t)) return { rows: seats.filter(s => s.group_id === p[0] && s.seat_number === p[1]).map(s => ({ ...s })) };
  if (/^SELECT 1 FROM seats WHERE group_id = \$1 AND member_id = \$2/.test(t)) return { rows: seats.filter(x => x.group_id === p[0] && x.member_id === p[1]).map(() => ({ '?column?': 1 })) };
  if (/^UPDATE seats SET status = 'rsv'/.test(t)) { const s = seats.find(x => x.id === p[1]); if (s) { s.status = 'rsv'; s.member_id = p[0]; } return { rows: [] }; }
  if (/^UPDATE seats SET status = 'open'/.test(t)) { const s = seats.find(x => x.id === p[0]); if (s) { s.status = 'open'; s.member_id = null; } return { rows: [] }; }
  if (/^INSERT INTO memberships/.test(t)) {
    memberships.push({ id: memberships.length + 1, user_id: p[0], group_id: p[1], seat_id: p[2], seat_number: p[3], amount: p[4], status: /'reserved', 'pending'\)/.test(t) ? 'reserved' : 'active', payment_status: /'pending'\)/.test(t) ? 'pending' : 'paid', created_at: new Date() });
    return { rows: [] };
  }
  if (/^UPDATE memberships SET status = 'cancelled'/.test(t)) { memberships.filter(m => m.seat_id === p[0] && m.user_id === p[1] && ['reserved', 'active'].includes(m.status)).forEach(m => m.status = 'cancelled'); return { rows: [] }; }
  throw new Error('previewdb: unhandled SQL: ' + t.slice(0, 140));
}

module.exports = {
  pool: { query: run, on() {}, end() {} },
  query: run,
  getClient: async () => ({ query: run, release() {} }),
  initSchema: async () => {}
};
