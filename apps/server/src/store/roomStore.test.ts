import { describe, it, expect } from 'vitest';
import { RoomStore } from './roomStore';
import { createRoom, recordVote, enter } from '../domain/room';

const newStore = () => new RoomStore(':memory:', 100);

describe('RoomStore', () => {
  it('returns null for an unknown room', async () => {
    expect(await newStore().load('nope')).toBeNull();
  });
  it('round-trips room state', async () => {
    const store = newStore();
    let s = createRoom('happy-otter');
    s = enter(s, { sessionId: 'a', socketId: 'sa' });
    s = recordVote(s, 'a', '5');
    await store.save(s);
    const loaded = await store.load('happy-otter');
    expect(loaded?.connections['a'].vote).toBe('5');
  });
  it('reports existence and deletes', async () => {
    const store = newStore();
    await store.save(createRoom('r'));
    expect(await store.exists('r')).toBe(true);
    await store.delete('r');
    expect(await store.exists('r')).toBe(false);
  });
  it('sweeps rooms older than the TTL on load', async () => {
    const store = new RoomStore(':memory:', 0); // ttl 0 => everything is immediately stale
    await store.save(createRoom('old'));
    await new Promise((r) => setTimeout(r, 5));
    expect(await store.load('old')).toBeNull();
  });
});
