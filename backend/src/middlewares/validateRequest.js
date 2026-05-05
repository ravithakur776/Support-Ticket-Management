const { validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, `Validation error: ${errors.array()[0].msg}`);
  }

  next();
};

module.exports = validateRequest;
