const { format } = require('util');
const env = process.env.NODE_ENV || 'development';

const logger = {
  info: (...args) => console.log('[INFO]', format(...args)),
  warn: (...args) => console.warn('[WARN]', format(...args)),
  error: (...args) => console.error('[ERROR]', format(...args)),
  debug: (...args) => {
    if (env !== 'production') {
      console.log('[DEBUG]', format(...args));
    }
  }
};

module.exports = logger;
