const jwt = require('jsonwebtoken');
const config = require('../config/env');

const signToken = (payload) => jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

module.exports = {
  signToken,
  verifyToken,
};
