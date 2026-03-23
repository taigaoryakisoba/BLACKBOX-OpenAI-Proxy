import { Router } from 'express';
import modelsRouter from './models';
import chatRouter from './chat';
import completionsRouter from './completions';
import responsesRouter from './responses';
import { validateRequestBody } from '../../middleware/validation';
import { CompletionsBodySchema } from '../../schemas/openai';

const router = Router();

router.use('/models', modelsRouter);
router.use('/chat', chatRouter);
router.use(
  '/completions',
  validateRequestBody(CompletionsBodySchema),
  completionsRouter
);
router.use('/responses', responsesRouter);

export default router;
