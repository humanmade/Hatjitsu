const env = process.env.NODE_ENV || 'development';

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => {
    if (env !== 'production') {
      console.log('[DEBUG]', ...args);
    }
  }
};

module.exports = logger;
