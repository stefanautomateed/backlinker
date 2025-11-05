import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logsDir = join(__dirname, '../../logs');

/**
 * Winston logger configuration
 */
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'backlinker' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: join(logsDir, 'combined.log'),
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
    }),
    // Write submission results to submissions.log
    new winston.transports.File({
      filename: join(logsDir, 'submissions.log'),
      level: 'info',
    }),
  ],
});

/**
 * Log submission attempt
 */
export function logSubmission(directory, status, details = {}) {
  logger.info('Submission attempt', {
    directory: directory.name,
    url: directory.url,
    status,
    ...details,
  });
}

/**
 * Log error
 */
export function logError(context, error, details = {}) {
  logger.error('Error occurred', {
    context,
    error: error.message,
    stack: error.stack,
    ...details,
  });
}

/**
 * Log info
 */
export function logInfo(message, details = {}) {
  logger.info(message, details);
}
