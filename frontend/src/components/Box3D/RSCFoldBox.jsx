/**
 * RSCFoldBox — 3D foldable RSC box with optional image textures
 *
 * Flat layout (XZ plane, Y=up):
 *   face1(W) | side1(D) | face2(W) | side2(D)
 *
 * Fold hierarchy via nested <group> rotations.
 *
 * Texture mapping:
 *   panelImages = { face1: { outer: url, inner: url }, side1: {...}, ... }
 */

import { useMemo } from 'react';
import Panel from './Panel';
import { getScheme } from './cardboardColors';

const HP = Math.PI / 2;
const SC = 0.01; // mm → three.js units

function ease(p, s, e) {
  if (p <= s) return 0;
  if (p >= e) return 1;
  const t = (p - s) / (e - s);
  return t * t * (3 - 2 * t);
}

const thickness = 0.005;

export default function RSCFoldBox({ width = 400, height = 300, depth = 300, foldProgress = 0, panelImages = {}, boxStyle = 'kraft' }) {
  const W = width * SC;
  const H = height * SC;
  const D = depth * SC;
  const flapH = (depth / 2) * SC;
  const p = foldProgress;
  const scheme = useMemo(() => getScheme(boxStyle), [boxStyle]);
  const cMain = scheme.base;
  const cFlap = scheme.wall;

  // Helper to get URLs for a panel
  const img = (id) => ({
    outerUrl: panelImages[id]?.outer || null,
    innerUrl: panelImages[id]?.inner || null,
  });

  const f = useMemo(() => ({
    side1:   ease(p, 0.00, 0.25) * HP,
    face2:   ease(p, 0.15, 0.40) * HP,
    side2:   ease(p, 0.30, 0.55) * HP,
    botSide: ease(p, 0.50, 0.68) * HP,
    botFace: ease(p, 0.58, 0.75) * HP,
    topSide: ease(p, 0.65, 0.82) * HP,
    topFace: ease(p, 0.75, 0.92) * HP,
  }), [p]);

  // Face flaps (1) fold LAST → sit on top of side flaps (2)
  // Offset face flaps by -thickness in local Y so they overlap outward
  const t = thickness;

  return (
    <group rotation={[HP, 0, 0]} position={[0, H / 2, 0]}>
      {/* ── face1 (base, centered at origin) ── */}
      <group>
        <Panel width={W} height={H} color={cMain} {...img('face1')} />

        {/* face1 bottom flap (1) — folds last, on top */}
        <group position={[0, 0, H / 2]} rotation={[-f.botFace, 0, 0]}>
          <group position={[0, -t, flapH / 2]}>
            <Panel width={W} height={flapH} color={cFlap} {...img('face1_bot')} />
          </group>
        </group>

        {/* face1 top flap (1) — folds last, on top */}
        <group position={[0, 0, -H / 2]} rotation={[f.topFace, 0, 0]}>
          <group position={[0, -t, -flapH / 2]}>
            <Panel width={W} height={flapH} color={cFlap} {...img('face1_top')} />
          </group>
        </group>

        {/* ── side1 — hinge at face1 right edge (x = +W/2) ── */}
        <group position={[W / 2, 0, 0]} rotation={[0, 0, f.side1]}>
          <group position={[D / 2, 0, 0]}>
            <Panel width={D} height={H} color={cMain} {...img('side1')} />

            {/* side1 bottom flap (2) — folds first, underneath */}
            <group position={[0, 0, H / 2]} rotation={[-f.botSide, 0, 0]}>
              <group position={[0, 0, flapH / 2]}>
                <Panel width={D} height={flapH} color={cFlap} {...img('side1_bot')} />
              </group>
            </group>

            {/* side1 top flap (2) — folds first, underneath */}
            <group position={[0, 0, -H / 2]} rotation={[f.topSide, 0, 0]}>
              <group position={[0, 0, -flapH / 2]}>
                <Panel width={D} height={flapH} color={cFlap} {...img('side1_top')} />
              </group>
            </group>
          </group>

          {/* ── face2 — hinge at side1 far edge ── */}
          <group position={[D, 0, 0]} rotation={[0, 0, f.face2]}>
            <group position={[W / 2, 0, 0]}>
              <Panel width={W} height={H} color={cMain} {...img('face2')} />

              {/* face2 bottom flap (1) — folds last, on top */}
              <group position={[0, 0, H / 2]} rotation={[-f.botFace, 0, 0]}>
                <group position={[0, -t, flapH / 2]}>
                  <Panel width={W} height={flapH} color={cFlap} {...img('face2_bot')} />
                </group>
              </group>

              {/* face2 top flap (1) — folds last, on top */}
              <group position={[0, 0, -H / 2]} rotation={[f.topFace, 0, 0]}>
                <group position={[0, -t, -flapH / 2]}>
                  <Panel width={W} height={flapH} color={cFlap} {...img('face2_top')} />
                </group>
              </group>
            </group>

            {/* ── side2 — hinge at face2 far edge ── */}
            <group position={[W, 0, 0]} rotation={[0, 0, f.side2]}>
              <group position={[D / 2, 0, 0]}>
                <Panel width={D} height={H} color={cMain} {...img('side2')} />

                {/* side2 bottom flap (2) — folds first, underneath */}
                <group position={[0, 0, H / 2]} rotation={[-f.botSide, 0, 0]}>
                  <group position={[0, 0, flapH / 2]}>
                    <Panel width={D} height={flapH} color={cFlap} {...img('side2_bot')} />
                  </group>
                </group>

                {/* side2 top flap (2) — folds first, underneath */}
                <group position={[0, 0, -H / 2]} rotation={[f.topSide, 0, 0]}>
                  <group position={[0, 0, -flapH / 2]}>
                    <Panel width={D} height={flapH} color={cFlap} {...img('side2_top')} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
