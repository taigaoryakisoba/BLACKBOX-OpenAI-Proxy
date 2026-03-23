import app from './app';
import { PORT } from './configs/env';
import blackboxAuthService from './services/blackbox-auth';
import logger from './services/logger';

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  void blackboxAuthService.warmUp();
});
