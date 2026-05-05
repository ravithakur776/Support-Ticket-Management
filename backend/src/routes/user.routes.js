const express = require('express');
const validateRequest = require('../middlewares/validateRequest');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { getUsers, updateUserById, deleteUserById, userValidators } = require('../controllers/user.controller');
const { USER_ROLES } = require('../utils/constants');

const router = express.Router();

router.use(protect, authorize(USER_ROLES.ADMIN));

router.get('/', userValidators.list, validateRequest, getUsers);
router.put('/:id', userValidators.update, validateRequest, updateUserById);
router.delete('/:id', userValidators.remove, validateRequest, deleteUserById);

module.exports = router;
