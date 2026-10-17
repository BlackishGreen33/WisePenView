import { useId, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { GuideToolId } from '@/constants/tour';

import { findGuideTarget } from '../findGuideTarget';
import styles from './style.module.less';

const SPOTLIGHT_PADDING = 10;

interface SpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SpotlightFrame {
  width: number;
  height: number;
  rects: SpotlightRect[];
}

interface GuideMultiSpotlightProps {
  toolIds: readonly GuideToolId[];
  radius: number;
  zIndex: number;
}

function readFrame(toolIds: readonly GuideToolId[]): SpotlightFrame {
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

/** 一步需要同时说明多个区域时，用同一层遮罩挖出多个高亮孔。 */
function GuideMultiSpotlight({ toolIds, radius, zIndex }: GuideMultiSpotlightProps) {
  const [frame, setFrame] = useState(() => readFrame(toolIds));
  const maskId = `guide-multi-spotlight-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

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

  if (frame.rects.length === 0) return null;

  return createPortal(
    <div className={styles.multiSpotlight} style={{ zIndex }} aria-hidden="true">
      <svg
        className={styles.multiSpotlightSvg}
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask
            id={maskId}
            x={0}
            y={0}
            width={frame.width}
            height={frame.height}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
          >
            <rect x={0} y={0} width={frame.width} height={frame.height} fill="white" />
            {frame.rects.map((rect, index) => (
              <rect
                key={index}
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx={radius}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          className={styles.multiSpotlightPath}
          x={0}
          y={0}
          width={frame.width}
          height={frame.height}
          mask={`url(#${maskId})`}
        />
      </svg>
    </div>,
    document.body
  );
}

export default GuideMultiSpotlight;
