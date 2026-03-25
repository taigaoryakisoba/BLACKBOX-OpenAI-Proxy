import { Router } from 'express';
import { completions } from './completions.controller';

const router = Router();

router.post('/', completions);

export default router;
