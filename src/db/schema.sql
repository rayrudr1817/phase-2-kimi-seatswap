-- SeatSwap Database Schema (PostgreSQL)

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(10) DEFAULT '',
  is_host_verified BOOLEAN DEFAULT false,
  bio TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Subscription Services
CREATE TABLE services (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  b1 VARCHAR(20) NOT NULL,
  b2 VARCHAR(20) NOT NULL,
  default_plan VARCHAR(100),
  typical_price NUMERIC(10, 2),
  max_seats INT DEFAULT 6,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Shared Groups (Parties)
CREATE TABLE groups (
  id VARCHAR(50) PRIMARY KEY,
  service_id VARCHAR(50) NOT NULL REFERENCES services(id),
  plan VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  total_seats INT NOT NULL CHECK (total_seats >= 2 AND total_seats <= 12),
  host_id INT NOT NULL REFERENCES users(id),
  host_check_passed BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  days_ago INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Group Seats
CREATE TABLE seats (
  id SERIAL PRIMARY KEY,
  group_id VARCHAR(50) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  seat_number INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'mem' (taken), 'rsv' (reserved, payment pending), 'ver', 'act' (confirmed; not reachable until payments exist)
  member_id INT REFERENCES users(id),
  reserved_at TIMESTAMP WITH TIME ZONE,
  activated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(group_id, seat_number)
);

-- 5. Memberships (Held seats & transactions)
CREATE TABLE memberships (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  group_id VARCHAR(50) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  seat_id INT NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  seat_number INT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'reserved', -- 'reserved' (payment pending), 'active' (payment confirmed; not reachable yet), 'cancelled'
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'refunded' (payments are not integrated yet)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Activity Logs
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  tag VARCHAR(5) DEFAULT 'g', -- 'g' (green), 'b' (blue), 'o' (orange)
  message TEXT NOT NULL,
  group_id VARCHAR(50) REFERENCES groups(id) ON DELETE SET NULL,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Notifications
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(20) DEFAULT 'info', -- 'success', 'info', 'warning'
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance & quick lookup
CREATE INDEX idx_groups_service ON groups(service_id);
CREATE INDEX idx_groups_host ON groups(host_id);
CREATE INDEX idx_seats_group ON seats(group_id);
CREATE INDEX idx_seats_member ON seats(member_id);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
