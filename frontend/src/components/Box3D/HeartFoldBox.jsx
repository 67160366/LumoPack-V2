/**
 * HeartFoldBox — Parametric 3D heart box
 *
 * Heart shape: ellipse → rotate by tilt → cut at x=0 → mirror
 * (Same algorithm as templatemaker.nl)
 *
 * Structure:
 *   Base: outer cap (bottom) + walls + inner cap
 *   Lid:  outer cap (top) + walls + inner cap (3% larger)
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { getCardboardNoiseTexture } from './useCardboardNoise';

const SC = 0.01; // mm → three.js units

const _noiseBase = getCardboardNoiseTexture('#c4a882');
const _noiseWall = getCardboardNoiseTexture('#b89970');
const _noiseLidCap = getCardboardNoiseTexture('#d4b892');
const _noiseLidWall = getCardboardNoiseTexture('#c9a57a');

/* ══════════════════════════════════
 * Parametric heart outline generator
 * ══════════════════════════════════ */
function generateHeart(length, shapePct, tiltDeg, n = 80) {
  const tilt = (tiltDeg * Math.PI) / 180;
  const b = shapePct / 100; // ellipse semi-minor (semi-major = 1)

  // Find t where x(t)=0 after rotation:
  // cos(t)*cos(tilt) - b*sin(t)*sin(tilt) = 0
  const t0 = Math.atan2(Math.cos(tilt), b * Math.sin(tilt));

  // Trace right half (x≥0 side)
  let right = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (i / n) * Math.PI;
    const x = Math.cos(t) * Math.cos(tilt) - b * Math.sin(t) * Math.sin(tilt);
    const y = Math.cos(t) * Math.sin(tilt) + b * Math.sin(t) * Math.cos(tilt);
    right.push([x, y]);
  }

  // If we got the wrong half, flip
  if (right[Math.floor(n / 2)][0] < 0) {
    right = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + Math.PI + (i / n) * Math.PI;
      const x = Math.cos(t) * Math.cos(tilt) - b * Math.sin(t) * Math.sin(tilt);
      const y = Math.cos(t) * Math.sin(tilt) + b * Math.sin(t) * Math.cos(tilt);
      right.push([x, y]);
    }
  }

  // Scale so distance between top & bottom tips = length
  const topY = right[0][1];
  const botY = right[right.length - 1][1];
  const scale = length / Math.abs(topY - botY);

  // Mirror → full outline
  const left = right.map(([x, y]) => [-x, y]).reverse();
  return [...right, ...left.slice(1)].map(([x, y]) => [x * scale, y * scale]);
}

/* ── THREE.Shape from outline ── */
function outlineToShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0] * SC, pts[0][1] * SC);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0] * SC, pts[i][1] * SC);
  s.closePath();
  return s;
}

/* ── Wall geometry from outline ── */
function buildWalls(pts, wallH) {
  const positions = [];
  const normals = [];
  const h = wallH * SC;

  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const [x1, y1] = [pts[i][0] * SC, pts[i][1] * SC];
    const [x2, y2] = [pts[j][0] * SC, pts[j][1] * SC];

    // Normal (outward, in XY plane)
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dy / len, ny = -dx / len;

    // Two triangles for each wall quad
    // Bottom-left triangle
    positions.push(x1, y1, 0, x2, y2, 0, x2, y2, h);
    normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0);
    // Top-right triangle
    positions.push(x1, y1, 0, x2, y2, h, x1, y1, h);
    normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

/* ── Cap (flat heart panel) geometry ── */
function buildCap(pts, thickness) {
  const shape = outlineToShape(pts);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness * SC,
    bevelEnabled: false,
  });
  return geo;
}

/* ══════════════════════════════════
 * Main component
 * ══════════════════════════════════ */
export default function HeartFoldBox({
  length = 100,
  height = 40,
  shapePct = 55,
  tiltDeg = 45,
  lidOpen = 0, // 0-1
}) {
  const cardboard = 1.5; // mm thickness
  const clearance = 1.03; // lid is 3% larger
  const lidH = height * 0.35; // lid wall height
  const baseH = height * 0.7; // base wall height (overlap)

  // Generate outlines
  const baseOutline = useMemo(
    () => generateHeart(length, shapePct, tiltDeg),
    [length, shapePct, tiltDeg]
  );
  const lidOutline = useMemo(
    () => generateHeart(length * clearance, shapePct, tiltDeg),
    [length, shapePct, tiltDeg]
  );

  // Build geometries
  const geos = useMemo(() => {
    const baseCap = buildCap(baseOutline, cardboard);
    const baseWall = buildWalls(baseOutline, baseH);
    const lidCap = buildCap(lidOutline, cardboard);
    const lidWall = buildWalls(lidOutline, lidH);
    return { baseCap, baseWall, lidCap, lidWall };
  }, [baseOutline, lidOutline, baseH, lidH]);

  // Lid hinge: back of heart (lowest Y point)
  const hingeY = useMemo(() => {
    let minY = Infinity;
    for (const [, y] of lidOutline) if (y < minY) minY = y;
    return minY * SC;
  }, [lidOutline]);

  const lidAngle = lidOpen * Math.PI * 0.6; // max ~108° open

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* ── Base ── */}
      <group>
        {/* Bottom cap */}
        <mesh geometry={geos.baseCap}>
          <meshStandardMaterial color="#ffffff" map={_noiseBase} side={THREE.DoubleSide} roughness={0.85} />
        </mesh>
        {/* Walls */}
        <mesh geometry={geos.baseWall}>
          <meshStandardMaterial color="#ffffff" map={_noiseWall} side={THREE.DoubleSide} roughness={0.85} />
        </mesh>
      </group>

      {/* ── Lid — pivots at back (min Y) ── */}
      <group
        position={[0, hingeY, baseH * SC]}
        rotation={[lidAngle, 0, 0]}
      >
        <group position={[0, -hingeY, 0]}>
          {/* Top cap (at top of lid walls) */}
          <group position={[0, 0, lidH * SC]}>
            <mesh geometry={geos.lidCap}>
              <meshStandardMaterial color="#ffffff" map={_noiseLidCap} side={THREE.DoubleSide} roughness={0.85} />
            </mesh>
          </group>
          {/* Lid walls (hanging down) */}
          <mesh geometry={geos.lidWall}>
            <meshStandardMaterial color="#ffffff" map={_noiseLidWall} side={THREE.DoubleSide} roughness={0.85} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
