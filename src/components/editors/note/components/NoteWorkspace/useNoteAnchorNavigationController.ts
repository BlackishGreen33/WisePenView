import { toast } from '@heroui/react';
import { type RefObject, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useNoteAnchorNavigationStore } from '@/components/editors/note/_store/useNoteAnchorNavigationStore';
import type { NoteBodyEditorHandle } from '@/components/editors/note/CustomBlockNote/index.type';
import {
  isNoteAnchorRequestExpired,
  NOTE_ANCHOR_RETRY_INTERVAL_MS,
  NOTE_ANCHOR_RETRY_TIMEOUT_MS,
} from '@/components/editors/note/noteAnchorNavigationModel';

interface UseNoteAnchorNavigationOptions {
  resourceId: string;
  bodyEditorRef: RefObject<NoteBodyEditorHandle | null>;
}

/**
 * 消费 chat 派发的原文定位请求。
 *
 * 正文可能仍在协同同步或等待用户信息，因此在命中目标块之前按固定间隔重试；
 * 只有属于当前笔记、未过期的请求才会被消费，超时后提示定位失败。
 */
export function useNoteAnchorNavigationController({
  resourceId,
  bodyEditorRef,
}: UseNoteAnchorNavigationOptions) {
  const { t } = useTranslation('note');
  const pending = useNoteAnchorNavigationStore((state) => state.pending);

  /**
   * @wisepen-manual-effect
   * 执行时机：收到属于当前笔记的定位请求后。
   * 不可替代原因：目标块是否存在取决于命令式编辑器文档与协同同步进度，只能在 React 之外轮询确认。
   * cleanup：取消尚未执行的重试计时；请求本身只在命中或超时时被消费。
   */
  useEffect(() => {
    if (!pending || pending.resourceId !== resourceId) return;

    const consumeNoteAnchor = useNoteAnchorNavigationStore.getState().consumeNoteAnchor;
    const requestId = pending.requestId;
    if (isNoteAnchorRequestExpired(pending, Date.now())) {
      consumeNoteAnchor(requestId);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    const startedAt = Date.now();

    const attempt = () => {
      if (cancelled) return;
      const store = useNoteAnchorNavigationStore.getState();
      const request = store.pending;
      // 已被新请求覆盖或已被消费时直接结束
      if (!request || request.requestId !== requestId) return;

      const matched = bodyEditorRef.current?.scrollToAnchor(
        { kind: 'block', blockId: request.blockId },
        { highlight: true }
      );
      if (matched) {
        store.consumeNoteAnchor(requestId);
        return;
      }

      const now = Date.now();
      if (
        now - startedAt >= NOTE_ANCHOR_RETRY_TIMEOUT_MS ||
        isNoteAnchorRequestExpired(request, now)
      ) {
        store.consumeNoteAnchor(requestId);
        toast.warning(t('workspace.anchorNotFound'));
        return;
      }
      timer = window.setTimeout(attempt, NOTE_ANCHOR_RETRY_INTERVAL_MS);
    };

    attempt();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [bodyEditorRef, pending, resourceId, t]);
}
