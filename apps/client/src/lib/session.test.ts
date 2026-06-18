import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionId, getRecentRooms, rememberRoom, forgetRoom, clearRecentRooms } from './session';

beforeEach(() => localStorage.clear());

describe('getSessionId', () => {
  it('creates and persists a stable id', () => {
    const a = getSessionId();
    expect(a).toMatch(/[0-9a-f-]{36}/);
    expect(getSessionId()).toBe(a);
  });
});

describe('recent rooms', () => {
  it('remembers a room and returns it', () => {
    rememberRoom('happy-otter');
    expect(getRecentRooms().map((r) => r.slug)).toEqual(['happy-otter']);
  });

  it('dedupes by slug, most-recent first', () => {
    rememberRoom('a'); rememberRoom('b'); rememberRoom('a');
    expect(getRecentRooms().map((r) => r.slug)).toEqual(['a', 'b']);
  });

  it('caps the list at 12', () => {
    for (let i = 0; i < 15; i++) rememberRoom(`room-${i}`);
    const rooms = getRecentRooms();
    expect(rooms).toHaveLength(12);
    expect(rooms[0].slug).toBe('room-14'); // newest kept
    expect(rooms.some((r) => r.slug === 'room-0')).toBe(false); // oldest dropped
  });

  it('forgets a single room and clears all', () => {
    rememberRoom('a'); rememberRoom('b');
    forgetRoom('a');
    expect(getRecentRooms().map((r) => r.slug)).toEqual(['b']);
    clearRecentRooms();
    expect(getRecentRooms()).toEqual([]);
  });

  it('returns [] when storage is empty or corrupt', () => {
    localStorage.setItem('hmpp:rooms', 'not json');
    expect(getRecentRooms()).toEqual([]);
  });
});
