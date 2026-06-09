type Level = 'info' | 'warn' | 'error' | 'debug';
function log(level: Level, msg: string, meta?: unknown) {
  const line = { t: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) };
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](JSON.stringify(line));
}
export const logger = {
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
  debug: (m: string, meta?: unknown) => { if (process.env.NODE_ENV !== 'production') log('debug', m, meta); },
};
