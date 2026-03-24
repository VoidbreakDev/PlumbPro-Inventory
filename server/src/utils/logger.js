import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: isProduction ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: !isProduction }),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
