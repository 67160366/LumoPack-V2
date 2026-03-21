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
import { buildSupportHoles } from '../../engine/supportHoles';
import { getCardboardNoiseTexture } from './useCardboardNoise';
import { getScheme } from './cardboardColors';

const SC = 0.01; // mm → three.js units
const HP = Math.PI / 2;

/* ══════════════════════════════════
 * Parametric heart outline generator
 * ══════════════════════════════════ */
function generateHeart(length, shapePct, tiltDeg, n = 80) {
  const tilt = (tiltDeg * Math.PI) / 180;
  const b = shapePct / 100; // ellipse semi-minor (semi-major = 1)

  // Find t where x(t)=0 after rotation:
  const t0 = Math.atan2(Math.cos(tilt), b * Math.sin(tilt));

  // Trace right half (x≥0 side)
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

  const topY = right[0][1];
  const botY = right[right.length - 1][1];
  const scale = length / Math.abs(topY - botY);

  const left = right.map(([x, y]) => [-x, y]).reverse();
  return [...right, ...left.slice(1)].map(([x, y]) => [x * scale, y * scale]);
}

function outlineBounds(pts) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX,
    h: maxY - minY,
  };
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

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;

    positions.push(x1, y1, 0, x2, y2, 0, x2, y2, h);
    normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0);
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

const SUPP_COLOR = '#a0d2db';
const SUPP_EDGE = '#5a9aa8';

