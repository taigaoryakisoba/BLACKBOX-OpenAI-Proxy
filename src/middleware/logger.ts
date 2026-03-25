import { Request, Response, NextFunction } from 'express';
import logger from '../services/logger';
import { genId } from '../utils/utils';

// ログミドルウェアを作成
export const loggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.reqId ??= genId();
  logger.info(`[${req.reqId}] Incoming request: ${req.method} ${req.url}`);

  // リクエスト処理後にもログを出力
  res.on('finish', () => {
    logger.info(`[${req.reqId}] Response status: ${res.statusCode}`);
  });

  next();
};
