import type { PublicRoom, Ack } from './types.js';
import type { JoinPayload, VotePayload, CardPackPayload, NamePayload, LabelPayload, TogglePayload } from './schemas.js';

export interface ClientToServerEvents {
  'room:create': (cb: (res: { slug: string }) => void) => void;
  'room:join': (data: JoinPayload, cb: (res: PublicRoom | { error: string }) => void) => void;
  'room:info': (data: { slug: string }, cb: (res: PublicRoom | { error: string }) => void) => void;
  'vote': (data: VotePayload, cb: (res: Ack) => void) => void;
  'unvote': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'vote:reset': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'reveal:force': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'name:set': (data: NamePayload, cb: (res: Ack) => void) => void;
  'round:label': (data: LabelPayload, cb: (res: Ack) => void) => void;
  'voter:toggle': (data: TogglePayload, cb: (res: Ack) => void) => void;
  'cardpack:set': (data: CardPackPayload, cb: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:update': (room: PublicRoom) => void;
}

export interface SocketData {
  sessionId: string;
  slug: string;
}
