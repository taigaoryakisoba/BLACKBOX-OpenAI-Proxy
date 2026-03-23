import { timingSafeEqual } from 'node:crypto';
import { RequestHandler } from 'express';
import { PROXY_BEARER_TOKEN } from '../configs/env';
import { sendOpenAIError } from '../services/openai';

const WWW_AUTHENTICATE_HEADER = 'Bearer realm="BLACKBOX-OpenAI-Proxy"';

const secureCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const extractBearerToken = (
  authorizationHeader?: string
): string | null => {
  if (!authorizationHeader) return null;

  const [scheme, ...parts] = authorizationHeader.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;

  const token = parts.join(' ').trim();
  return token ? token : null;
};

const sendUnauthorized = (res: Parameters<RequestHandler>[1]) => {
  res.setHeader('WWW-Authenticate', WWW_AUTHENTICATE_HEADER);
  return sendOpenAIError(
    res,
    401,
    'Invalid or missing bearer token.',
    'invalid_api_key'
  );
};

export const createAuthMiddleware = (expectedToken: string): RequestHandler => {
  const normalizedToken = expectedToken.trim();

  return (req, res, next) => {
    if (!normalizedToken) {
      next();
      return;
    }

    const providedToken = extractBearerToken(req.header('authorization'));
    if (!providedToken || !secureCompare(providedToken, normalizedToken)) {
      sendUnauthorized(res);
      return;
    }

    next();
  };
};

export const authMiddleware = createAuthMiddleware(PROXY_BEARER_TOKEN);
