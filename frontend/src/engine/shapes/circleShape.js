/**
 * Circle shape generator — segmented cylinder approach
 * Uses bidirectional hinge chain (left + right from center)
 */
export const SEGMENTS = 64;

export const SHAPE_CONFIG = {
  name: 'circle',
  segments: SEGMENTS,
  defaultRadius: 2.5,
  lidRadiusOffset: 0.04,
  lidHeight: 1.5,
  color: 0x8a6f58,
  supportColor: 0xe2e8f0,
};
