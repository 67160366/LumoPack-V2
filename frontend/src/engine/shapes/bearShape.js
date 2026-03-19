/**
 * Bear face shape generator — bezier curves
 */
import { Vector2, Shape as ThreeShape } from 'three';

export function getOutlinePoints(scale) {
  const shape = new ThreeShape();
  shape.moveTo(0, -2.5);
  shape.bezierCurveTo(2.5, -2.5, 3.2, -0.5, 2.2, 1.0);
  shape.bezierCurveTo(3.8, 1.5, 3.2, 4.0, 1.4, 2.4);
  shape.bezierCurveTo(0.8, 3.2, -0.8, 3.2, -1.4, 2.4);
  shape.bezierCurveTo(-3.2, 4.0, -3.8, 1.5, -2.2, 1.0);
  shape.bezierCurveTo(-3.2, -0.5, -2.5, -2.5, 0, -2.5);

  const rawPoints = shape.getSpacedPoints(70);
  return rawPoints.map(p => new Vector2(p.x * scale, p.y * scale));
}

export const SHAPE_CONFIG = {
  name: 'bear',
  segments: 70,
  defaultScale: 1.2,
  lidScaleOffset: 0.03,
  lidHeight: 1.0,
  color: 0xd99a7a,
  supportColor: 0xd99a7a,
  wallOverlap: 0.05,
};
