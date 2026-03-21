/**
 * heartDieline.js — Parametric 2D dieline generator for heart-shaped boxes.
 *
 * Generates cut and crease polylines for:
 *   Base: heart cap + wall strip with glue teeth
 *   Lid:  heart cap (3% larger) + wall strip with glue teeth
 *
 * Layout (top to bottom):
 *   Row 1: Base cap (left) + Lid cap (right)
 *   Row 2: Base wall strip (with glue teeth along bottom)
 *   Row 3: Lid wall strip (with glue teeth along bottom)
 *
 * All dimensions in mm.
 */

import { generateHeart, outlineBounds } from '../components/Box3D/HeartFoldBox';

/**
 * Compute the perimeter of a closed polygon.
 * @param {number[][]} pts - array of [x,y]
 */
function perimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const dx = pts[j][0] - pts[i][0];
    const dy = pts[j][1] - pts[i][1];
    p += Math.sqrt(dx * dx + dy * dy);
  }
  return p;
}

/**
 * Generate triangular glue teeth along the bottom edge of a wall strip.
 * Returns a polyline going left-to-right with teeth pointing downward.
 */
function glueTeeth(x0, y0, width, teethH, count) {
  const step = width / count;
  const pts = [[x0, y0]];
  for (let i = 0; i < count; i++) {
    const x = x0 + i * step;
    pts.push([x + step * 0.5, y0 - teethH]);
    pts.push([x + step, y0]);
  }
  return pts;
}

/**
 * Close a polygon by appending the first point.
 */
function close(pts) {
  return [...pts, pts[0]];
}

/**
 * Generate the full heart box dieline.
 *
 * @param {number} length   - heart length in mm
 * @param {number} height   - box height in mm
 * @param {number} shapePct - heart shape percentage (35-75)
 * @param {number} tiltDeg  - heart tilt degrees (25-65)
 * @returns {{ cut: number[][][], crease: number[][][] }}
 */
export function generateHeartDieline(length, height, shapePct, tiltDeg) {
  const cardboard = 1.5;
  const clearance = 1.03;
  const lidH = height * 0.35;
  const baseH = height * 0.7;
  const gap = 8; // mm gap between parts
  const teethH = 5; // glue teeth height

  // Generate heart outlines
  const baseOutline = generateHeart(length, shapePct, tiltDeg);
  const lidOutline = generateHeart(length * clearance, shapePct, tiltDeg);

  const baseBounds = outlineBounds(baseOutline);
  const lidBounds = outlineBounds(lidOutline);

  const basePeri = perimeter(baseOutline);
  const lidPeri = perimeter(lidOutline);

  const cut = [];
  const crease = [];

  // ── Row 1: Heart caps side by side ──
  // Center base heart at its own center
  const baseOffX = -baseBounds.cx;
  const baseOffY = -baseBounds.cy;
  const baseCap = close(baseOutline.map(([x, y]) => [x + baseOffX, y + baseOffY]));
  cut.push(baseCap);

  // Lid heart to the right
  const lidOffX = baseBounds.w / 2 + gap + lidBounds.w / 2 - lidBounds.cx;
  const lidOffY = -lidBounds.cy;
  const lidCap = close(lidOutline.map(([x, y]) => [x + lidOffX, y + lidOffY]));
  cut.push(lidCap);

  // ── Row 2: Base wall strip ──
  const stripStartY = -baseBounds.h / 2 - gap;
  const bsw = basePeri;
  const bsh = baseH;
  const bsx = -bsw / 2;
  const bsy = stripStartY - bsh;

  // Strip outer rectangle (top, right, bottom-baseline, left)
  // Top edge
  cut.push([[bsx, bsy + bsh], [bsx + bsw, bsy + bsh]]);
  // Right edge
  cut.push([[bsx + bsw, bsy + bsh], [bsx + bsw, bsy]]);
  // Left edge
  cut.push([[bsx, bsy], [bsx, bsy + bsh]]);
  // Bottom edge = glue teeth
  const teethCount = Math.max(8, Math.round(bsw / 8));
  cut.push(glueTeeth(bsx, bsy, bsw, teethH, teethCount));

  // Crease line (fold line near top of strip — where it bends onto cap)
  crease.push([[bsx, bsy + bsh - cardboard], [bsx + bsw, bsy + bsh - cardboard]]);

  // ── Row 3: Lid wall strip ──
  const lidStripY = bsy - teethH - gap;
  const lsw = lidPeri;
  const lsh = lidH;
  const lsx = -lsw / 2;
  const lsy = lidStripY - lsh;

  // Top edge
  cut.push([[lsx, lsy + lsh], [lsx + lsw, lsy + lsh]]);
  // Right edge
  cut.push([[lsx + lsw, lsy + lsh], [lsx + lsw, lsy]]);
  // Left edge
  cut.push([[lsx, lsy], [lsx, lsy + lsh]]);
  // Bottom edge = glue teeth
  const lidTeethCount = Math.max(8, Math.round(lsw / 8));
  cut.push(glueTeeth(lsx, lsy, lsw, teethH, lidTeethCount));

  // Crease line
  crease.push([[lsx, lsy + lsh - cardboard], [lsx + lsw, lsy + lsh - cardboard]]);

  return { cut, crease };
}
