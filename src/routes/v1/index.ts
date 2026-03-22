import { Router } from 'express';
import modelsRouter from './models';
import chatRouter from './chat';
import completionsRouter from './completions';
import responsesRouter from './responses';

const router = Router();

router.use('/models', modelsRouter);
router.use('/chat', chatRouter);
router.use('/completions', completionsRouter);
router.use('/responses', responsesRouter);

export default router;
