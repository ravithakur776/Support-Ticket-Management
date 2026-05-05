const bcrypt = require('bcryptjs');
const { body, param, query } = require('express-validator');
const User = require('../models/user.model');
const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/apiError');
const { USER_ROLES } = require('../utils/constants');
const { getPagination } = require('../utils/pagination');

const allowedRoles = [USER_ROLES.USER, USER_ROLES.AGENT, USER_ROLES.ADMIN];

const userValidators = {
  list: [
    query('role').optional().isIn(allowedRoles).withMessage(`role must be one of: ${allowedRoles.join(', ')}`),
    query('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
    query('search').optional().trim().isLength({ min: 1, max: 120 }).withMessage('search must be 1-120 characters'),
    query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
  ],
  update: [
    param('id').isMongoId().withMessage('Valid user id is required'),
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('name must be between 2 and 100 characters'),
    body('email').optional().trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('role').optional().isIn(allowedRoles).withMessage(`role must be one of: ${allowedRoles.join(', ')}`),
    body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
    body('password')
      .optional()
      .isLength({ min: 8 })
      .withMessage('password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('password must include at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('password must include at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('password must include at least one number'),
  ],
  remove: [param('id').isMongoId().withMessage('Valid user id is required')],
};

const getUsers = asyncHandler(async (req, res) => {
  const filters = {};
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 200, maxLimit: 200 });

  if (req.query.role) {
    filters.role = req.query.role;
  }

  if (req.query.isActive !== undefined) {
    filters.isActive = req.query.isActive === 'true';
  }

  if (req.query.search) {
    const safePattern = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safePattern, 'i');
    filters.$or = [{ name: regex }, { email: regex }];
  }

  const [users, totalCount] = await Promise.all([
    User.find(filters).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filters),
  ]);

  res.status(200).json({
    data: {
      count: users.length,
      totalCount,
      page,
      limit,
      totalPages: Math.max(Math.ceil(totalCount / limit), 1),
      users,
    },
  });
});

const updateUserById = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id).select('+passwordHash');
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  const isSelf = String(targetUser._id) === String(req.user._id);

  if (req.body.email && req.body.email !== targetUser.email) {
    const existing = await User.findOne({ email: req.body.email, _id: { $ne: targetUser._id } });
    if (existing) {
      throw new ApiError(409, 'Email is already in use by another account');
    }
  }

  if (isSelf && req.body.isActive === false) {
    throw new ApiError(400, 'Admins cannot deactivate their own account');
  }

  if (isSelf && req.body.role && req.body.role !== USER_ROLES.ADMIN) {
    throw new ApiError(400, 'Admins cannot remove their own admin role');
  }

  if (req.body.name !== undefined) targetUser.name = req.body.name;
  if (req.body.email !== undefined) targetUser.email = req.body.email;
  if (req.body.role !== undefined) targetUser.role = req.body.role;
  if (req.body.isActive !== undefined) targetUser.isActive = req.body.isActive;

  if (req.body.password) {
    targetUser.passwordHash = await bcrypt.hash(req.body.password, 12);
  }

  await targetUser.save();

  const updated = await User.findById(targetUser._id).select('-passwordHash');

  res.status(200).json({
    message: 'User updated successfully',
    data: {
      user: updated,
    },
  });
});

const deleteUserById = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  if (String(targetUser._id) === String(req.user._id)) {
    throw new ApiError(400, 'Admins cannot delete their own account');
  }

  targetUser.isActive = false;
  await targetUser.save();

  res.status(200).json({
    message: 'User account disabled successfully',
    data: {
      userId: targetUser._id,
      isActive: targetUser.isActive,
    },
  });
});

module.exports = {
  userValidators,
  getUsers,
  updateUserById,
  deleteUserById,
};
