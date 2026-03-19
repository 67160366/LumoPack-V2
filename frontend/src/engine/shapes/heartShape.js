/**
 * Heart shape generator — parametric curve
 * x = 16sin^3(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
 */
import { Vector2 } from 'three';

const SEGMENTS = 80;

export function getHeartPoint(t, scale) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return new Vector2(x * scale, y * scale);
}

export function getOutlinePoints(scale) {
  const points = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (i / SEGMENTS) * Math.PI * 2;
    points.push(getHeartPoint(t, scale));
  }
  return points;
}

export const SHAPE_CONFIG = {
  name: 'heart',
  segments: SEGMENTS,
  defaultScale: 0.25,
  lidScaleOffset: 0.005,
  lidHeight: 1.0,
  color: 0x881337,
  supportColor: 0xffb5c0,
  wallOverlap: 0.01,
};
