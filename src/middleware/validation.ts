import { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { sendValidationError } from '../services/openai';

export const validateRequestBody =
  (schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const validation = schema.safeParse(req.body ?? {});

    if (!validation.success) {
      return sendValidationError(res, validation.error.issues);
    }

    req.body = validation.data;
    next();
  };
