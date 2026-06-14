const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log for developer
  console.error('Error Stack:', err.stack || err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    return res.status(404).json({ success: false, error: message });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = `Duplicate field value entered: ${Object.keys(err.keyValue).join(', ')}`;
    return res.status(400).json({ success: false, error: message });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    return res.status(400).json({ success: false, error: message });
  }

  // Zod Validation Error (from request body parsing)
  if (err.name === 'ZodError') {
    const errorDetails = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errorDetails
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};

module.exports = errorHandler;
