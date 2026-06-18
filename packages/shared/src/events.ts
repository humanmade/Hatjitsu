import type { PublicRoom, JoinResult, Ack, RoomStatus } from './types.js';
import type { JoinPayload, VotePayload, CardPackPayload, NamePayload, LabelPayload, TogglePayload, EjectPayload, FacilitatorPassPayload, RoomsStatusPayload } from './schemas.js';

export interface ClientToServerEvents {
  'room:create': (cb: (res: { slug: string }) => void) => void;
  'room:join': (data: JoinPayload, cb: (res: JoinResult | { error: string }) => void) => void;
  'room:info': (data: { slug: string }, cb: (res: PublicRoom | { error: string }) => void) => void;
  'rooms:status': (data: RoomsStatusPayload, cb: (res: RoomStatus[] | { error: string }) => void) => void;
  'vote': (data: VotePayload, cb: (res: Ack) => void) => void;
  'unvote': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'vote:reset': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'reveal:force': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'name:set': (data: NamePayload, cb: (res: Ack) => void) => void;
  'round:label': (data: LabelPayload, cb: (res: Ack) => void) => void;
  'voter:toggle': (data: TogglePayload, cb: (res: Ack) => void) => void;
  'cardpack:set': (data: CardPackPayload, cb: (res: Ack) => void) => void;
  'eject:set': (data: EjectPayload, cb: (res: Ack) => void) => void;
  // Claim the facilitator seat (only when vacant or its holder is disconnected);
  // pass it to another connected participant (only by the current facilitator).
  'facilitator:claim': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'facilitator:pass': (data: FacilitatorPassPayload, cb: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:update': (room: PublicRoom) => void;
  // Broadcast to everyone when the server is shutting down (e.g. a redeploy) so clients can
  // set expectations before the socket drops and auto-reconnect takes over.
  'server:maintenance': () => void;
}

export interface SocketData {
  sessionId: string;
  slug: string;
}
