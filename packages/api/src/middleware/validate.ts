import { Request, Response, NextFunction } from 'express';
import { Validator } from 'simple-body-validator';

/**
 * Middleware to validate request body using simple-body-validator.
 * @param rules Validation rules
 */
export const validate = (rules: Record<string, any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validator = new Validator(req.body, rules);

    if (!validator.validate()) {
      return res.status(422).json({
        status: 'error',
        message: 'Validation failed',
        code: 422,
        errors: validator.errors().all(),
      });
    }

    next();
  };
};
