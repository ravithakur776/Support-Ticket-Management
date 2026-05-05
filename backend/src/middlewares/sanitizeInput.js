function sanitizeMongoOperators(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeMongoOperators);
  }

  if (value && typeof value === 'object') {
    const sanitized = {};

    Object.entries(value).forEach(([key, nestedValue]) => {
      if (key.startsWith('$') || key.includes('.')) {
        return;
      }

      sanitized[key] = sanitizeMongoOperators(nestedValue);
    });

    return sanitized;
  }

  return value;
}

function sanitizeInput(req, res, next) {
  if (req.body) {
    req.body = sanitizeMongoOperators(req.body);
  }

  if (req.params) {
    req.params = sanitizeMongoOperators(req.params);
  }

  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach((key) => {
      if (key.startsWith('$') || key.includes('.')) {
        delete req.query[key];
        return;
      }

      req.query[key] = sanitizeMongoOperators(req.query[key]);
    });
  }

  next();
}

module.exports = { sanitizeInput };
