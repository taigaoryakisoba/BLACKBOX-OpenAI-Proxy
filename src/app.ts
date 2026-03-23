import express from 'express';
import cors from 'cors';
import { CORS_ORIGINS } from './configs/env';
import routes from './routes';
import { authMiddleware } from './middleware/auth';
import { loggerMiddleware } from './middleware/logger';

const app = express();

app.use(
  cors({
    origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : '*',
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(loggerMiddleware);
app.use(authMiddleware);

app.use('/', routes);

export default app;
