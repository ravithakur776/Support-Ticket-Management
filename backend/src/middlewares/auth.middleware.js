const ApiError = require('../utils/apiError');
const asyncHandler = require('./asyncHandler');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/user.model');

const extractToken = (req) => {
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};

const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw new ApiError(401, 'Unauthorized: Missing token');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    throw new ApiError(401, 'Unauthorized: Invalid or expired token');
  }

  const user = await User.findById(decoded.userId).select('-passwordHash');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Unauthorized: User no longer active');
  }

  req.user = user;
  next();
});

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Unauthorized: User context missing'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, 'Forbidden: Insufficient permissions'));
  }

  return next();
};

module.exports = {
  protect,
  authorize,
};
