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
  /** Latched: once a round reveals (all voters voted, or forced) it stays revealed until
   * reset/deck-change. Voting is locked while true; late joiners don't un-reveal it. */
  revealed: boolean;
  roundLabel: string;
  history: HistoryEntry[];
  connections: Record<string, Connection>; // keyed by sessionId
  /** true: drop a participant when their last tab closes (sync). false: keep them (async). */
  ejectOnLeave: boolean;
}

export interface PublicConnection {
  sessionId: string;
  name: string;
  color: string;
  voter: boolean;
  hasVoted: boolean;
  connected: boolean; // false = present in the roster but their tab is closed (keep mode)
  // Individual votes are intentionally NOT exposed per person — voting is anonymous.
}

export interface PublicRoom {
  slug: string;
  mode: RoomMode;
  adminSessionId: string | null;
  cardPack: string;
  revealed: boolean;
  roundLabel: string;
  history: HistoryEntry[];
  connections: PublicConnection[];
  /** Revealed votes, anonymised: sorted and decoupled from identity. Empty until revealed. */
  votes: Vote[];
  ejectOnLeave: boolean;
}

export type Ack = { ok: true } | { error: string };

/** Per-room standing returned by `rooms:status`. `active:true` is only ever sent for a
 * room whose roster contains the requesting sessionId (membership gate), so a non-member
 * and a non-existent room are indistinguishable. */
export type RoomStatus =
  | { slug: string; active: false }
  | {
      slug: string;
      active: true;
      connected: boolean; // you have a live tab open in this room right now
      voter: boolean;
      hasVoted: boolean;
      revealed: boolean;
      roundLabel: string;
      count: number;
      /** Last completed round's reveal time, else the room's creation time. */
      lastActivityAt: number;
    };

/** The room:join ack: the public room plus the joiner's OWN vote (sent only to them, so
 * anonymity holds), letting a returning tab restore its highlighted selection. */
export type JoinResult = PublicRoom & { yourVote: Vote };
