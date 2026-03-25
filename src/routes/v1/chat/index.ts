import { Router } from 'express';
import { chatCompletions } from './chat.controller';

const router = Router();

router.post('/completions', chatCompletions);

export default router;
