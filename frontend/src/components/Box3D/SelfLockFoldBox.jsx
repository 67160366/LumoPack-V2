/**
 * SelfLockFoldBox — Procedural 3D self-locking box with fold animation
 *
 * Based on 400x250x80mm-self-locking-box.dxf reference.
 *
 * Fold hierarchy (like RSCFoldBox — nested groups, XZ flat, Y=up):
 *   FRONT (root, center)
 *     ├─ BOTTOM_FLAP (face-width, folds last → on top)
 *     ├─ TOP_FLAP (face-width, folds last → on top)
 *     ├─ LEFT_DEPTH (hinge at left edge)
 *     │   ├─ LEFT_BOT_TAB (folds first → underneath)
 *     │   ├─ LEFT_TOP_TAB (folds first → underneath)
 *     │   └─ LOCK_STRIP → LOCK_PANEL (with bump notches)
 *     └─ RIGHT_DEPTH (hinge at right edge)
 *         ├─ RIGHT_BOT_TAB (folds first → underneath)
 *         ├─ RIGHT_TOP_TAB (folds first → underneath)
 *         └─ BACK_PANEL (hinge at far edge)
 *             ├─ BACK_LEFT_FLAP (side tab)
 *             ├─ BACK_RIGHT_FLAP (side tab)
 *             └─ TONGUE (top closure, curved)
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import Panel from './Panel';
import { buildSupportHoles } from '../../engine/supportHoles';
import { getCardboardNoiseTexture } from './useCardboardNoise';

const HP = Math.PI / 2;
const SC = 0.01; // mm → three.js units

function ease(p, s, e) {
  if (p <= s) return 0;
  if (p >= e) return 1;
  const t = (p - s) / (e - s);
  return t * t * (3 - 2 * t);
}

// ─── Lock panel shape (with bump notches on the outer edge) ───
function createLockPanelShape(w, h) {
  const bumpW = 4.5 * SC;
  const bumpH = 17 * SC;
  const notchY1 = h * 0.33;
  const notchY2 = h * 0.60;

  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);

  // Outer edge (left side) with two bumps
  s.lineTo(-w / 2, notchY2 + bumpH / 2 - h / 2);
  s.lineTo(-w / 2 - bumpW, notchY2 + bumpH * 0.3 - h / 2);
  s.lineTo(-w / 2 - bumpW, notchY2 - bumpH * 0.3 - h / 2);
  s.lineTo(-w / 2, notchY2 - bumpH / 2 - h / 2);

  s.lineTo(-w / 2, notchY1 + bumpH / 2 - h / 2);
  s.lineTo(-w / 2 - bumpW, notchY1 + bumpH * 0.3 - h / 2);
  s.lineTo(-w / 2 - bumpW, notchY1 - bumpH * 0.3 - h / 2);
  s.lineTo(-w / 2, notchY1 - bumpH / 2 - h / 2);

  s.closePath();
  return s;
}

// ─── Tongue shape (curved closure lid) ───
// Extends from the far edge of the back panel, D wide, H tall with curved far corners
function createTongueShape(d, h) {
  const tw = d * 0.9;     // tongue depth (slightly less than D)
  const th = h * 0.9;     // tongue height (slightly less than H)
  const r = d * 0.2;      // corner radius

  const s = new THREE.Shape();
  s.moveTo(0, -th / 2);
  s.lineTo(tw - r, -th / 2);
  s.quadraticCurveTo(tw, -th / 2, tw, -th / 2 + r);
  s.lineTo(tw, th / 2 - r);
  s.quadraticCurveTo(tw, th / 2, tw - r, th / 2);
  s.lineTo(0, th / 2);
  s.closePath();
  return s;
}

// ─── Shape panel renderer ───
const _shapeNoise = getCardboardNoiseTexture('#b8976a');

function ShapePanel({ shape, color = '#b8976a', rotation }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(shape, 24), [shape]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  return (
    <group rotation={rotation}>
      <mesh>
        <primitive object={geo} attach="geometry" />
        <meshStandardMaterial color="#ffffff" map={_shapeNoise} side={THREE.DoubleSide} roughness={0.85} metalness={0.02} />
      </mesh>
      <lineSegments>
        <primitive object={edges} attach="geometry" />
        <lineBasicMaterial color={0x333333} transparent opacity={0.3} />
      </lineSegments>
    </group>
  );
}

// ─── Support helpers ───
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

// ─── Main Component ───
export default function SelfLockFoldBox({
  width = 400, height = 250, depth = 80,
  foldProgress = 0, panelImages = {},
  showSupport = false, supportConfig,
}) {
  const W = width * SC;
  const H = height * SC;
  const D = depth * SC;
  const p = foldProgress;
  const t = 0.005; // z-fighting layering offset

  const lockStripW = 6 * SC;
  const lockPanelW = (depth + 1.5) * SC;
  const backPanelW = (width - 6) * SC;
  const depthTabH = D * 0.95;  // depth panel top/bottom tabs
  const backFlapD = D * 0.9;   // back panel side flaps

  const img = (id) => ({
    outerUrl: panelImages[id]?.outer || null,
    innerUrl: panelImages[id]?.inner || null,
  });

  // Fold angles
  const f = useMemo(() => ({
    // Phase 1: side walls fold up
    leftDepth:   ease(p, 0.00, 0.22) * HP,
    rightDepth:  ease(p, 0.00, 0.22) * HP,
    // Phase 2: depth panel tabs fold inward (first, underneath)
    depthBotTab: ease(p, 0.15, 0.35) * HP,
    depthTopTab: ease(p, 0.15, 0.35) * HP,
    // Phase 3: lock chain
    lockStrip:   ease(p, 0.25, 0.45) * HP,
    lockPanel:   ease(p, 0.35, 0.55) * HP,
    // Phase 4: bottom/top face flaps fold (last, on top)
    bottomFlap:  ease(p, 0.30, 0.50) * HP,
    topFlap:     ease(p, 0.30, 0.50) * HP,
    // Phase 5: back panel folds from right depth
    backPanel:   ease(p, 0.45, 0.65) * HP,
    // Phase 6: back side flaps fold inward
    backFlaps:   ease(p, 0.55, 0.72) * HP,
    // Phase 7: tongue folds down to close
    tongue:      ease(p, 0.65, 0.82) * HP,
  }), [p]);

  // Shaped panels
  const shapes = useMemo(() => ({
    lockPanel: createLockPanelShape(lockPanelW, H),
    tongue: createTongueShape(D, H),
  }), [H, D, lockPanelW]);

  // Support insert shapes
  // When folded: base = W × H (XZ plane), walls go up D in Y
  const suppShapes = useMemo(() => {
    if (!showSupport) return null;
    const sw = W * 0.94;   // fits inside face width
    const sd = H * 0.94;   // fits inside face height (base depth when folded)
    const sh = D * (supportConfig?.wallHeight || 0.78); // wall height based on box depth

    const top = new THREE.Shape();
    top.moveTo(-sw / 2, -sd / 2); top.lineTo(sw / 2, -sd / 2);
    top.lineTo(sw / 2, sd / 2); top.lineTo(-sw / 2, sd / 2);
    const holes = buildSupportHoles(sw, sd, supportConfig);
    holes.forEach(h => top.holes.push(h));

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

      {/* ══ FRONT (root panel) ══ */}
      <group>
        <Panel width={W} height={H} {...img('front')} />

        {/* ── BOTTOM FLAP ── face-width, folds LAST (on top of depth tabs) */}
        <group position={[0, 0, H / 2]} rotation={[-f.bottomFlap, 0, 0]}>
          <group position={[0, -t, depthTabH / 2]}>
            <Panel width={W} height={depthTabH} {...img('bottomFlap')} />
          </group>
        </group>

        {/* ── TOP FLAP ── face-width, folds LAST (on top of depth tabs) */}
        <group position={[0, 0, -H / 2]} rotation={[f.topFlap, 0, 0]}>
          <group position={[0, -t, -depthTabH / 2]}>
            <Panel width={W} height={depthTabH} {...img('topFlap')} />
          </group>
        </group>

        {/* ═══ LEFT DEPTH ═══ hinge at front left edge (X = -W/2) */}
        <group position={[-W / 2, 0, 0]} rotation={[0, 0, -f.leftDepth]}>
          <group position={[-D / 2, 0, 0]}>
            <Panel width={D} height={H} {...img('leftDepth')} />

            {/* Left depth BOTTOM tab — folds FIRST (underneath face flap) */}
            <group position={[0, 0, H / 2]} rotation={[-f.depthBotTab, 0, 0]}>
              <group position={[0, 0, depthTabH / 2]}>
                <Panel width={D} height={depthTabH} {...img('leftDepth_bot')} />
              </group>
            </group>

            {/* Left depth TOP tab — folds FIRST (underneath face flap) */}
            <group position={[0, 0, -H / 2]} rotation={[f.depthTopTab, 0, 0]}>
              <group position={[0, 0, -depthTabH / 2]}>
                <Panel width={D} height={depthTabH} {...img('leftDepth_top')} />
              </group>
            </group>

            {/* LOCK STRIP — hinge at left depth far edge */}
            <group position={[-D / 2, 0, 0]} rotation={[0, 0, -f.lockStrip]}>
              <group position={[-lockStripW / 2, -t, 0]}>
                <Panel width={lockStripW} height={H} color="#b8976a" />

                {/* LOCK PANEL — hinge at lock strip far edge */}
                <group position={[-lockStripW / 2, 0, 0]} rotation={[0, 0, -f.lockPanel]}>
                  <group position={[-lockPanelW / 2, -t * 2, 0]}>
                    <ShapePanel shape={shapes.lockPanel} color="#b8976a" rotation={[-HP, 0, 0]} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>

        {/* ═══ RIGHT DEPTH ═══ hinge at front right edge (X = +W/2) */}
        <group position={[W / 2, 0, 0]} rotation={[0, 0, f.rightDepth]}>
          <group position={[D / 2, 0, 0]}>
            <Panel width={D} height={H} {...img('rightDepth')} />

            {/* Right depth BOTTOM tab — folds FIRST */}
            <group position={[0, 0, H / 2]} rotation={[-f.depthBotTab, 0, 0]}>
              <group position={[0, 0, depthTabH / 2]}>
                <Panel width={D} height={depthTabH} {...img('rightDepth_bot')} />
              </group>
            </group>

            {/* Right depth TOP tab — folds FIRST */}
            <group position={[0, 0, -H / 2]} rotation={[f.depthTopTab, 0, 0]}>
              <group position={[0, 0, -depthTabH / 2]}>
                <Panel width={D} height={depthTabH} {...img('rightDepth_top')} />
              </group>
            </group>

            {/* ── BACK PANEL ── hinge at right depth far edge */}
            <group position={[D / 2, 0, 0]} rotation={[0, 0, f.backPanel]}>
              <group position={[backPanelW / 2, -t, 0]}>
                <Panel width={backPanelW} height={H} {...img('back')} />

                {/* Back BOTTOM flap — hinge at Z=+H/2, folds inward */}
                <group position={[0, 0, H / 2]} rotation={[-f.backFlaps, 0, 0]}>
                  <group position={[0, -t * 2, backFlapD / 2]}>
                    <Panel width={backPanelW} height={backFlapD} />
                  </group>
                </group>

                {/* Back TOP flap — hinge at Z=-H/2, folds inward */}
                <group position={[0, 0, -H / 2]} rotation={[f.backFlaps, 0, 0]}>
                  <group position={[0, -t * 2, -backFlapD / 2]}>
                    <Panel width={backPanelW} height={backFlapD} />
                  </group>
                </group>

                {/* TONGUE — hinge at far edge X=+backPanelW/2, folds to close lid */}
                <group position={[backPanelW / 2, 0, 0]} rotation={[0, 0, f.tongue]}>
                  <group position={[0, -t * 2, 0]}>
                    <ShapePanel shape={shapes.tongue} rotation={[-HP, 0, 0]} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* ══ SUPPORT INSERT ══ */}
      {showSupport && suppShapes && (
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
      )}

    </group>
  );
}
