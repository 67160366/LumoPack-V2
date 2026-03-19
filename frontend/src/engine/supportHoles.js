/**
 * supportHoles.js — Shared utility for building support plate holes
 * based on user's supportConfig.holes array.
 *
 * Each hole: { type: 'circle'|'rect'|'capsule', x, y, r?, w?, l? }
 * UI values are in cm; 3D scene uses cm/10 — caller passes plateW/plateD
 * in scene units, and we scale hole coords to match.
 *
 * Returns an array of THREE.Path objects to use as shape.holes
 */
import * as THREE from 'three';

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
      const r = Math.min((hole.r || 2) * s, Math.min(plateW, plateD) / 2 - margin);
      if (r <= 0) return null;
      path.absarc(hx, hy, r, 0, Math.PI * 2, false);
    } else if (hole.type === 'rect' || hole.type === 'rectangle') {
      const hw = Math.min(((hole.w || 3) * s) / 2, plateW / 2 - margin);
      const hl = Math.min(((hole.l || 5) * s) / 2, plateD / 2 - margin);
      if (hw <= 0 || hl <= 0) return null;
      path.moveTo(hx - hw, hy - hl);
      path.lineTo(hx + hw, hy - hl);
      path.lineTo(hx + hw, hy + hl);
      path.lineTo(hx - hw, hy + hl);
      path.lineTo(hx - hw, hy - hl);
    } else {
      // capsule
      const w = Math.min((hole.w || 3) * s, plateW - margin * 2);
      const l = Math.min((hole.l || 5) * s, plateD - margin * 2);
      const r = w / 2;
      const innerL = Math.max(0, l - w);
      if (r <= 0) return null;
      path.moveTo(hx - r, hy - innerL / 2);
      path.lineTo(hx - r, hy + innerL / 2);
      path.absarc(hx, hy + innerL / 2, r, Math.PI, 0, true);
      path.lineTo(hx + r, hy - innerL / 2);
      path.absarc(hx, hy - innerL / 2, r, 0, Math.PI, true);
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
