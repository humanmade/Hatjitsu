import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In the built image the client is copied next to the server dist as ./public
// Resolve relative paths against cwd so res.sendFile (which requires absolute) always gets an absolute path.
const CLIENT_DIR = path.resolve(process.env.CLIENT_DIR || path.join(__dirname, 'public'));

export function createApp(): Express {
  const app = express();
  app.get('/healthz', (_req, res) => { res.type('text').send('ok'); });
  app.use(express.static(CLIENT_DIR, { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));
  // SPA fallback: any non-asset, non-socket route returns index.html
  app.get(/^(?!\/socket\.io).*/, (_req, res) => { res.sendFile(path.join(CLIENT_DIR, 'index.html')); });
  return app;
}
