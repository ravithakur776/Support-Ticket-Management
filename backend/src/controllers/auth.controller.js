const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/apiError');
const { signToken } = require('../utils/jwt');
const config = require('../config/env');
const User = require('../models/user.model');

const authValidators = {
  register: [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('Password must include at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must include at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must include at least one number'),
  ],
  login: [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
};

const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'lax',
  maxAge: config.jwtCookieExpiresDays * 24 * 60 * 60 * 1000,
};

const shapeAuthResponse = (user, token) => ({
  message: 'Authentication successful',
  data: {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  },
});

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'user',
  });

  const token = signToken({ userId: user._id, role: user.role });
  res.cookie('token', token, cookieOptions);

  res.status(201).json(shapeAuthResponse(user, token));
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = signToken({ userId: user._id, role: user.role });
  res.cookie('token', token, cookieOptions);

  res.status(200).json(shapeAuthResponse(user, token));
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
  });

  res.status(200).json({ message: 'Logout successful' });
});

const me = asyncHandler(async (req, res) => {
  res.status(200).json({
    data: {
      user: req.user,
    },
  });
});

module.exports = {
  authValidators,
  register,
  login,
  logout,
  me,
};
