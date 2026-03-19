import { Router } from 'express';
import { chatCompletions } from './chat.controller';

const router = Router();

router.post('/completions', chatCompletions as any);

export default router;
