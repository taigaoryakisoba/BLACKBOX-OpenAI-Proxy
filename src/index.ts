import app from './app';
import { PORT } from './configs/env';
import logger from './services/logger';

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
