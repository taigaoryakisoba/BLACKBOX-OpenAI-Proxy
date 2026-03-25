import { Router } from 'express';
import { getModels } from './models.controller';

const router = Router();

router.get('/', getModels);

export default router;
