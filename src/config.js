// Central, environment-aware configuration.
// Anything security-relevant (JWT secret, CORS, demo/dev features) is decided here.
//
// Fail-safe rule: only NODE_ENV=development (or "test") counts as a development
// environment. If NODE_ENV is unset or anything else, the strict (production)
// behaviour applies.
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || '';
const isDevelopment = NODE_ENV === 'development' || NODE_ENV === 'test';
const isProduction = !isDevelopment;

// ---- JWT secret ---------------------------------------------------------------
const DEV_ONLY_JWT_SECRET = 'dev-only-insecure-secret--never-use-in-production';
const KNOWN_WEAK_SECRETS = new Set([
  'seatswap_super_secret_jwt_key_2026',
  'replace-with-a-long-random-string',
  'change-me',
  'changeme',
  'secret',
  DEV_ONLY_JWT_SECRET
]);

function resolveJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (isProduction) {
    if (!configured || configured.length < 32 || KNOWN_WEAK_SECRETS.has(configured)) {
      throw new Error(
        'JWT_SECRET must be set to a unique random value of at least 32 characters outside development. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
      );
    }
    return configured;
  }
  if (!configured) {
    console.warn('[config] JWT_SECRET is not set. Using a development-only secret. Do not deploy like this.');
    return DEV_ONLY_JWT_SECRET;
  }
  return configured;
}

const JWT_SECRET = resolveJwtSecret();

// ---- Demo / development features -----------------------------------------------
// Demo account switching and the in-page developer tools require an explicit
// opt-in AND a development environment. They can never be switched on in production.
const demoEnabled = isDevelopment && process.env.DEMO_MODE === 'true';
const devToolsEnabled = isDevelopment && process.env.DEV_TOOLS === 'true';

// Demo switching may only ever target these seeded accounts.
const DEMO_EMAILS = [
  'aarav@example.com',
  'rahul@example.com',
  'meera@example.com',
  'arjun@example.com',
  'ishita@example.com'
];

// ---- CORS -----------------------------------------------------------------------
// CORS_ORIGINS: comma-separated list of allowed browser origins.
// Production: only those origins (none configured => same-origin only).
// Development: those origins plus localhost / 127.0.0.1 on any port.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function corsOriginCheck(origin, callback) {
  // No Origin header: same-origin navigation, curl, server-to-server.
  if (!origin) return callback(null, true);
  if (corsOrigins.includes(origin)) return callback(null, true);
  if (isDevelopment && LOCAL_ORIGIN.test(origin)) return callback(null, true);
  return callback(null, false);
}

module.exports = {
  NODE_ENV,
  isDevelopment,
  isProduction,
  JWT_SECRET,
  demoEnabled,
  devToolsEnabled,
  DEMO_EMAILS,
  corsOriginCheck
};
