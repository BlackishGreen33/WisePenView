import type { GuideToolId } from '@/constants/tour';

export interface GuideSpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 已包含孔洞 padding 的外圈圆角。 */
  radius: number;
}

export interface GuideSpotlightFrame {
  width: number;
  height: number;
  rects: GuideSpotlightRect[];
}

export interface GuideSpotlightProps {
  toolIds: readonly GuideToolId[];
  zIndex: number;
}