function SupportMesh({ shape }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(shape, 24), [shape]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  return (
    <mesh rotation={[-HP, 0, 0]} castShadow receiveShadow>
      <primitive object={geo} attach="geometry" />
      <meshStandardMaterial color={SUPP_COLOR} side={THREE.DoubleSide} roughness={0.85} transparent opacity={0.9} />
      <lineSegments>
        <primitive object={edges} attach="geometry" />
        <lineBasicMaterial color={SUPP_EDGE} transparent opacity={0.6} />
      </lineSegments>
    </mesh>
  );
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
  boxStyle = 'kraft',
  showSupport = false,
  supportConfig,
}) {
  const cardboard = 1.5; // mm thickness
  const clearance = 1.03; // lid is 3% larger
  const lidH = height * 0.35; // lid wall height
  const baseH = height * 0.7; // base wall height (overlap)

  const scheme = useMemo(() => getScheme(boxStyle), [boxStyle]);

  const textures = useMemo(
    () => ({
      noiseBase: getCardboardNoiseTexture(scheme.base),
      noiseWall: getCardboardNoiseTexture(scheme.wall),
      noiseLidCap: getCardboardNoiseTexture(scheme.lidCap),
      noiseLidWall: getCardboardNoiseTexture(scheme.lidWall),
    }),
    [scheme]
  );

  // Generate outlines
  const baseOutline = useMemo(
    () => generateHeart(length, shapePct, tiltDeg),
    [length, shapePct, tiltDeg]
  );
  const lidOutline = useMemo(
    () => generateHeart(length * clearance, shapePct, tiltDeg),
    [length, shapePct, tiltDeg]
  );

  const bounds = useMemo(() => outlineBounds(baseOutline), [baseOutline]);

  // Build geometries
  const geos = useMemo(() => {
    const baseCap = buildCap(baseOutline, cardboard);
    const baseWall = buildWalls(baseOutline, baseH);
    const lidCap = buildCap(lidOutline, cardboard);
    const lidWall = buildWalls(lidOutline, lidH);
    return { baseCap, baseWall, lidCap, lidWall };
  }, [baseOutline, lidOutline, baseH, lidH]);

  // Support insert (rectangular tray inside heart footprint — same pattern as SelfLock)
  const suppShapes = useMemo(() => {
    if (!showSupport) return null;
    const sw = Math.max(0.02, bounds.w * SC * 0.88);
    const sd = Math.max(0.02, bounds.h * SC * 0.88);
    const innerZ = baseH * SC - cardboard * SC * 1.5;
    const sh = Math.max(0.015, innerZ * (supportConfig?.wallHeight ?? 0.78));

    const top = new THREE.Shape();
    top.moveTo(-sw / 2, -sd / 2);
    top.lineTo(sw / 2, -sd / 2);
    top.lineTo(sw / 2, sd / 2);
    top.lineTo(-sw / 2, sd / 2);
    const holes = buildSupportHoles(sw, sd, supportConfig);
    holes.forEach((h) => top.holes.push(h));

    const wallFront = new THREE.Shape();
    wallFront.moveTo(-sw / 2, 0);
    wallFront.lineTo(sw / 2, 0);
    wallFront.lineTo(sw / 2, -sh);
    wallFront.lineTo(-sw / 2, -sh);

    const wallBack = new THREE.Shape();
    wallBack.moveTo(-sw / 2, 0);
    wallBack.lineTo(sw / 2, 0);
    wallBack.lineTo(sw / 2, sh);
    wallBack.lineTo(-sw / 2, sh);

    const wallLeft = new THREE.Shape();
    wallLeft.moveTo(0, -sd / 2);
    wallLeft.lineTo(-sh, -sd / 2);
    wallLeft.lineTo(-sh, sd / 2);
    wallLeft.lineTo(0, sd / 2);

    const wallRight = new THREE.Shape();
    wallRight.moveTo(0, -sd / 2);
    wallRight.lineTo(sh, -sd / 2);
    wallRight.lineTo(sh, sd / 2);
    wallRight.lineTo(0, sd / 2);

    return { top, wallFront, wallBack, wallLeft, wallRight, sw, sd, sh };
  }, [bounds, baseH, showSupport, supportConfig]);

  // Lid hinge: back of heart (lowest Y point)
  const hingeY = useMemo(() => {
    let minY = Infinity;
    for (const [, y] of lidOutline) if (y < minY) minY = y;
    return minY * SC;
  }, [lidOutline]);

  const lidAngle = lidOpen * Math.PI * 0.6; // max ~108° open

  const matProps = { side: THREE.DoubleSide, roughness: 0.85, metalness: 0.02 };

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* ── Base ── */}
      <group>
        {/* Bottom cap */}
        <mesh geometry={geos.baseCap}>
          <meshStandardMaterial color={scheme.base} map={textures.noiseBase} {...matProps} />
        </mesh>
        {/* Walls */}
        <mesh geometry={geos.baseWall}>
          <meshStandardMaterial color={scheme.wall} map={textures.noiseWall} {...matProps} />
        </mesh>
      </group>

      {/* ── Lid — pivots at back (min Y) ── */}
      <group position={[0, hingeY, baseH * SC]} rotation={[lidAngle, 0, 0]}>
        <group position={[0, -hingeY, 0]}>
          {/* Top cap (at top of lid walls) */}
          <group position={[0, 0, lidH * SC]}>
            <mesh geometry={geos.lidCap}>
              <meshStandardMaterial color={scheme.lidCap} map={textures.noiseLidCap} {...matProps} />
            </mesh>
          </group>
          {/* Lid walls (hanging down) */}
          <mesh geometry={geos.lidWall}>
            <meshStandardMaterial color={scheme.lidWall} map={textures.noiseLidWall} {...matProps} />
          </mesh>
        </group>
      </group>

      {/* ── Support insert (Y-up geometry → rotate +90° X so walls follow Z in heart space) ── */}
      {showSupport && suppShapes && (
        <group position={[bounds.cx * SC, bounds.cy * SC, cardboard * SC + 0.01]} rotation={[HP, 0, 0]}>
          <group position={[0, suppShapes.sh + 0.005, 0]}>
            <SupportMesh shape={suppShapes.top} />
            <group position={[0, 0, suppShapes.sd / 2]} rotation={[HP, 0, 0]}>
              <SupportMesh shape={suppShapes.wallFront} />
            </group>
            <group position={[0, 0, -suppShapes.sd / 2]} rotation={[-HP, 0, 0]}>
              <SupportMesh shape={suppShapes.wallBack} />
            </group>
            <group position={[-suppShapes.sw / 2, 0, 0]} rotation={[0, 0, HP]}>
              <SupportMesh shape={suppShapes.wallLeft} />
            </group>
            <group position={[suppShapes.sw / 2, 0, 0]} rotation={[0, 0, -HP]}>
              <SupportMesh shape={suppShapes.wallRight} />
            </group>
          </group>
        </group>
      )}
    </group>
  );
}
