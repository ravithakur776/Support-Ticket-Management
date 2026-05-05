const dotenv = require('dotenv');

dotenv.config();

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const parseCsv = (value) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseTrustProxy = (value) => {
  if (value === undefined) {
    return 1;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  const parsedNumber = Number(normalized);
  if (Number.isInteger(parsedNumber) && parsedNumber >= 0) {
    return parsedNumber;
  }

  return value;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5001,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtCookieExpiresDays: Number(process.env.JWT_COOKIE_EXPIRES_DAYS) || 1,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  corsOrigins: parseCsv(process.env.CORS_ORIGIN || 'http://localhost:4200,http://127.0.0.1:4200'),
};
