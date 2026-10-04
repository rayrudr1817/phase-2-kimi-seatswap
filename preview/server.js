// Preview harness: runs the real SeatSwap app against an in-memory database,
// so the site can be previewed anywhere without PostgreSQL.
// Demo-mode sign-in is enabled (development semantics); data resets on restart.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.DEMO_MODE = process.env.DEMO_MODE || 'true';
process.env.DOTENV_CONFIG_QUIET = 'true';
process.env.DOTENV_CONFIG_PATH = require('path').join(__dirname, 'no-such.env'); // never read a real .env

const path = require('path');
const dbPath = require.resolve(path.join(__dirname, '../src/db/index.js'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: require('./previewdb') };
require(path.join(__dirname, '../src/server.js'));
