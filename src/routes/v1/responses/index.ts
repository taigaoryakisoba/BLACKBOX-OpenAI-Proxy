import { Router } from 'express';
import {
  responses,
  retrieveResponse,
  cancelResponse,
  compact,
} from './responses.controller';

const router = Router();

router.post('/compact', compact);
router.post('/', responses);
router.get('/:responseId', retrieveResponse);
router.post('/:responseId/cancel', cancelResponse);

export default router;
