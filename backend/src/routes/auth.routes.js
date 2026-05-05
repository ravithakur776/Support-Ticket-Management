const express = require('express');
const validateRequest = require('../middlewares/validateRequest');
const { protect } = require('../middlewares/auth.middleware');
const { authValidators, register, login, logout, me } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', authValidators.register, validateRequest, register);
router.post('/login', authValidators.login, validateRequest, login);
router.post('/logout', logout);
router.get('/me', protect, me);

module.exports = router;
