import type { GuideToolId } from '@/constants/tour';

export interface GuideSpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GuideSpotlightFrame {
  width: number;
  height: number;
  rects: GuideSpotlightRect[];
}

export interface GuideSpotlightProps {
  toolIds: readonly GuideToolId[];
  radius: number;
  zIndex: number;
}
