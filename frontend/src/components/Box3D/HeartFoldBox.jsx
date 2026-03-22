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

import { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { buildSupportHoles } from '../../engine/supportHoles';
import { getCardboardNoiseTexture } from './useCardboardNoise';
import { getScheme } from './cardboardColors';

const SC = 0.01; // mm → three.js units

/* ══════════════════════════════════
 * Parametric heart outline generator
 * ══════════════════════════════════ */
export function generateHeart(length, shapePct, tiltDeg, n = 80) {
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

export function outlineBounds(pts) {
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
  const uvs = [];
  const h = wallH * SC;

  // Compute total perimeter for UV mapping
  let totalPeri = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    totalPeri += Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
  }

  let cumLen = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const [x1, y1] = [pts[i][0] * SC, pts[i][1] * SC];
    const [x2, y2] = [pts[j][0] * SC, pts[j][1] * SC];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const segLen = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;

    const u0 = cumLen / totalPeri;
    const u1 = (cumLen + segLen) / totalPeri;
    cumLen += segLen;

    // Triangle 1: bottom-left, bottom-right, top-right
    positions.push(x1, y1, 0, x2, y2, 0, x2, y2, h);
    normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0);
    uvs.push(u0, 0, u1, 0, u1, 1);
    // Triangle 2: bottom-left, top-right, top-left
    positions.push(x1, y1, 0, x2, y2, h, x1, y1, h);
    normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0);
    uvs.push(u0, 0, u1, 1, u0, 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

/* ── Cap (flat heart panel) geometry ── */
function buildCap(pts, thickness) {
  const shape = outlineToShape(pts);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness * SC,
    bevelEnabled: false,
  });
  // Remap UVs to 0-1 based on bounding box so textures map correctly
  const b = outlineBounds(pts);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = (uv.getX(i) / SC - b.minX) / b.w;
    const v = (uv.getY(i) / SC - b.minY) / b.h;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

/* ── Pocket wall geometry from THREE.Path (scene units) ── */
function buildPocketWalls(holePath, wallH) {
  const pts = holePath.getPoints(40);
  const positions = [];
  const normals = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const x1 = pts[i].x, y1 = pts[i].y;
    const x2 = pts[i + 1].x, y2 = pts[i + 1].y;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dy / len, ny = -dx / len;
    positions.push(x1, y1, 0, x2, y2, 0, x2, y2, wallH);
    normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0);
    positions.push(x1, y1, 0, x2, y2, wallH, x1, y1, wallH);
    normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

/* ── Pocket floor from THREE.Path ── */
function buildPocketFloor(holePath) {
  const pts = holePath.getPoints(40);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 16);
}

