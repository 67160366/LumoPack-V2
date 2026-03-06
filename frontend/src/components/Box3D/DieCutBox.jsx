/**
 * DieCutBox — Procedural 13-Panel Dieline with Fold Hierarchy
 *
 * ทุก panel สร้างจาก procedural geometry — ไม่ใช้ SVGLoader, ไม่ hardcode ขนาด
 * W/H/D ปรับแยกกันได้อิสระ แต่ละ panel scale ตามมิติที่ถูกต้อง
 *
 * อ้างอิงสัดส่วนจาก: 500x300x80mm-folding-box.svg (877×858 viewBox)
 *
 * Fold hierarchy (Phase 1 = flat, fold angles = 0):
 *
 *   FRONT (root, center)
 *     ├─ DEPTH_L → SLOT_STRIP_L       (pivot: front left edge,  fold Z)
 *     ├─ DEPTH_R → SLOT_STRIP_R       (pivot: front right edge, fold Z)
 *     ├─ DEPTH_STRIP → BACK           (pivot: front top edge,   fold X)
 *     │    ├─ BACK_FLAP_L / _R        (pivot: back side edges,  fold Z)
 *     │    ├─ TONGUE                   (pivot: back top edge,    fold X)
 *     │    └─ DEPTH_EXT_L / _R
 *     └─ BOTTOM_FLAP                  (pivot: front bottom edge, fold X)
 *
 * Center (0,0,0) = center of FRONT PANEL on XZ plane
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Shape, DoubleSide } from 'three';
import { Line } from '@react-three/drei';
import useCorrugatedTexture from './useCorrugatedTexture';

// ─── SVG-derived proportional constants ──────────────────────
// All ratios from the 500×300×80mm reference SVG.
// Format: FEATURE_RATIO = svgMeasure / referenceDimension

const BACK_INSET = 9 / 500;              // back panel inset per side (× W)

const SLOT_TAB_W = 10.5 / 80;            // slot tab width on depth panel (× D)
const SLOT_TAB_H = 60 / 300;             // slot tab height (× H)
const SLOT_POS_1 = 81.5 / 303;           // lower slot center from bottom (× H)
const SLOT_POS_2 = 221.5 / 303;          // upper slot center from bottom (× H)

const STRIP_OFFSET = 4.5 / 80;           // slot strip body inset (× D)
const STRIP_NOTCH_H = 54.8 / 303;        // slot strip notch height (× H)
const STRIP_NOTCH_TIP = 2.6 / 303;       // notch tip overshoot (× H)

const FLAP_TAPER_X = 71.7 / 80;          // back flap diagonal X (× D)
const FLAP_TAPER_Y = 12.6 / 300;         // back flap diagonal Y (× H)
const FLAP_CORNER_R = 10 / 80;           // back flap corner radius (× D)

const TONGUE_DIAG_Y = 6.522 / 80;        // tongue diagonal Y offset (× D)
const TONGUE_PEAK_Y = 12.27 / 80;        // tongue peak Y (× D)
const TONGUE_SMALL_R = 5 / 80;           // tongue transition arc (× D)

const HP = Math.PI / 2;

// ─── Shape generators ───────────────────────────────────────

/**
 * Depth panel: D×H rectangle with 2 slot tab rectangles on outer edge.
 * Shape origin = center of the D×H body. Tabs extend in +X.
 */
function createDepthPanelShape(d, h) {
  const tabW = SLOT_TAB_W * d;
  const tabH = SLOT_TAB_H * h;
  const s1 = SLOT_POS_1 * h;   // lower slot center from bottom
  const s2 = SLOT_POS_2 * h;   // upper slot center from bottom

  const s = new Shape();
  s.moveTo(-d / 2, -h / 2);
  s.lineTo(d / 2, -h / 2);

  // Right edge going up — insert 2 tab rectangles
  s.lineTo(d / 2, -h / 2 + s1 - tabH / 2);
  s.lineTo(d / 2 + tabW, -h / 2 + s1 - tabH / 2);
  s.lineTo(d / 2 + tabW, -h / 2 + s1 + tabH / 2);
  s.lineTo(d / 2, -h / 2 + s1 + tabH / 2);

  s.lineTo(d / 2, -h / 2 + s2 - tabH / 2);
  s.lineTo(d / 2 + tabW, -h / 2 + s2 - tabH / 2);
  s.lineTo(d / 2 + tabW, -h / 2 + s2 + tabH / 2);
  s.lineTo(d / 2, -h / 2 + s2 + tabH / 2);

  s.lineTo(d / 2, h / 2);
  s.lineTo(-d / 2, h / 2);
  s.closePath();
  return s;
}

