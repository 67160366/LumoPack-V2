/**
 * TubeLockFoldBox — 3D foldable tuck-end / tube-lock box
 *
 * Flat layout (XZ plane, Y=up):
 *   side2(D) | face1(W) | side1(D) | face2(W) + glue on side2
 *
 * Fold hierarchy via nested <group> rotations:
 *   face1 (base)
 *     → side1 (hinge right) → face2
 *     → side2 (hinge left, folds opposite)
 *     → dust flaps on sides, tuck panels on face2
 *
 * Reference DXF: 500×150×120 mm (L×W×D)
 *   W=150 (face width), L=500 (length/height), D=120 (depth)
 */

import { useMemo } from 'react';
import Panel from './Panel';

const HP = Math.PI / 2;
const SC = 0.01; // mm → three.js units
const THICKNESS = 0.005;

function ease(p, s, e) {
  if (p <= s) return 0;
  if (p >= e) return 1;
  const t = (p - s) / (e - s);
  return t * t * (3 - 2 * t);
}

export default function TubeLockFoldBox({ width = 150, length = 500, depth = 120, foldProgress = 0, panelImages = {} }) {
  const W = width * SC;   // face width
  const L = length * SC;  // body length (height of box)
  const D = depth * SC;   // depth
  const dustH = (depth * 0.6) * SC;  // dust flap height (~72mm for ref)
  const tuckH = (depth - 3) * SC;    // tuck panel height (~117mm for ref)
  const tongueH = 25 * SC;           // tongue tip
  const p = foldProgress;

  const f = useMemo(() => ({
    side1:     ease(p, 0.00, 0.25) * HP,   // right side folds up
    side2:     ease(p, 0.05, 0.30) * HP,   // left side folds up
    face2:     ease(p, 0.20, 0.45) * HP,   // back face folds over
    dustBot:   ease(p, 0.40, 0.58) * HP,   // bottom dust flaps fold in
    tuckBot:   ease(p, 0.52, 0.70) * HP,   // bottom tuck panel folds down
    tongueBot: ease(p, 0.62, 0.78) * HP,   // bottom tongue tucks in
    dustTop:   ease(p, 0.65, 0.80) * HP,   // top dust flaps fold in
    tuckTop:   ease(p, 0.75, 0.90) * HP,   // top tuck panel folds down
    tongueTop: ease(p, 0.82, 0.95) * HP,   // top tongue tucks in
  }), [p]);

  const img = (id) => ({
    outerUrl: panelImages[id]?.outer || null,
    innerUrl: panelImages[id]?.inner || null,
  });

  const t = THICKNESS;

  return (
    <group rotation={[HP, 0, 0]} position={[0, L / 2, 0]}>
      {/* ── face1 (base, centered at origin) ── */}
      <Panel width={W} height={L} thickness={t} {...img('face1')} />

      {/* ── side1 — hinge at face1 right edge (+W/2) ── */}
      <group position={[W / 2, 0, 0]} rotation={[0, 0, f.side1]}>
        <group position={[D / 2, 0, 0]}>
          <Panel width={D} height={L} thickness={t} {...img('side1')} />

          {/* side1 bottom dust flap */}
          <group position={[0, 0, L / 2]} rotation={[-f.dustBot, 0, 0]}>
            <group position={[0, 0, dustH / 2]}>
              <Panel width={D * 0.9} height={dustH} thickness={t} {...img('side1_dust_bot')} />
            </group>
          </group>

          {/* side1 top dust flap */}
          <group position={[0, 0, -L / 2]} rotation={[f.dustTop, 0, 0]}>
            <group position={[0, 0, -dustH / 2]}>
              <Panel width={D * 0.9} height={dustH} thickness={t} {...img('side1_dust_top')} />
            </group>
          </group>
        </group>

        {/* ── face2 — hinge at side1 far edge (+D) ── */}
        <group position={[D, 0, 0]} rotation={[0, 0, f.face2]}>
          <group position={[W / 2, 0, 0]}>
            <Panel width={W} height={L} thickness={t} {...img('face2')} />

            {/* face2 bottom tuck panel */}
            <group position={[0, 0, L / 2]} rotation={[-f.tuckBot, 0, 0]}>
              <group position={[0, -t, tuckH / 2]}>
                <Panel width={W} height={tuckH} thickness={t} {...img('face2_tuck_bot')} />
              </group>
              {/* tongue */}
              <group position={[0, 0, tuckH]} rotation={[-f.tongueBot, 0, 0]}>
                <group position={[0, 0, tongueH / 2]}>
                  <Panel width={W * 0.9} height={tongueH} thickness={t} color="#b89970" />
                </group>
              </group>
            </group>

            {/* face2 top tuck panel */}
            <group position={[0, 0, -L / 2]} rotation={[f.tuckTop, 0, 0]}>
              <group position={[0, -t, -tuckH / 2]}>
                <Panel width={W} height={tuckH} thickness={t} {...img('face2_tuck_top')} />
              </group>
              {/* tongue */}
              <group position={[0, 0, -tuckH]} rotation={[f.tongueTop, 0, 0]}>
                <group position={[0, 0, -tongueH / 2]}>
                  <Panel width={W * 0.9} height={tongueH} thickness={t} color="#b89970" />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* ── side2 — hinge at face1 left edge (-W/2), folds opposite ── */}
      <group position={[-W / 2, 0, 0]} rotation={[0, 0, -f.side2]}>
        <group position={[-D / 2, 0, 0]}>
          <Panel width={D} height={L} thickness={t} {...img('side2')} />

          {/* side2 bottom dust flap */}
          <group position={[0, 0, L / 2]} rotation={[-f.dustBot, 0, 0]}>
            <group position={[0, 0, dustH / 2]}>
              <Panel width={D * 0.9} height={dustH} thickness={t} {...img('side2_dust_bot')} />
            </group>
          </group>

          {/* side2 top dust flap */}
          <group position={[0, 0, -L / 2]} rotation={[f.dustTop, 0, 0]}>
            <group position={[0, 0, -dustH / 2]}>
              <Panel width={D * 0.9} height={dustH} thickness={t} {...img('side2_dust_top')} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