export const SUPPORT_COLORS = [
  { id: 'brown',  hex: '#3E2723', label: 'น้ำตาลเข้ม' },
  { id: 'gold',   hex: '#8B6914', label: 'ทอง' },
  { id: 'pink',   hex: '#AD1457', label: 'ชมพู' },
  { id: 'black',  hex: '#212121', label: 'ดำ' },
  { id: 'white',  hex: '#E8E8E8', label: 'ขาว' },
  { id: 'red',    hex: '#B71C1C', label: 'แดง' },
  { id: 'navy',   hex: '#1A237E', label: 'กรมท่า' },
  { id: 'teal',   hex: '#00695C', label: 'เขียวเข้ม' },
];

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
  panelTextureUrls = {},
}) {
  const cardboard = 1.5; // mm thickness
  const clearance = 1.03; // lid is 3% larger
  const lidH = height * 0.35; // lid wall height
  const baseH = height * 0.7; // base wall height (overlap)

  const scheme = useMemo(() => getScheme(boxStyle), [boxStyle]);

  const noiseTextures = useMemo(
    () => ({
      noiseBase: getCardboardNoiseTexture(scheme.base),
      noiseWall: getCardboardNoiseTexture(scheme.wall),
      noiseLidCap: getCardboardNoiseTexture(scheme.lidCap),
      noiseLidWall: getCardboardNoiseTexture(scheme.lidWall),
    }),
    [scheme]
  );

  // Load custom textures from placed images (panelTextureUrls)
  const [customTextures, setCustomTextures] = useState({});
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const loaded = {};
    const entries = Object.entries(panelTextureUrls);
    if (entries.length === 0) { setCustomTextures({}); return; }
    let count = 0;
    for (const [panelId, sides] of entries) {
      const url = sides.outer || sides.inner;
      if (!url) { count++; continue; }
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        loaded[panelId] = tex;
        count++;
        if (count >= entries.length) setCustomTextures({ ...loaded });
      }, undefined, () => { count++; if (count >= entries.length) setCustomTextures({ ...loaded }); });
    }
  }, [panelTextureUrls]);

  const textures = {
    noiseBase: customTextures.baseCap || noiseTextures.noiseBase,
    noiseWall: customTextures.baseWall || noiseTextures.noiseWall,
    noiseLidCap: customTextures.lidCap || noiseTextures.noiseLidCap,
    noiseLidWall: customTextures.lidWall || noiseTextures.noiseLidWall,
  };

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

  // Base bounding box (needed for centering support)
  const baseBounds = useMemo(() => outlineBounds(baseOutline), [baseOutline]);

  // Support insert — solid heart block with pocket recesses (like Godiva tray)
  const suppGeo = useMemo(() => {
    if (!showSupport) return null;

    const gap = 1;
    const innerLength = length - 2 * cardboard - 2 * gap;
    if (innerLength <= 0) return null;

    const insetPts = generateHeart(innerLength, shapePct, tiltDeg);
    const insetBounds = outlineBounds(insetPts);

    const innerZ = baseH * SC - cardboard * SC * 1.5;
    const sh = Math.max(0.015, innerZ * (supportConfig?.wallHeight ?? 0.78));
    const depthRatio = supportConfig?.holeDepth ?? 0.6;
    const pocketH = sh * depthRatio;

    // Bottom plate (solid heart — tray floor)
    const bottomShape = outlineToShape(insetPts);
    const bottomGeo = new THREE.ShapeGeometry(bottomShape, 24);

    // Top plate (heart with holes cut out)
    const topShape = outlineToShape(insetPts);
    const sw = insetBounds.w * SC;
    const sd = insetBounds.h * SC;

    // Shift hole coords so (0,0) in UI = heart center
    const shiftedConfig = {
      ...supportConfig,
      holes: (supportConfig?.holes || []).map(h => ({
        ...h,
        x: h.x + insetBounds.cx / 10,
        y: h.y + insetBounds.cy / 10,
      })),
    };
    const holePaths = buildSupportHoles(sw, sd, shiftedConfig);
    holePaths.forEach(h => topShape.holes.push(h));
    let topGeo;
    try {
      topGeo = new THREE.ShapeGeometry(topShape, 24);
    } catch {
      // Triangulation failed (holes outside boundary) — fallback without holes
      const fallbackShape = outlineToShape(insetPts);
      topGeo = new THREE.ShapeGeometry(fallbackShape, 24);
    }

    // Outer wall
    const outerWallGeo = buildWalls(insetPts, sh / SC);

    // Per-hole pocket geometries (floor + inner walls)
    const pockets = holePaths.map(hp => {
      try {
        return { floor: buildPocketFloor(hp), walls: buildPocketWalls(hp, pocketH) };
      } catch {
        return null;
      }
    }).filter(Boolean);

    const offX = (baseBounds.cx - insetBounds.cx) * SC;
    const offY = (baseBounds.cy - insetBounds.cy) * SC;

    return { bottomGeo, topGeo, outerWallGeo, pockets, sh, pocketH, offX, offY };
  }, [length, shapePct, tiltDeg, baseH, baseBounds, showSupport, supportConfig]);

  // Lid bounds (for slide distance)
  const lidBounds = useMemo(() => outlineBounds(lidOutline), [lidOutline]);

  // Lid animation: phase 1 = lift up, phase 2 = slide back
  // lidOpen 0→0.3 : lift until clearing the walls
  // lidOpen 0.3→1 : slide backward by the full lid depth
  const liftT = Math.min(lidOpen / 0.3, 1);
  const slideT = Math.max(0, (lidOpen - 0.3) / 0.7);
  // Ease functions for smooth motion
  const easeOut = t => 1 - (1 - t) * (1 - t);
  const liftZ = easeOut(liftT) * lidH * SC * 1.3;
  const slideX = easeOut(slideT) * lidBounds.w * SC; // slide sideways

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

      {/* ── Lid — lift up then slide back ── */}
      <group position={[slideX, 0, baseH * SC + liftZ]}>
        {/* Top cap (at top of lid walls) */}
        <group position={[0, 0, lidH * SC]}>
          <mesh geometry={geos.lidCap}>
            <meshStandardMaterial color={scheme.lidCap} map={textures.noiseLidCap} {...matProps} />
          </mesh>
        </group>
        {/* Lid walls */}
        <mesh geometry={geos.lidWall}>
          <meshStandardMaterial color={scheme.lidWall} map={textures.noiseLidWall} {...matProps} />
        </mesh>
      </group>

      {/* ── Solid heart support tray with pocket recesses ── */}
      {showSupport && suppGeo && (() => {
        const col = supportConfig?.color || '#3E2723';
        const mp = { color: col, side: THREE.DoubleSide, roughness: 0.72, metalness: 0.03 };
        return (
          <group position={[suppGeo.offX, suppGeo.offY, cardboard * SC + 0.001]}>
            {/* Bottom plate (tray floor) */}
            <mesh castShadow receiveShadow>
              <primitive object={suppGeo.bottomGeo} attach="geometry" />
              <meshStandardMaterial {...mp} />
            </mesh>
            {/* Top plate with holes */}
            <mesh position={[0, 0, suppGeo.sh]} castShadow receiveShadow>
              <primitive object={suppGeo.topGeo} attach="geometry" />
              <meshStandardMaterial {...mp} />
            </mesh>
            {/* Outer wall */}
            <mesh castShadow receiveShadow>
              <primitive object={suppGeo.outerWallGeo} attach="geometry" />
              <meshStandardMaterial {...mp} />
            </mesh>
            {/* Pocket interiors */}
            {suppGeo.pockets.map((pocket, i) => (
              <group key={i} position={[0, 0, suppGeo.sh - suppGeo.pocketH]}>
                <mesh castShadow receiveShadow>
                  <primitive object={pocket.floor} attach="geometry" />
                  <meshStandardMaterial {...mp} />
                </mesh>
                <mesh castShadow receiveShadow>
                  <primitive object={pocket.walls} attach="geometry" />
                  <meshStandardMaterial {...mp} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })()}
    </group>
  );
}
