/**
 * DxfFoldBox — Procedural 13-Panel Dieline with proper Shape geometry
 *
 * Based on the working DieCutBox from commit 65fe3a9.
 * All shapes are procedural — tongue dome, back flap taper, slot strip notches.
 *
 * Fold hierarchy:
 *   FRONT (root, center)
 *     ├─ DEPTH_L → SLOT_STRIP_L
 *     ├─ DEPTH_R → SLOT_STRIP_R
 *     ├─ DEPTH_STRIP → BACK
 *     │    ├─ BACK_FLAP_L / _R
 *     │    ├─ TONGUE
 *     │    └─ DEPTH_EXT_L / _R
 *     └─ BOTTOM_FLAP
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { buildSupportHoles } from '../../engine/supportHoles';
import { getCardboardNoiseTexture } from './useCardboardNoise';

const HP = Math.PI / 2;
const CARD_COLOR = '#c4a574';
const EDGE_COLOR = '#8b6914';
const CUT_COLOR = '#cc2222';

// Shared procedural cardboard noise texture
const _cardNoiseTex = getCardboardNoiseTexture(CARD_COLOR);

// ─── SVG-derived proportional constants ──────────────────────
const BACK_INSET = 9 / 500;

const SLOT_TAB_W = 10.5 / 80;
const SLOT_TAB_H = 60 / 300;
const SLOT_POS_1 = 81.5 / 303;
const SLOT_POS_2 = 221.5 / 303;

const STRIP_OFFSET = 4.5 / 80;
const STRIP_NOTCH_H = 54.8 / 303;
const STRIP_NOTCH_TIP = 2.6 / 303;

const FLAP_TAPER_X = 71.7 / 80;
const FLAP_TAPER_Y = 12.6 / 300;
const FLAP_CORNER_R = 10 / 80;

const TONGUE_DIAG_Y = 6.522 / 80;
const TONGUE_PEAK_Y = 12.27 / 80;
const TONGUE_SMALL_R = 5 / 80;

// ─── Shape generators ───────────────────────────────────────

function createDepthPanelShape(d, h) {
  const tabW = SLOT_TAB_W * d;
  const tabH = SLOT_TAB_H * h;
  const s1 = SLOT_POS_1 * h;
  const s2 = SLOT_POS_2 * h;

  const s = new THREE.Shape();
  s.moveTo(-d / 2, -h / 2);
  s.lineTo(d / 2, -h / 2);

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

function createSlotStripShape(d, h) {
  const bodyOff = STRIP_OFFSET * d;
  const notchH = STRIP_NOTCH_H * h;
  const tipDy = STRIP_NOTCH_TIP * h;
  const s1 = SLOT_POS_1 * h;
  const s2 = SLOT_POS_2 * h;

  const innerX = d / 2;
  const outerX = -d / 2;
  const bodyX = outerX + bodyOff;

  const s = new THREE.Shape();
  s.moveTo(innerX, -h / 2);
  s.lineTo(bodyX, -h / 2);

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

function createBackFlapShape(d, h) {
  const tx = FLAP_TAPER_X * d;
  const ty = FLAP_TAPER_Y * h;
  const r = FLAP_CORNER_R * d;

  const s = new THREE.Shape();
  s.moveTo(d / 2, h / 2);
  s.lineTo(d / 2 - tx, h / 2 - ty);
  s.quadraticCurveTo(-d / 2, h / 2 - ty, -d / 2, h / 2 - ty - r);
  s.lineTo(-d / 2, -h / 2 + ty + r);
  s.quadraticCurveTo(-d / 2, -h / 2 + ty, d / 2 - tx, -h / 2 + ty);
  s.lineTo(d / 2, -h / 2);
  s.closePath();
  return s;
}

function createTongueShape(w, d) {
  const extend = d;
  const fw = w;
  const fh = d;
  const smallR = TONGUE_SMALL_R * d;
  const diagY = TONGUE_DIAG_Y * d;
  const peakY = TONGUE_PEAK_Y * d;

  const s = new THREE.Shape();
  s.moveTo(-fw / 2, 0);
  s.lineTo(fw / 2, 0);
  s.lineTo(fw / 2 + extend - smallR * 2, diagY);
  s.quadraticCurveTo(fw / 2 + extend, diagY, fw / 2 + extend, peakY);
  s.bezierCurveTo(
    fw / 2 + extend, fh * 0.45,
    fw / 2 + extend * 0.5, fh * 0.92,
    fw / 2, fh,
  );
  s.lineTo(-fw / 2, fh);
  s.bezierCurveTo(
    -fw / 2 - extend * 0.5, fh * 0.92,
    -fw / 2 - extend, fh * 0.45,
    -fw / 2 - extend, peakY,
  );
  s.quadraticCurveTo(-fw / 2 - extend, diagY, -fw / 2 - extend + smallR * 2, diagY);
  s.lineTo(-fw / 2, 0);
  s.closePath();
  return s;
}

// ─── Render helpers ──────────────────────────────────────────

function ShapePanel({ shape, flipX = false }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(shape, 24), [shape]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  const sx = flipX ? -1 : 1;
  return (
    <group scale={[sx, 1, 1]}>
      <mesh>
        <primitive object={geo} attach="geometry" />
        <meshStandardMaterial color="#ffffff" map={_cardNoiseTex} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
      <lineSegments>
        <primitive object={edges} attach="geometry" />
        <lineBasicMaterial color={CUT_COLOR} transparent opacity={0.7} />
      </lineSegments>
    </group>
  );
}

function RectPanel({ w, h }) {
  const edges = useMemo(() => {
    const geo = new THREE.PlaneGeometry(w, h);
    return new THREE.EdgesGeometry(geo);
  }, [w, h]);
  return (
    <>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#ffffff" map={_cardNoiseTex} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
      <lineSegments>
        <primitive object={edges} attach="geometry" />
        <lineBasicMaterial color={CUT_COLOR} transparent opacity={0.7} />
      </lineSegments>
    </>
  );
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

// ─── Main Component ─────────────────────────────────────────

export default function DxfFoldBox({
  width = 500, height = 300, depth = 80,
  foldProgress = 0, panelImages = {},
  showSupport = false, supportConfig,
}) {
  // mm → scene units (÷100)
  const W = width / 100;
  const H = height / 100;
  const D = depth / 100;
  const t = 0.005; // z-fighting offset per layer

  const inset = BACK_INSET * W;
  const bw = W - 2 * inset;

  const flat = [-HP, 0, 0];

  const shapes = useMemo(() => ({
    depthPanel: createDepthPanelShape(D, H),
    slotStrip: createSlotStripShape(D, H),
    backFlap: createBackFlapShape(D, H),
    tongue: createTongueShape(W, D),
  }), [W, H, D]);

  // Support insert shapes
  // When folded: base = W × H (XZ plane), walls go up D in Y
  const suppShapes = useMemo(() => {
    if (!showSupport) return null;
    const sw = W * 0.94;   // fits inside face width
    const sd = H * 0.94;   // fits inside face height (base depth when folded)
    const sh = D * (supportConfig?.wallHeight || 0.78); // wall height based on box depth

    // Top plate with configurable holes
    const top = new THREE.Shape();
    top.moveTo(-sw / 2, -sd / 2); top.lineTo(sw / 2, -sd / 2);
    top.lineTo(sw / 2, sd / 2); top.lineTo(-sw / 2, sd / 2);
    const holes = buildSupportHoles(sw, sd, supportConfig);
    holes.forEach(h => top.holes.push(h));

    // Walls
    const wallFront = new THREE.Shape();
    wallFront.moveTo(-sw / 2, 0); wallFront.lineTo(sw / 2, 0);
    wallFront.lineTo(sw / 2, -sh); wallFront.lineTo(-sw / 2, -sh);

    const wallBack = new THREE.Shape();
    wallBack.moveTo(-sw / 2, 0); wallBack.lineTo(sw / 2, 0);
    wallBack.lineTo(sw / 2, sh); wallBack.lineTo(-sw / 2, sh);

    const wallLeft = new THREE.Shape();
    wallLeft.moveTo(0, -sd / 2); wallLeft.lineTo(-sh, -sd / 2);
    wallLeft.lineTo(-sh, sd / 2); wallLeft.lineTo(0, sd / 2);

    const wallRight = new THREE.Shape();
    wallRight.moveTo(0, -sd / 2); wallRight.lineTo(sh, -sd / 2);
    wallRight.lineTo(sh, sd / 2); wallRight.lineTo(0, sd / 2);

    return { top, wallFront, wallBack, wallLeft, wallRight, sw, sd, sh };
  }, [W, H, D, showSupport, supportConfig]);

  return (
    <group position={[0, 0.01, 0]}>

      {/* 1. FRONT PANEL */}
      <group rotation={flat}>
        <RectPanel w={W} h={H} />
      </group>

      {/* LEFT SIDE: depth panel + slot strip */}
      <group position={[-W / 2, 0, 0]}>
        <group position={[-D / 2, t, 0]} rotation={flat}>
          <ShapePanel shape={shapes.depthPanel} />
        </group>
        <group position={[-D, 0, 0]}>
          <group position={[-D / 2, t * 2, 0]} rotation={flat}>
            <ShapePanel shape={shapes.slotStrip} />
          </group>
        </group>
      </group>

      {/* RIGHT SIDE: depth panel + slot strip (mirror) */}
      <group position={[W / 2, 0, 0]}>
        <group position={[D / 2, t, 0]} rotation={flat}>
          <ShapePanel shape={shapes.depthPanel} flipX />
        </group>
        <group position={[D, 0, 0]}>
          <group position={[D / 2, t * 2, 0]} rotation={flat}>
            <ShapePanel shape={shapes.slotStrip} flipX />
          </group>
        </group>
      </group>

      {/* TOP CHAIN: depth strip → back → flaps → tongue */}
      <group position={[0, 0, -H / 2]}>
        {/* Depth strip */}
        <group position={[0, t * 0.5, -D / 2]} rotation={flat}>
          <RectPanel w={W} h={D} />
        </group>

        {/* Depth extensions L/R */}
        <group position={[-(W / 2 + D / 2), t, -D / 2]} rotation={flat}>
          <RectPanel w={D} h={D} />
        </group>
        <group position={[W / 2 + D / 2, t, -D / 2]} rotation={flat}>
          <RectPanel w={D} h={D} />
        </group>

        <group position={[0, 0, -D]}>
          {/* Back panel */}
          <group position={[0, t, -H / 2]} rotation={flat}>
            <RectPanel w={bw} h={H} />
          </group>

          {/* Back flap L */}
          <group position={[-bw / 2, 0, 0]}>
            <group position={[-D / 2, t, -H / 2]} rotation={flat}>
              <ShapePanel shape={shapes.backFlap} flipX />
            </group>
          </group>

          {/* Back flap R */}
          <group position={[bw / 2, 0, 0]}>
            <group position={[D / 2, t, -H / 2]} rotation={flat}>
              <ShapePanel shape={shapes.backFlap} />
            </group>
          </group>

          {/* Tongue */}
          <group position={[0, t, -H]} rotation={flat}>
            <ShapePanel shape={shapes.tongue} />
          </group>
        </group>
      </group>

      {/* BOTTOM FLAP */}
      <group position={[0, 0, H / 2]}>
        <group position={[0, t, D / 2]} rotation={flat}>
          <RectPanel w={W + 2 * D} h={D} />
        </group>
      </group>

      {/* SUPPORT INSERT */}
      {showSupport && suppShapes && (
        <group position={[0, suppShapes.sh + 0.005, 0]}>
          {/* Top plate with holes */}
          <SupportMesh shape={suppShapes.top} />
          {/* Front wall */}
          <group position={[0, 0, suppShapes.sd / 2]} rotation={[HP, 0, 0]}>
            <SupportMesh shape={suppShapes.wallFront} />
          </group>
          {/* Back wall */}
          <group position={[0, 0, -suppShapes.sd / 2]} rotation={[-HP, 0, 0]}>
            <SupportMesh shape={suppShapes.wallBack} />
          </group>
          {/* Left wall */}
          <group position={[-suppShapes.sw / 2, 0, 0]} rotation={[0, 0, HP]}>
            <SupportMesh shape={suppShapes.wallLeft} />
          </group>
          {/* Right wall */}
          <group position={[suppShapes.sw / 2, 0, 0]} rotation={[0, 0, -HP]}>
            <SupportMesh shape={suppShapes.wallRight} />
          </group>
        </group>
      )}

    </group>
  );
}
