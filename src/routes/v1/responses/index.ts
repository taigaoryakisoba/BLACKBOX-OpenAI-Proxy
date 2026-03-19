import { Router } from 'express';
import { responses } from './responses.controller';

const router = Router();

router.post('/', responses as any);

export default router;
