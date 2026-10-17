import { useId } from 'react';
import { createPortal } from 'react-dom';

import type { GuideSpotlightProps } from './index.type';
import styles from './style.module.less';
import { useGuideSpotlightFrame } from './useGuideSpotlightFrame';

/** 一步需要同时说明多个区域时，用同一层遮罩挖出多个高亮孔。 */
function GuideSpotlight({ toolIds, radius, zIndex }: GuideSpotlightProps) {
  const frame = useGuideSpotlightFrame(toolIds);
  const maskId = `guide-spotlight-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (frame.rects.length === 0) return null;

  return createPortal(
    <div className={styles.spotlight} style={{ zIndex }} aria-hidden="true">
      <svg
        className={styles.spotlightSvg}
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
          className={styles.spotlightPath}
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

export default GuideSpotlight;
