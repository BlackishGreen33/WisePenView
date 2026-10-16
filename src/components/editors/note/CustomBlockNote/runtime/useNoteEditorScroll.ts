import { useMemoizedFn, useUnmount } from 'ahooks';
import { useRef } from 'react';

import { findInlineCommentAnchorElement } from '../engines/inlineComments/extension';
import type { NoteEditorAnchor } from '../index.type';
import type { CustomBlockNoteEditor } from '../registry/noteEditorComposition';
import {
  type NoteScrollTargetResolver,
  scrollNoteEditorTargetIntoView,
} from './noteEditorScrollTarget';
export type { NoteScrollTargetResolver } from './noteEditorScrollTarget';

function resolveCurrentBlockElement(editor: CustomBlockNoteEditor): HTMLElement | null {
  const view = editor.prosemirrorView;
  const domNode = view.domAtPos(view.state.selection.from).node;
  const element = domNode instanceof Element ? domNode : domNode.parentElement;
  return element?.closest<HTMLElement>('.bn-block-outer') ?? null;
}

export function useNoteEditorScroll(editor: CustomBlockNoteEditor) {
  const queuedFrameRef = useRef<number | null>(null);

  useUnmount(() => {
    if (queuedFrameRef.current !== null) window.cancelAnimationFrame(queuedFrameRef.current);
  });

  const scrollToTarget = useMemoizedFn((resolveTarget: NoteScrollTargetResolver) => {
    if (queuedFrameRef.current !== null) window.cancelAnimationFrame(queuedFrameRef.current);

    queuedFrameRef.current = window.requestAnimationFrame(() => {
      queuedFrameRef.current = null;
      const target = resolveTarget();
      if (!target?.isConnected) return;
      scrollNoteEditorTargetIntoView(target);
    });
  });

  /** 返回是否在文档中命中目标块，调用方据此决定重试或失败提示。 */
  const scrollToAnchor = useMemoizedFn((anchor: NoteEditorAnchor): boolean => {
    if (anchor.kind === 'block') {
      if (!editor.getBlock(anchor.blockId)) return false;
      try {
        editor.setTextCursorPosition(anchor.blockId, 'start');
        editor.focus();
      } catch {
        return false;
      }
      const blockElement = resolveCurrentBlockElement(editor);
      if (!blockElement) return false;
      scrollToTarget(() => blockElement);
      return true;
    }

    scrollToTarget(() =>
      findInlineCommentAnchorElement(editor.prosemirrorView.dom, anchor.threadId)
    );
    return true;
  });

  return { scrollToAnchor, scrollToTarget };
}
