import { useLayoutEffect, useState } from 'react';

import type { GuideToolId } from '@/constants/tour';

import { findGuideTarget } from '../findGuideTarget';
import type { GuideSpotlightFrame } from './index.type';

const SPOTLIGHT_PADDING = 10;

function readFrame(toolIds: readonly GuideToolId[]): GuideSpotlightFrame {
  const rects = toolIds.flatMap((id) => {
    const element = findGuideTarget(id);
    if (!element) return [];
    const rect = element.getBoundingClientRect();
    return [
      {
        left: rect.left - SPOTLIGHT_PADDING,
        top: rect.top - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      },
    ];
  });
  return { width: window.innerWidth, height: window.innerHeight, rects };
}

/** 跟踪多个高亮目标在视口中的位置，供聚光遮罩绘制高亮孔。 */
export function useGuideSpotlightFrame(toolIds: readonly GuideToolId[]): GuideSpotlightFrame {
  const [frame, setFrame] = useState(() => readFrame(toolIds));

  useLayoutEffect(() => {
    const update = () => setFrame(readFrame(toolIds));
    update();

    // 弹出层用 transform 做缩放动画，ResizeObserver 不会收到 transform 变化，需在动画期间补测位置。
    const settleTimers = [50, 100, 160, 240, 360, 520].map((delay) =>
      window.setTimeout(update, delay)
    );
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => update());
    for (const id of toolIds) {
      const element = findGuideTarget(id);
      if (element) observer?.observe(element);
    }
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      for (const timer of settleTimers) window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [toolIds]);

  return frame;
}
