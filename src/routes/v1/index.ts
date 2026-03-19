import { Router } from 'express';
import modelsRouter from './models';
import chatRouter from './chat';
import responsesRouter from './responses';

const router = Router();

router.use('/models', modelsRouter);
router.use('/chat', chatRouter);
router.use('/responses', responsesRouter);

export default router;
