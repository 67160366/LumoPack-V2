/**
 * Star shape generator — 5-pointed star
 */
import { Vector2 } from 'three';

const NUM_POINTS = 5;

export function getOutlinePoints(scale) {
  const points = [];
  const outerRadius = 12 * scale;
  const innerRadius = 5.5 * scale;
  let angle = Math.PI / 2;
  const step = Math.PI / NUM_POINTS;

  for (let i = 0; i <= NUM_POINTS * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    points.push(new Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    angle -= step;
  }
  return points;
}

export const SHAPE_CONFIG = {
  name: 'star',
  segments: NUM_POINTS * 2,
  defaultScale: 0.6,
  lidScaleOffset: 0.02,
  lidHeight: 1.0,
  color: 0xd97706,
  supportColor: 0xffffff,
  wallOverlap: 0.05,
};