/**
 * Slot strip: D×H with pointed V-notch indentations on inner edge.
 * Body is inset by STRIP_OFFSET from outer edge.
 * Shape origin = center. Notches indent from +X (inner) toward -X (outer).
 */
function createSlotStripShape(d, h) {
  const bodyOff = STRIP_OFFSET * d;
  const notchH = STRIP_NOTCH_H * h;
  const tipDy = STRIP_NOTCH_TIP * h;
  const s1 = SLOT_POS_1 * h;
  const s2 = SLOT_POS_2 * h;

  const innerX = d / 2;
  const outerX = -d / 2;
  const bodyX = outerX + bodyOff; // body edge (slightly inset from outer)

  const s = new Shape();
  s.moveTo(innerX, -h / 2);
  s.lineTo(bodyX, -h / 2);

  // Outer edge going up with 2 V-notch indentations
  const n1b = -h / 2 + s1 - notchH / 2;
  const n1t = -h / 2 + s1 + notchH / 2;
  const n2b = -h / 2 + s2 - notchH / 2;
  const n2t = -h / 2 + s2 + notchH / 2;

  s.lineTo(bodyX, n1b - tipDy);
  s.lineTo(outerX, n1b);
  s.lineTo(outerX, n1t);
  s.lineTo(bodyX, n1t + tipDy);

  s.lineTo(bodyX, n2b - tipDy);
  s.lineTo(outerX, n2b);
  s.lineTo(outerX, n2t);
  s.lineTo(bodyX, n2t + tipDy);

  s.lineTo(bodyX, h / 2);
  s.lineTo(innerX, h / 2);
  s.closePath();
  return s;
}

/**
 * Back flap: tapered shape with rounded corners (for LEFT side).
 * Inner edge (right, +X) is full height. Outer edge tapers with arcs.
 * Shape origin = center of bounding box.
 */
function createBackFlapShape(d, h) {
  const tx = FLAP_TAPER_X * d;
  const ty = FLAP_TAPER_Y * h;
  const r = FLAP_CORNER_R * d;

  const s = new Shape();

  // Start at inner-top, go clockwise
  s.moveTo(d / 2, h / 2);

  // Top diagonal: inner-top → toward outer edge
  s.lineTo(d / 2 - tx, h / 2 - ty);
  s.quadraticCurveTo(-d / 2, h / 2 - ty, -d / 2, h / 2 - ty - r);

  // Outer edge (vertical)
  s.lineTo(-d / 2, -h / 2 + ty + r);

  // Bottom diagonal: outer → inner-bottom
  s.quadraticCurveTo(-d / 2, -h / 2 + ty, d / 2 - tx, -h / 2 + ty);
  s.lineTo(d / 2, -h / 2);

  s.closePath();
  return s;
}

/**
 * Tongue: (W + 2·extend) wide, D tall, with dome arc on top.
 * Extends ≈D beyond back panel on each side.
 * Shape origin = bottom-center (at crease line).
 *
 * SVG ref: R=5 transition arcs + R=D main arcs forming the dome.
 */
function createTongueShape(w, d) {
  const extend = d;
  const fw = w;
  const fh = d;
  const smallR = TONGUE_SMALL_R * d;
  const diagY = TONGUE_DIAG_Y * d;
  const peakY = TONGUE_PEAK_Y * d;

  const s = new Shape();

  // Bottom edge (crease)
  s.moveTo(-fw / 2, 0);
  s.lineTo(fw / 2, 0);

  // Right side: diagonal up to R=5 transition
  s.lineTo(fw / 2 + extend - smallR * 2, diagY);
  s.quadraticCurveTo(fw / 2 + extend, diagY, fw / 2 + extend, peakY);

  // Right R=D arc sweeping up to top
  s.bezierCurveTo(
    fw / 2 + extend, fh * 0.45,
    fw / 2 + extend * 0.5, fh * 0.92,
    fw / 2, fh,
  );

  // Top edge
  s.lineTo(-fw / 2, fh);

  // Left R=D arc sweeping down (mirror)
  s.bezierCurveTo(
    -fw / 2 - extend * 0.5, fh * 0.92,
    -fw / 2 - extend, fh * 0.45,
    -fw / 2 - extend, peakY,
  );

  // Left R=5 transition + diagonal
  s.quadraticCurveTo(-fw / 2 - extend, diagY, -fw / 2 - extend + smallR * 2, diagY);
  s.lineTo(-fw / 2, 0);

  s.closePath();
  return s;
}

