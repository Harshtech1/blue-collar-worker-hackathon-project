import { z } from 'zod';

export const validate = (schema) => (req, res, next) => {
  try {
    const parsedBody = schema.parse(req.body);
    // Replace req.body with the validated data (strips unwanted fields and enforces types)
    req.body = parsedBody;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Data validation failed',
      errors: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }))
    });
  }
};
