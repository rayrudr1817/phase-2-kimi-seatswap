// Loads the real app with an in-memory stand-in for src/db (NOT PostgreSQL).
// It exercises route/middleware logic only; it does not test SQL against a real database.
const path = require('path');
const ROOT = path.join(__dirname, '..');
module.exports = function load(env = {}) {
  for (const k of ['NODE_ENV', 'JWT_SECRET', 'DEMO_MODE', 'DEV_TOOLS', 'CORS_ORIGINS']) delete process.env[k];
  Object.assign(process.env, env);
  process.env.DOTENV_CONFIG_QUIET = 'true';
  process.env.DOTENV_CONFIG_PATH = path.join(__dirname, 'no-such.env'); // never read the real .env in tests
  process.env.PORT = '0';
  for (const k of Object.keys(require.cache)) if (k.startsWith(ROOT + path.sep + 'src') || k.endsWith('fakedb.js')) delete require.cache[k];
  const dbPath = require.resolve(path.join(ROOT, 'src/db/index.js'));
  const fake = require('./fakedb');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fake };
  const app = require(path.join(ROOT, 'src/server.js'));
  return { app, fake };
};
