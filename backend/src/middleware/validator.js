const validate = (schema) => (req, res, next) => {
  try {
    // We only parse request body by default, but we can extend this to params or query if needed
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }
    if (schema.query) {
      req.query = schema.query.parse(req.query);
    }
    if (schema.params) {
      req.params = schema.params.parse(req.params);
    }
    next();
  } catch (error) {
    next(error); // Pass ZodError to the global error handler
  }
};

module.exports = validate;
