/**
 * 原文链接定位请求的纯逻辑：chat 侧派发、笔记侧消费，双方共用同一份判定规则。
 */
import type { NoteLinkTarget } from './noteLinkProtocol';

/** 定位请求过期时间：导航被未保存拦截或用户中途放弃时不残留定位意图 */
export const NOTE_ANCHOR_REQUEST_TTL_MS = 5_000;
/** 笔记侧定位重试间隔（正文可能仍在协同同步） */
export const NOTE_ANCHOR_RETRY_INTERVAL_MS = 120;
/** 笔记侧定位最长等待时间，超时后按失败提示 */
export const NOTE_ANCHOR_RETRY_TIMEOUT_MS = 3_000;
/** 命中块的高亮时长，需与样式中的动画时长保持一致 */
export const NOTE_ANCHOR_HIGHLIGHT_DURATION_MS = 1_200;
/** 命中块的临时高亮类名，由笔记滚动运行时挂载 */
export const NOTE_ANCHOR_HIGHLIGHT_CLASS = 'wise-note-anchor-highlight';

export interface NoteAnchorRequest extends NoteLinkTarget {
  requestId: number;
  expiresAt: number;
}

export function createNoteAnchorRequest(
  target: NoteLinkTarget,
  requestId: number,
  now: number
): NoteAnchorRequest {
  return {
    resourceId: target.resourceId,
    blockId: target.blockId,
    requestId,
    expiresAt: now + NOTE_ANCHOR_REQUEST_TTL_MS,
  };
}

export function isNoteAnchorRequestExpired(request: NoteAnchorRequest, now: number): boolean {
  return now >= request.expiresAt;
}
