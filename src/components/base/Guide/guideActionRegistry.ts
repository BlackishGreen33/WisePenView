import type { GuideActionId } from '@/constants/tour';

export interface GuideActionHandler {
  /** 读取当前界面状态，已打开时引导不会重复执行 open。 */
  isOpen?: () => boolean;
  /** 直接修改组件状态，不通过 DOM 模拟点击。 */
  open: () => void | Promise<void>;
  /** 仅关闭由引导打开的界面。 */
  close?: () => void;
}

const handlers = new Map<GuideActionId, GuideActionHandler[]>();

export function registerGuideActionHandler(
  id: GuideActionId,
  handler: GuideActionHandler
): () => void {
  const registered = handlers.get(id) ?? [];
  handlers.set(id, [...registered, handler]);
  return () => {
    const current = handlers.get(id);
    if (!current) return;
    const next = current.filter((item) => item !== handler);
    if (next.length === 0) handlers.delete(id);
    else handlers.set(id, next);
  };
}

export function getGuideActionHandler(id: GuideActionId): GuideActionHandler | undefined {
  const registered = handlers.get(id);
  return registered?.[registered.length - 1];
}