// ─── Outline helpers ──────────────────────────────────────────

const LINE_COLOR = '#ff0000';
const LINE_WIDTH = 1.5;

/** Red outline for a rectangle (used with planeGeometry panels) */
function RectOutline({ w, h }) {
  const points = useMemo(() => [
    [-w / 2, -h / 2, 0],
    [w / 2, -h / 2, 0],
    [w / 2, h / 2, 0],
    [-w / 2, h / 2, 0],
    [-w / 2, -h / 2, 0],
  ], [w, h]);
  return <Line points={points} color={LINE_COLOR} lineWidth={LINE_WIDTH} />;
}

/** Red outline from a Three.js Shape (used with shapeGeometry panels) */
function ShapeOutline({ shape }) {
  const points = useMemo(() => {
    const pts = shape.getPoints(64);
    const arr = pts.map(p => [p.x, p.y, 0]);
    arr.push(arr[0]); // close loop
    return arr;
  }, [shape]);
  return <Line points={points} color={LINE_COLOR} lineWidth={LINE_WIDTH} />;
}

// ─── Main Component ─────────────────────────────────────────

export default function DieCutBox({ width, height, depth }) {
  const group = useRef();
  const map = useCorrugatedTexture();
  useFrame((_s, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.08;
  });

  // cm → scene units
  const W = width / 10;
  const H = height / 10;
  const D = depth / 10;
  const t = 0.015; // z-fighting offset per layer

  // Derived
  const inset = BACK_INSET * W;
  const bw = W - 2 * inset; // back panel width

  const matProps = { map, roughness: 0.85, side: DoubleSide };
  const flat = [-HP, 0, 0]; // rotation to lay shape flat on XZ

  // Pre-compute shapes (recalculate when dimensions change)
  const shapes = useMemo(() => ({
    depthPanel: createDepthPanelShape(D, H),
    slotStrip: createSlotStripShape(D, H),
    backFlap: createBackFlapShape(D, H),
    tongue: createTongueShape(W, D),
  }), [W, H, D, bw]);

  return (
    <group ref={group} position={[0, 0.01, 0]}>

      {/* ═══════════════════════════════════════════════
       *  1. FRONT PANEL (root, center reference)
       *     W × H, centered at origin
       * ═══════════════════════════════════════════════ */}
      <mesh rotation={flat}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <group position={[0, t * 3, 0]} rotation={flat}>
        <RectOutline w={W} h={H} />
      </group>

      {/* ═══════════════════════════════════════════════
       *  LEFT SIDE CHAIN
       *  pivot: front panel left edge → fold around Z
       * ═══════════════════════════════════════════════ */}
      <group position={[-W / 2, 0, 0]}>

        {/* 7. DEPTH_L — D×H with slot tabs */}
        <mesh position={[-D / 2, t, 0]} rotation={flat}>
          <shapeGeometry args={[shapes.depthPanel]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <group position={[-D / 2, t * 4, 0]} rotation={flat}>
          <ShapeOutline shape={shapes.depthPanel} />
        </group>

        {/* pivot: depth panel outer edge → slot strip */}
        <group position={[-D, 0, 0]}>

          {/* 11. SLOT_STRIP_L — D×H with V-notches */}
          <mesh position={[-D / 2, t * 2, 0]} rotation={flat}>
            <shapeGeometry args={[shapes.slotStrip]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <group position={[-D / 2, t * 5, 0]} rotation={flat}>
            <ShapeOutline shape={shapes.slotStrip} />
          </group>

        </group>
      </group>

      {/* ═══════════════════════════════════════════════
       *  RIGHT SIDE CHAIN (mirror of left)
       *  pivot: front panel right edge → fold around Z
       * ═══════════════════════════════════════════════ */}
      <group position={[W / 2, 0, 0]}>

        {/* 8. DEPTH_R */}
        <mesh position={[D / 2, t, 0]} rotation={flat} scale={[-1, 1, 1]}>
          <shapeGeometry args={[shapes.depthPanel]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <group position={[D / 2, t * 4, 0]} rotation={flat} scale={[-1, 1, 1]}>
          <ShapeOutline shape={shapes.depthPanel} />
        </group>

        <group position={[D, 0, 0]}>

          {/* 12. SLOT_STRIP_R */}
          <mesh position={[D / 2, t * 2, 0]} rotation={flat} scale={[-1, 1, 1]}>
            <shapeGeometry args={[shapes.slotStrip]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <group position={[D / 2, t * 5, 0]} rotation={flat} scale={[-1, 1, 1]}>
            <ShapeOutline shape={shapes.slotStrip} />
          </group>

        </group>
      </group>

      {/* ═══════════════════════════════════════════════
       *  TOP CHAIN
       *  pivot: front panel top edge → fold around X
       * ═══════════════════════════════════════════════ */}
      <group position={[0, 0, -H / 2]}>

        {/* 2. DEPTH_STRIP — W × D */}
        <mesh position={[0, t * 0.5, -D / 2]} rotation={flat}>
          <planeGeometry args={[W, D]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <group position={[0, t * 3, -D / 2]} rotation={flat}>
          <RectOutline w={W} h={D} />
        </group>

        {/* 9. DEPTH_EXT_L — D × D (connects depth_L top to depth strip) */}
        <mesh position={[-(W / 2 + D / 2), t, -D / 2]} rotation={flat}>
          <planeGeometry args={[D, D]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <group position={[-(W / 2 + D / 2), t * 4, -D / 2]} rotation={flat}>
          <RectOutline w={D} h={D} />
        </group>

        {/* 10. DEPTH_EXT_R — D × D (mirror) */}
        <mesh position={[W / 2 + D / 2, t, -D / 2]} rotation={flat}>
          <planeGeometry args={[D, D]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <group position={[W / 2 + D / 2, t * 4, -D / 2]} rotation={flat}>
          <RectOutline w={D} h={D} />
        </group>

        {/* pivot: depth strip far edge → back panel */}
        <group position={[0, 0, -D]}>

          {/* 3. BACK PANEL — bw × H */}
          <mesh position={[0, t, -H / 2]} rotation={flat}>
            <planeGeometry args={[bw, H]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
          <group position={[0, t * 4, -H / 2]} rotation={flat}>
            <RectOutline w={bw} h={H} />
          </group>

          {/* 4. BACK_FLAP_L — pivot: back panel left edge */}
          <group position={[-bw / 2, 0, 0]}>
            <mesh position={[-D / 2, t, -H / 2]} rotation={flat}>
              <shapeGeometry args={[shapes.backFlap]} />
              <meshStandardMaterial {...matProps} />
            </mesh>
            <group position={[-D / 2, t * 4, -H / 2]} rotation={flat}>
              <ShapeOutline shape={shapes.backFlap} />
            </group>
          </group>

          {/* 5. BACK_FLAP_R — pivot: back panel right edge (mirror) */}
          <group position={[bw / 2, 0, 0]}>
            <mesh position={[D / 2, t, -H / 2]} rotation={flat} scale={[-1, 1, 1]}>
              <shapeGeometry args={[shapes.backFlap]} />
              <meshStandardMaterial {...matProps} />
            </mesh>
            <group position={[D / 2, t * 4, -H / 2]} rotation={flat} scale={[-1, 1, 1]}>
              <ShapeOutline shape={shapes.backFlap} />
            </group>
          </group>

          {/* pivot: back panel far edge → tongue */}
          <group position={[0, 0, -H]}>

            {/* 6. TONGUE — (W + 2·extend) × D with dome arc */}
            <mesh position={[0, t, 0]} rotation={flat}>
              <shapeGeometry args={[shapes.tongue]} />
              <meshStandardMaterial {...matProps} />
            </mesh>
            <group position={[0, t * 4, 0]} rotation={flat}>
              <ShapeOutline shape={shapes.tongue} />
            </group>

          </group>
        </group>
      </group>

      {/* ═══════════════════════════════════════════════
       *  BOTTOM CHAIN
       *  pivot: front panel bottom edge → fold around X
       * ═══════════════════════════════════════════════ */}
      <group position={[0, 0, H / 2]}>

        {/* 13. BOTTOM_FLAP — (W + 2D) × D */}
        <mesh position={[0, t, D / 2]} rotation={flat}>
          <planeGeometry args={[W + 2 * D, D]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <group position={[0, t * 4, D / 2]} rotation={flat}>
          <RectOutline w={W + 2 * D} h={D} />
        </group>

      </group>

    </group>
  );
}
