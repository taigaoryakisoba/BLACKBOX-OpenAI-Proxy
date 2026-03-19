import { Logger } from 'tslog';
import { DEBUG_LOG } from '../configs/env';

const logger = new Logger({
  name: 'BlackboxProxy',
  type: 'pretty',
  minLevel: DEBUG_LOG ? 2 : 3, // 2 is debug, 3 is info
  prettyLogTemplate:
    '{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}.{{ms}} [{{logLevelName}}] [{{name}}] ',
});

export default logger;
