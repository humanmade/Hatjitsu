import { describe, it, expect } from 'vitest';
import { createApp } from './http';

describe('http app', () => {
  it('serves /healthz', async () => {
    const app = createApp();
    const { createServer } = await import('node:http');
    const server = createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as { port: number };
    const res = await fetch(`http://localhost:${port}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    server.close();
  });
});
