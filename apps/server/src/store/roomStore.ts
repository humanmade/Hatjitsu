import Database from 'better-sqlite3';
import type { RoomState } from '@hmpp/shared';
import { LIVE_TTL_SECONDS } from '../config.js';

export class RoomStore {
  private db: Database.Database;

  constructor(dbPath: string, private ttlSeconds: number = LIVE_TTL_SECONDS) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS rooms (slug TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    );
  }

  private sweep(): void {
    const cutoff = Date.now() - this.ttlSeconds * 1000;
    this.db.prepare('DELETE FROM rooms WHERE updated_at < ?').run(cutoff);
  }

  async load(slug: string): Promise<RoomState | null> {
    this.sweep();
    const row = this.db.prepare('SELECT state FROM rooms WHERE slug = ?').get(slug) as
      | { state: string }
      | undefined;
    return row ? (JSON.parse(row.state) as RoomState) : null;
  }

  async save(state: RoomState): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO rooms (slug, state, updated_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(slug) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at',
      )
      .run(state.slug, JSON.stringify(state), Date.now());
  }

  async exists(slug: string): Promise<boolean> {
    return !!this.db.prepare('SELECT 1 FROM rooms WHERE slug = ?').get(slug);
  }

  async delete(slug: string): Promise<void> {
    this.db.prepare('DELETE FROM rooms WHERE slug = ?').run(slug);
  }

  close(): void {
    this.db.close();
  }
}
