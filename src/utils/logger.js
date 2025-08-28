// Simple logger, only writes to console in development
const isDev = process.env.NODE_ENV === 'development';

export const debug = (...args) => { if (isDev) console.debug(...args); };
export const info = (...args) => { if (isDev) console.info(...args); };
export const warn = (...args) => { if (isDev) console.warn(...args); };
export const error = (...args) => { if (isDev) console.error(...args); };

const logger = {
  debug,
  info,
  warn,
  error
};

export default logger;
