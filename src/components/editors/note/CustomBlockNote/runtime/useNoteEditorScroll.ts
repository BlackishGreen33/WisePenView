import { useMemoizedFn, useUnmount } from 'ahooks';
import { useRef } from 'react';

import {
  NOTE_ANCHOR_HIGHLIGHT_CLASS,
  NOTE_ANCHOR_HIGHLIGHT_DURATION_MS,
} from '@/components/editors/note/noteAnchorNavigationModel';

import { findInlineCommentAnchorElement } from '../engines/inlineComments/extension';
import type { NoteEditorAnchor, NoteScrollAnchorOptions } from '../index.type';
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
  const highlightTimerRef = useRef<number | null>(null);
  const highlightedElementRef = useRef<HTMLElement | null>(null);

  const clearHighlight = useMemoizedFn(() => {
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    highlightedElementRef.current?.classList.remove(NOTE_ANCHOR_HIGHLIGHT_CLASS);
    highlightedElementRef.current = null;
  });

  /** 目标块高亮：类名由样式模块声明，重复定位时重置计时。 */
  const highlightBlockElement = useMemoizedFn((element: HTMLElement) => {
    clearHighlight();
    element.classList.add(NOTE_ANCHOR_HIGHLIGHT_CLASS);
    highlightedElementRef.current = element;
    highlightTimerRef.current = window.setTimeout(() => {
      highlightTimerRef.current = null;
      highlightedElementRef.current?.classList.remove(NOTE_ANCHOR_HIGHLIGHT_CLASS);
      highlightedElementRef.current = null;
    }, NOTE_ANCHOR_HIGHLIGHT_DURATION_MS);
  });

  useUnmount(() => {
    if (queuedFrameRef.current !== null) window.cancelAnimationFrame(queuedFrameRef.current);
    clearHighlight();
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
  const scrollToAnchor = useMemoizedFn(
    (anchor: NoteEditorAnchor, options?: NoteScrollAnchorOptions): boolean => {
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
        if (options?.highlight) highlightBlockElement(blockElement);
        scrollToTarget(() => blockElement);
        return true;
      }

      scrollToTarget(() =>
        findInlineCommentAnchorElement(editor.prosemirrorView.dom, anchor.threadId)
      );
      return true;
    }
  );

  return { scrollToAnchor, scrollToTarget };
}
