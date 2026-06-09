export type Vote = string | number | null;
export type RoomMode = 'live'; // 'async' reserved for the fast-follow

export interface Connection {
  sessionId: string;
  name: string;
  color: string;
  voter: boolean;
  vote: Vote;
  socketIds: string[]; // server-internal only; never sent to clients
}

export interface HistoryEntry {
  label: string;
  cardPack: string;
  votes: Array<{ vote: Vote }>;
  timestamp: number;
}

export interface RoomState {
  slug: string;
  mode: RoomMode;
  createdAt: number;
  adminSessionId: string | null;
  cardPack: string;
  forcedReveal: boolean;
  roundLabel: string;
  history: HistoryEntry[];
  connections: Record<string, Connection>; // keyed by sessionId
}

export interface PublicConnection {
  sessionId: string;
  name: string;
  color: string;
  voter: boolean;
  hasVoted: boolean;
  // Individual votes are intentionally NOT exposed per person — voting is anonymous.
}

export interface PublicRoom {
  slug: string;
  mode: RoomMode;
  adminSessionId: string | null;
  cardPack: string;
  forcedReveal: boolean;
  revealed: boolean;
  roundLabel: string;
  history: HistoryEntry[];
  connections: PublicConnection[];
  /** Revealed votes, anonymised: sorted and decoupled from identity. Empty until revealed. */
  votes: Vote[];
}

export type Ack = { ok: true } | { error: string };
