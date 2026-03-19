import { Request, Response } from 'express';
import { MODEL_CONFIG } from '../../../configs/models';

export const getModels = (_req: Request, res: Response) => {
  const uniqueModelNames = Array.from(
    new Set(Object.values(MODEL_CONFIG).map((m) => m.name))
  );
  return res.json({
    object: 'list',
    data: uniqueModelNames.map((id) => ({
      id,
      object: 'model',
      owned_by: 'proxy',
    })),
  });
};
