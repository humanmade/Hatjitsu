import { create } from 'zustand';
import type { PublicRoom } from '@hmpp/shared';

interface RoomStore {
  room: PublicRoom | null;
  setRoom: (room: PublicRoom) => void;
  clear: () => void;
}
export const useRoom = create<RoomStore>((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  clear: () => set({ room: null }),
}));
