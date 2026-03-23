import app from './app';
import { PORT } from './configs/env';
import blackboxAuthService from './services/blackbox-auth';
import blackboxValidationService from './services/blackbox-validation';
import logger from './services/logger';

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  void Promise.all([
    blackboxAuthService.warmUp(),
    blackboxValidationService.warmUp(),
  ]);
});
