// Context7: consulted for winston
// Critical-Engineer: consulted for Logging strategy and stdio protocol safety
// Logger configuration for MCP server
// CRITICAL: All logging MUST go to stderr to prevent stdout protocol contamination
// The MCP protocol uses stdout exclusively for JSON-RPC messages

import winston from 'winston';

const level = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
  level: level,
  format: winston.format.json(), // ALWAYS log JSON in production for parseability
  transports: [
    new winston.transports.Console({
      // ALL levels to stderr to keep stdout clean for MCP protocol
      stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// CRITICAL: Capture and redirect all console.log/warn/error from dependencies
// This prevents any third-party library from contaminating stdout
console.log = (...args: any[]) => {
  // Convert multiple args to a single message object for winston
  if (args.length === 0) return;
  if (args.length === 1) {
    logger.info(args[0]);
  } else {
    // For multiple args, use first as message, rest as metadata
    const [message, ...meta] = args;
    logger.info(message, { metadata: meta });
  }
};

console.info = (...args: any[]) => {
  if (args.length === 0) return;
  if (args.length === 1) {
    logger.info(args[0]);
  } else {
    const [message, ...meta] = args;
    logger.info(message, { metadata: meta });
  }
};

console.warn = (...args: any[]) => {
  if (args.length === 0) return;
  if (args.length === 1) {
    logger.warn(args[0]);
  } else {
    const [message, ...meta] = args;
    logger.warn(message, { metadata: meta });
  }
};

console.error = (...args: any[]) => {
  if (args.length === 0) return;
  if (args.length === 1) {
    logger.error(args[0]);
  } else {
    const [message, ...meta] = args;
    logger.error(message, { metadata: meta });
  }
};

export default logger;