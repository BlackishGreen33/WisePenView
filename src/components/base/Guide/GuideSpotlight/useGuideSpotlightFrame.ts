import { useLayoutEffect, useState } from 'react';

import type { GuideToolId } from '@/constants/tour';

import { findGuideTarget } from '../findGuideTarget';
import type { GuideSpotlightFrame } from './index.type';

const SPOTLIGHT_PADDING = 12;

/** 百分比圆角以对应方向的尺寸为基准，其余单位按 CSS 长度解析。 */
function parseRadius(value: string, reference: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return value.trim().endsWith('%') ? (parsed / 100) * reference : parsed;
}

/** 读取元素自身四角的圆角，水平与垂直方向都满足时才形成有效内圆角。 */
function readElementRadius(element: HTMLElement, rect: DOMRect): number {
  const style = getComputedStyle(element);
  const horizontalRadii = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomLeftRadius,
    style.borderBottomRightRadius,
  ].map((value) => parseRadius(value, rect.width));
  const verticalRadii = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomLeftRadius,
    style.borderBottomRightRadius,
  ].map((value) => parseRadius(value, rect.height));
  return Math.min(
    Math.max(...horizontalRadii),
    Math.max(...verticalRadii),
    rect.width / 2,
    rect.height / 2
  );
}

/** 锚点壳通常不画圆角，取同尺寸直接子元素上实际可见的圆角。 */
function readSpotlightRadius(element: HTMLElement, rect: DOMRect): number {
  let radius = readElementRadius(element, rect);
  for (const child of element.children) {
    if (!(child instanceof HTMLElement)) continue;
    const childRect = child.getBoundingClientRect();
    const sameBox =
      Math.abs(childRect.left - rect.left) <= 1 &&
      Math.abs(childRect.top - rect.top) <= 1 &&
      Math.abs(childRect.width - rect.width) <= 1 &&
      Math.abs(childRect.height - rect.height) <= 1;
    if (sameBox) radius = Math.max(radius, readElementRadius(child, childRect));
  }
  return radius;
}

function readFrame(toolIds: readonly GuideToolId[]): GuideSpotlightFrame {
  const rects = toolIds.flatMap((id) => {
    const element = findGuideTarget(id);
    if (!element) return [];
    const rect = element.getBoundingClientRect();
    const width = rect.width + SPOTLIGHT_PADDING * 2;
    const height = rect.height + SPOTLIGHT_PADDING * 2;
    return [
      {
        left: rect.left - SPOTLIGHT_PADDING,
        top: rect.top - SPOTLIGHT_PADDING,
        width,
        height,
        radius: Math.min(
          readSpotlightRadius(element, rect) + SPOTLIGHT_PADDING,
          width / 2,
          height / 2
        ),
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
