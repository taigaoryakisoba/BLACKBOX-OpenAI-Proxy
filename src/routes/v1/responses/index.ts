import { Router } from 'express';
import {
  responses,
  retrieveResponse,
  cancelResponse,
  compact,
} from './responses.controller';

const router = Router();

router.post('/compact', compact as any);
router.post('/', responses as any);
router.get('/:responseId', retrieveResponse as any);
router.post('/:responseId/cancel', cancelResponse as any);

export default router;
