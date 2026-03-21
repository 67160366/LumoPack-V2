/**
 * supportHoles.js — Shared utility for building support plate holes
 * based on user's supportConfig.holes array.
 *
 * Each hole: { type: 'circle'|'rect'|'capsule'|'heart', x, y, r?, w?, l? }
 * UI values are in cm; 3D scene uses cm/10 — caller passes plateW/plateD
 * in scene units, and we scale hole coords to match.
 *
 * Returns an array of THREE.Path objects to use as shape.holes
 */
import * as THREE from 'three';

/**
 * Generate a heart outline as an array of [x,y] points centered at (cx,cy).
 * Uses the same tilted-ellipse algorithm as HeartFoldBox.
 * @param {number} cx - center x (scene units)
 * @param {number} cy - center y (scene units)
 * @param {number} size - heart height (scene units)
 * @param {number} n - point count per half
 */
function heartHolePath(cx, cy, size, n = 40) {
  const shapePct = 55, tiltDeg = 45;
  const tilt = (tiltDeg * Math.PI) / 180;
  const b = shapePct / 100;
  const t0 = Math.atan2(Math.cos(tilt), b * Math.sin(tilt));

  let right = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (i / n) * Math.PI;
    const x = Math.cos(t) * Math.cos(tilt) - b * Math.sin(t) * Math.sin(tilt);
    const y = Math.cos(t) * Math.sin(tilt) + b * Math.sin(t) * Math.cos(tilt);
    right.push([x, y]);
  }
  if (right[Math.floor(n / 2)][0] < 0) {
    right = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + Math.PI + (i / n) * Math.PI;
      const x = Math.cos(t) * Math.cos(tilt) - b * Math.sin(t) * Math.sin(tilt);
      const y = Math.cos(t) * Math.sin(tilt) + b * Math.sin(t) * Math.cos(tilt);
      right.push([x, y]);
    }
  }

  // Scale so total height = size, centered at (cx, cy)
  const topY = right[0][1];
  const botY = right[right.length - 1][1];
  const rawH = Math.abs(topY - botY);
  const sc = size / rawH;
  const midY = (topY + botY) / 2;

  const left = right.map(([x, y]) => [-x, y]).reverse();
  const pts = [...right, ...left.slice(1)].map(([x, y]) => [
    cx + x * sc,
    cy + (y - midY) * sc,
  ]);

  const path = new THREE.Path();
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
  return path;
}

/**
 * Build hole paths for a support plate.
 *
 * @param {number} plateW - plate width  (scene units)
 * @param {number} plateD - plate depth  (scene units)
 * @param {object} config - { holes: [{type,x,y,r?,w?,l?}], wallHeight }
 * @returns {THREE.Path[]} array of hole paths
 */
export function buildSupportHoles(plateW, plateD, config) {
  const holes = config?.holes || [];
  if (holes.length === 0) return [];

  // UI coords are in cm, scene is cm/10 — scale factor
  const s = 0.1;
  const margin = 0.05; // minimum distance from plate edge

  return holes.map(hole => {
    const path = new THREE.Path();
    const hx = hole.x * s;
    const hy = hole.y * s;

    if (hole.type === 'circle') {
      const r = Math.min(Math.min((hole.w || 3), (hole.l || 4)) * s / 2, Math.min(plateW, plateD) / 2 - margin);
      if (r <= 0) return null;
      path.absarc(hx, hy, r, 0, Math.PI * 2, false);
    } else if (hole.type === 'rect' || hole.type === 'rectangle') {
      const hw = Math.min(((hole.w || 3) * s) / 2, plateW / 2 - margin);
      const hl = Math.min(((hole.l || 4) * s) / 2, plateD / 2 - margin);
      if (hw <= 0 || hl <= 0) return null;
      path.moveTo(hx - hw, hy - hl);
      path.lineTo(hx + hw, hy - hl);
      path.lineTo(hx + hw, hy + hl);
      path.lineTo(hx - hw, hy + hl);
      path.lineTo(hx - hw, hy - hl);
    } else if (hole.type === 'heart') {
      const hw = (hole.w || 3) * s;
      const hl = (hole.l || 4) * s;
      const size = Math.min(hl, plateD - margin * 2);
      if (size <= 0) return null;
      // Generate heart path scaled by w/l ratio for width
      const heartP = heartHolePath(0, 0, size);
      const pts = heartP.getPoints(40);
      // Scale X by hw/hl ratio to control width independently
      const scaleX = hw / hl;
      const scaled = new THREE.Path();
      scaled.moveTo(hx + pts[0].x * scaleX, hy + pts[0].y);
      for (let k = 1; k < pts.length; k++) scaled.lineTo(hx + pts[k].x * scaleX, hy + pts[k].y);
      scaled.closePath();
      return scaled;
    } else {
      // capsule = ellipse (matches SVG <ellipse> preview)
      const hw = Math.min(((hole.w || 3) * s) / 2, plateW / 2 - margin);
      const hl = Math.min(((hole.l || 4) * s) / 2, plateD / 2 - margin);
      if (hw <= 0 || hl <= 0) return null;
      path.absellipse(hx, hy, hw, hl, 0, Math.PI * 2, false, 0);
    }

    return path;
  }).filter(Boolean);
}

/**
 * Build hole paths for a circular support plate.
 *
 * @param {number} plateRadius - plate radius (scene units)
 * @param {object} config - same as buildSupportHoles
 * @returns {THREE.Path[]} array of hole paths
 */
export function buildCircleSupportHoles(plateRadius, config) {
  return buildSupportHoles(plateRadius * 2, plateRadius * 2, config);
}
