const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { xss } = require('express-xss-sanitizer');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const config = require('./config/env');
const apiRoutes = require('./routes');
const { sanitizeInput } = require('./middlewares/sanitizeInput');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();
const normalizeOrigin = (origin) => origin.toLowerCase().replace(/\/$/, '');
const allowedOrigins = new Set(config.corsOrigins.map(normalizeOrigin));

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(normalizeOrigin(origin))) {
        return callback(null, true);
      }

      const corsError = new Error(`CORS blocked for origin: ${origin}`);
      corsError.statusCode = 403;
      corsError.status = 'fail';
      return callback(corsError);
    },
    credentials: true,
    maxAge: 60 * 60,
    optionsSuccessStatus: 204,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput);
app.use(xss());
app.use(hpp());

if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api', limiter);
app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
