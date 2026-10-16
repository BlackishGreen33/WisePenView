import { create } from 'zustand';

import {
  createNoteAnchorRequest,
  type NoteAnchorRequest,
} from '@/components/editors/note/noteAnchorNavigationModel';
import type { NoteLinkTarget } from '@/components/editors/note/noteLinkProtocol';
import { registerStore } from '@/store/lifecycle';

interface NoteAnchorNavigationState {
  /** 待消费的定位请求；仅保存最近一次，新请求覆盖旧请求 */
  pending: NoteAnchorRequest | null;
  requestIdSeed: number;
  requestNoteAnchor: (target: NoteLinkTarget) => NoteAnchorRequest;
  /** 只清除指定请求，避免旧笔记卸载时清掉新请求 */
  consumeNoteAnchor: (requestId: number) => void;
}

const DEFAULT_NOTE_ANCHOR_NAVIGATION_STATE = {
  pending: null as NoteAnchorRequest | null,
  requestIdSeed: 0,
};

export const useNoteAnchorNavigationStore = create<NoteAnchorNavigationState>()((set, get) => ({
  ...DEFAULT_NOTE_ANCHOR_NAVIGATION_STATE,

  requestNoteAnchor: (target) => {
    const request = createNoteAnchorRequest(target, get().requestIdSeed + 1, Date.now());
    set({ pending: request, requestIdSeed: request.requestId });
    return request;
  },

  consumeNoteAnchor: (requestId) =>
    set((state) => (state.pending?.requestId === requestId ? { pending: null } : state)),
}));

const resetNoteAnchorNavigationStore = (): void => {
  useNoteAnchorNavigationStore.setState(DEFAULT_NOTE_ANCHOR_NAVIGATION_STATE);
};

registerStore({
  id: 'note-ui.anchor-navigation',
  scope: 'tab',
  reset: resetNoteAnchorNavigationStore,
});
