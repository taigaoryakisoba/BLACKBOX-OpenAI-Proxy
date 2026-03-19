import { Router } from 'express';
import { getModels } from './models.controller';

const router = Router();

router.get('/', getModels as any);

export default router;
