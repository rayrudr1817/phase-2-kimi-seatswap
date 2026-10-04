const bcrypt = require('bcryptjs');
const { pool, initSchema } = require('./index');
const { isProduction } = require('../config');

async function seed() {
  // The seed DROPS and recreates every table and creates accounts with a shared
  // known password. It is a development utility only.
  if (isProduction) {
    throw new Error('Refusing to seed: this script drops all tables and is for development only (NODE_ENV=development).');
  }
  console.log('🌱 Starting SeatSwap database seed...');
  await initSchema();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Insert Users
  const usersData = [
    { name: 'Aarav Patel', email: 'aarav@example.com', avatar: 'A', is_host_verified: false, bio: 'Product designer & subscription sharer.' },
    { name: 'Rahul Sharma', email: 'rahul@example.com', avatar: 'R', is_host_verified: false, bio: 'Freelance graphic designer with active team plans.' },
    { name: 'Meera Sen', email: 'meera@example.com', avatar: 'M', is_host_verified: false, bio: 'Digital illustrator & video editor.' },
    { name: 'Arjun Kapoor', email: 'arjun@example.com', avatar: 'A', is_host_verified: false, bio: 'DevOps lead sharing family productivity suites.' },
    { name: 'Ishita Roy', email: 'ishita@example.com', avatar: 'I', is_host_verified: false, bio: 'Student community coordinator.' },
    { name: 'Kabir Mehta', email: 'kabir@example.com', avatar: 'K', is_host_verified: false, bio: 'UI/UX mentor and studio owner.' },
    { name: 'Neha Gupta', email: 'neha@example.com', avatar: 'N', is_host_verified: false, bio: 'Audio engineer and music lover.' },
    { name: 'Vikram Nair', email: 'vikram@example.com', avatar: 'V', is_host_verified: false, bio: 'Tech enthusiast sharing premium family subs.' },
    { name: 'Ananya Iyer', email: 'ananya@example.com', avatar: 'A', is_host_verified: false, bio: 'Creative director & brand designer.' },
    { name: 'Dev Joshi', email: 'dev@example.com', avatar: 'D', is_host_verified: false, bio: 'College study group lead.' },
    { name: 'Sana Khan', email: 'sana@example.com', avatar: 'S', is_host_verified: false, bio: 'Podcast producer sharing audio tools.' },
    { name: 'Rohan Verma', email: 'rohan@example.com', avatar: 'R', is_host_verified: false, bio: 'Commercial photographer.' },
    { name: 'Priya Das', email: 'priya@example.com', avatar: 'P', is_host_verified: false, bio: 'Startup founder optimizing software cost.' },
    // General members
    { name: 'Tanvi Shah', email: 'tanvi@example.com', avatar: 'T', is_host_verified: false, bio: 'Member' },
    { name: 'Kunal Singhal', email: 'kunal@example.com', avatar: 'K', is_host_verified: false, bio: 'Member' },
    { name: 'Aditi Rao', email: 'aditi@example.com', avatar: 'A', is_host_verified: false, bio: 'Member' },
    { name: 'Sameer Sen', email: 'sameer@example.com', avatar: 'S', is_host_verified: false, bio: 'Member' },
    { name: 'Rhea Pillai', email: 'rhea@example.com', avatar: 'R', is_host_verified: false, bio: 'Member' }
  ];

  const userIds = {};
  for (const u of usersData) {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, avatar, is_host_verified, bio)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name`,
      [u.name, u.email, passwordHash, u.avatar, u.is_host_verified, u.bio]
    );
    const firstName = u.name.split(' ')[0];
    userIds[firstName] = res.rows[0].id;
    userIds[u.name] = res.rows[0].id;
  }
  console.log(`✅ Inserted ${usersData.length} users.`);

  // 2. Insert Services
  const servicesData = [
    { id: 'canva', name: 'Canva', category: 'Design', b1: '#00C4CC', b2: '#7D2AE8', default_plan: 'Teams plan', typical_price: 1499, max_seats: 5 },
    { id: 'adobe', name: 'Adobe Creative Cloud', category: 'Design', b1: '#FA0F00', b2: '#B30B00', default_plan: 'All apps, team seats', typical_price: 4999, max_seats: 10 },
    { id: 'figma', name: 'Figma', category: 'Design', b1: '#F24E1E', b2: '#A259FF', default_plan: 'Professional seats', typical_price: 3100, max_seats: 10 },
    { id: 'ms365', name: 'Microsoft 365', category: 'Productivity', b1: '#0078D4', b2: '#00A4EF', default_plan: 'Family plan', typical_price: 1079, max_seats: 6 },
    { id: 'notion', name: 'Notion', category: 'Productivity', b1: '#6B6B6B', b2: '#B8B8B4', default_plan: 'Plus, team workspace', typical_price: 1625, max_seats: 10 },
    { id: 'spotify', name: 'Spotify', category: 'Entertainment', b1: '#1DB954', b2: '#14833B', default_plan: 'Family plan', typical_price: 179, max_seats: 6 },
    { id: 'youtube', name: 'YouTube Premium', category: 'Entertainment', b1: '#FF0000', b2: '#A80000', default_plan: 'Family plan', typical_price: 189, max_seats: 5 }
  ];

  for (const s of servicesData) {
    await pool.query(
      `INSERT INTO services (id, name, category, b1, b2, default_plan, typical_price, max_seats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [s.id, s.name, s.category, s.b1, s.b2, s.default_plan, s.typical_price, s.max_seats]
    );
  }
  console.log(`✅ Inserted ${servicesData.length} services.`);

  // 3. Insert Groups (Parties)
  const partiesData = [
    { id: 'P-1042', svc: 'canva', plan: 'Teams plan', type: 'Team', price: 249, total: 6, taken: 4, host: 'Rahul', hc: false, days: 1 },
    { id: 'P-1043', svc: 'adobe', plan: 'All apps, team seats', type: 'Team', price: 799, total: 4, taken: 2, host: 'Meera', hc: false, days: 2 },
    { id: 'P-1044', svc: 'ms365', plan: 'Family plan', type: 'Family', price: 179, total: 6, taken: 5, host: 'Arjun', hc: false, days: 0 },
    { id: 'P-1045', svc: 'notion', plan: 'Plus, team workspace', type: 'Team', price: 325, total: 5, taken: 4, host: 'Ishita', hc: false, days: 3 },
    { id: 'P-1046', svc: 'figma', plan: 'Professional seats', type: 'Team', price: 620, total: 5, taken: 1, host: 'Kabir', hc: false, days: 5 },
    { id: 'P-1047', svc: 'spotify', plan: 'Family plan', type: 'Family', price: 99, total: 6, taken: 3, host: 'Neha', hc: false, days: 1 },
    { id: 'P-1048', svc: 'youtube', plan: 'Family plan', type: 'Family', price: 89, total: 5, taken: 5, host: 'Vikram', hc: false, days: 7 },
    { id: 'P-1049', svc: 'canva', plan: 'Teams plan', type: 'Team', price: 259, total: 5, taken: 1, host: 'Ananya', hc: false, days: 0 },
    { id: 'P-1050', svc: 'notion', plan: 'Plus, study group', type: 'Study group', price: 290, total: 4, taken: 2, host: 'Dev', hc: false, days: 4 },
    { id: 'P-1051', svc: 'spotify', plan: 'Duo plan', type: 'Duo', price: 129, total: 2, taken: 1, host: 'Sana', hc: false, days: 2 },
    { id: 'P-1052', svc: 'adobe', plan: 'Photography bundle', type: 'Team', price: 399, total: 4, taken: 3, host: 'Rohan', hc: false, days: 6 },
    { id: 'P-1053', svc: 'ms365', plan: 'Business Basic seats', type: 'Team', price: 210, total: 8, taken: 5, host: 'Priya', hc: false, days: 1 },
    // Also add one group hosted by Aarav for dashboard completeness:
    { id: 'P-1054', svc: 'figma', plan: 'Organization workspace', type: 'Team', price: 550, total: 4, taken: 2, host: 'Aarav', hc: false, days: 2 }
  ];

  const aaravId = userIds['Aarav'];
  const generalMemberIds = [
    userIds['Tanvi'],
    userIds['Kunal'],
    userIds['Aditi'],
    userIds['Sameer'],
    userIds['Rhea']
  ];

  for (const p of partiesData) {
    const hostId = userIds[p.host] || aaravId;
    await pool.query(
      `INSERT INTO groups (id, service_id, plan, type, price, total_seats, host_id, host_check_passed, days_ago)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [p.id, p.svc, p.plan, p.type, p.price, p.total, hostId, p.hc, p.days]
    );

    // Create seats for this group
    for (let seatNum = 1; seatNum <= p.total; seatNum++) {
      let status = 'open';
      let memberId = null;

      // Special memberships for Aarav (Matches dashboard preview: Canva Seat 3, Notion Seat 5, Spotify Seat 2)
      if (p.id === 'P-1042' && seatNum === 3) {
        status = 'rsv';
        memberId = aaravId;
      } else if (p.id === 'P-1045' && seatNum === 5) {
        status = 'rsv';
        memberId = aaravId;
      } else if (p.id === 'P-1047' && seatNum === 2) {
        status = 'rsv';
        memberId = aaravId;
      } else if (seatNum <= p.taken) {
        // Taken by other members
        status = 'mem';
        memberId = generalMemberIds[(seatNum + p.total) % generalMemberIds.length];
      }

      const seatRes = await pool.query(
        `INSERT INTO seats (group_id, seat_number, status, member_id, reserved_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [p.id, seatNum, status, memberId, status === 'rsv' || status === 'mem' ? new Date() : null]
      );

      // If occupied by Aarav, record official membership
      if (memberId === aaravId) {
        await pool.query(
          `INSERT INTO memberships (user_id, group_id, seat_id, seat_number, amount, status, payment_status)
           VALUES ($1, $2, $3, $4, $5, 'reserved', 'pending')`,
          [aaravId, p.id, seatRes.rows[0].id, seatNum, p.price]
        );
      }
    }
  }
  console.log(`✅ Inserted ${partiesData.length} groups with initialized seats.`);

  // 4. Insert Initial Activity Feed
  const initialActivities = [
    { tag: 'g', message: 'Seat 5 was reserved in a Canva group' },
    { tag: 'o', message: 'A seat opened in a Figma group' },
    { tag: 'b', message: 'New group listed: Spotify Duo' },
    { tag: 'g', message: 'Seat 5 was reserved in a Notion team workspace' }
  ];

  for (const a of initialActivities) {
    await pool.query(
      `INSERT INTO activity_logs (tag, message) VALUES ($1, $2)`,
      [a.tag, a.message]
    );
  }
  console.log(`✅ Inserted initial activity logs.`);

  // 5. Insert Notifications for Aarav
  const notificationsData = [
    { user_id: aaravId, title: 'You reserved Seat 3 in Canva Teams.', type: 'success' },
    { user_id: aaravId, title: 'This is a demo account with sample data.', type: 'info' }
  ];

  for (const n of notificationsData) {
    await pool.query(
      `INSERT INTO notifications (user_id, title, type) VALUES ($1, $2, $3)`,
      [n.user_id, n.title, n.type]
    );
  }
  console.log(`✅ Inserted sample notifications.`);

  console.log('🎉 Database seeded successfully!');
  await pool.end();
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = seed;
