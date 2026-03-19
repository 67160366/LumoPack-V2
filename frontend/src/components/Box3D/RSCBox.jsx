/**
 * RSCBox — Regular Slotted Container with fold animation.
 *
 * Dieline flat layout:
 *   [Front W×H] [Right D×H] [Back W×H] [Left D×H]
 *   + top/bottom flaps from each panel
 *
 * Fold sequence:
 * 1. Wrap walls: right → back → left (sequential, forming tube)
 * 2. Bottom flaps: side (short) first, then front/back (long)
 * 3. Top flaps: side (short) first, then front/back (long)
 */

import { useMemo } from 'react';
import * as THREE from 'three';

const HP = Math.PI / 2;
const CARD_COLOR = '#dfb48c';
const EDGE_COLOR = '#b48255';

function getStage(p, start, end) {
  if (p <= start) return 0;
  if (p >= end) return 1;
  const t = (p - start) / (end - start);
  return t * t * (3 - 2 * t);
}

/* Wall panel — stays in XY plane (vertical) */
function WallPanel({ shape }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(shape), [shape]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  return (
    <mesh castShadow receiveShadow>
      <primitive object={geo} attach="geometry" />
      <meshStandardMaterial color={CARD_COLOR} side={THREE.DoubleSide} roughness={0.9} />
      <lineSegments>
        <primitive object={edges} attach="geometry" />
        <lineBasicMaterial color={EDGE_COLOR} transparent opacity={0.5} />
      </lineSegments>
    </mesh>
  );
}

export default function RSCBox({ width, height, depth, foldProgress = 0 }) {
  const W = (width || 50) / 10;
  const H = (height || 30) / 10;
  const D = (depth || 8) / 10;
  const flapH = D / 2;

  const p = foldProgress;

  // Phase 1: Wrap walls (sequential)
  const rightFold = getStage(p, 0.00, 0.12) * HP;
  const backFold  = getStage(p, 0.08, 0.20) * HP;
  const leftFold  = getStage(p, 0.16, 0.28) * HP;

  // Phase 2: Bottom flaps
  const botSideFold = getStage(p, 0.30, 0.42) * HP;  // side (short D) first
  const botMainFold = getStage(p, 0.40, 0.52) * HP;  // front/back (long W) second

  // Phase 3: Top flaps
  const topSideFold = getStage(p, 0.58, 0.70) * HP;
  const topMainFold = getStage(p, 0.72, 0.88) * HP;

  // Build shapes
  const shapes = useMemo(() => {
    // Wall panels (in XY plane, vertical)
    const front = new THREE.Shape();
    front.moveTo(-W / 2, 0); front.lineTo(W / 2, 0);
    front.lineTo(W / 2, H); front.lineTo(-W / 2, H);

    const rightSide = new THREE.Shape();
    rightSide.moveTo(0, 0); rightSide.lineTo(D, 0);
    rightSide.lineTo(D, H); rightSide.lineTo(0, H);

    const back = new THREE.Shape();
    back.moveTo(0, 0); back.lineTo(W, 0);
    back.lineTo(W, H); back.lineTo(0, H);

    const leftSide = new THREE.Shape();
    leftSide.moveTo(0, 0); leftSide.lineTo(D, 0);
    leftSide.lineTo(D, H); leftSide.lineTo(0, H);

    // Bottom flaps (extend below y=0 from each panel)
    const frontBotFlap = new THREE.Shape();
    frontBotFlap.moveTo(-W / 2, 0); frontBotFlap.lineTo(W / 2, 0);
    frontBotFlap.lineTo(W / 2, -flapH); frontBotFlap.lineTo(-W / 2, -flapH);

    const rightBotFlap = new THREE.Shape();
    rightBotFlap.moveTo(0, 0); rightBotFlap.lineTo(D, 0);
    rightBotFlap.lineTo(D, -flapH); rightBotFlap.lineTo(0, -flapH);

    const backBotFlap = new THREE.Shape();
    backBotFlap.moveTo(0, 0); backBotFlap.lineTo(W, 0);
    backBotFlap.lineTo(W, -flapH); backBotFlap.lineTo(0, -flapH);

    const leftBotFlap = new THREE.Shape();
    leftBotFlap.moveTo(0, 0); leftBotFlap.lineTo(D, 0);
    leftBotFlap.lineTo(D, -flapH); leftBotFlap.lineTo(0, -flapH);

    // Top flaps (extend above y=0, pivot at top of wall)
    const frontTopFlap = new THREE.Shape();
    frontTopFlap.moveTo(-W / 2, 0); frontTopFlap.lineTo(W / 2, 0);
    frontTopFlap.lineTo(W / 2, flapH); frontTopFlap.lineTo(-W / 2, flapH);

    const rightTopFlap = new THREE.Shape();
    rightTopFlap.moveTo(0, 0); rightTopFlap.lineTo(D, 0);
    rightTopFlap.lineTo(D, flapH); rightTopFlap.lineTo(0, flapH);

    const backTopFlap = new THREE.Shape();
    backTopFlap.moveTo(0, 0); backTopFlap.lineTo(W, 0);
    backTopFlap.lineTo(W, flapH); backTopFlap.lineTo(0, flapH);

    const leftTopFlap = new THREE.Shape();
    leftTopFlap.moveTo(0, 0); leftTopFlap.lineTo(D, 0);
    leftTopFlap.lineTo(D, flapH); leftTopFlap.lineTo(0, flapH);

    return {
      front, rightSide, back, leftSide,
      frontBotFlap, rightBotFlap, backBotFlap, leftBotFlap,
      frontTopFlap, rightTopFlap, backTopFlap, leftTopFlap,
    };
  }, [W, H, D, flapH]);

  return (
    <group>
      {/* Front wall (anchor, stationary at z=D/2) */}
      <group position={[0, 0, D / 2]}>
        <WallPanel shape={shapes.front} />
        {/* Front bottom flap */}
        <group position={[0, 0, 0.02]} rotation={[botMainFold, 0, 0]}>
          <WallPanel shape={shapes.frontBotFlap} />
        </group>
        {/* Front top flap */}
        <group position={[0, H, 0.02]} rotation={[topMainFold, 0, 0]}>
          <WallPanel shape={shapes.frontTopFlap} />
        </group>
      </group>

      {/* Right side (wraps from right edge of front, rotates +Y) */}
      <group position={[W / 2, 0, D / 2]} rotation={[0, rightFold, 0]}>
        <WallPanel shape={shapes.rightSide} />
        {/* Right bottom flap */}
        <group position={[0, 0, 0.02]} rotation={[botSideFold, 0, 0]}>
          <WallPanel shape={shapes.rightBotFlap} />
        </group>
        {/* Right top flap */}
        <group position={[0, H, 0.02]} rotation={[topSideFold, 0, 0]}>
          <WallPanel shape={shapes.rightTopFlap} />
        </group>

        {/* Back (wraps from far edge of right side) */}
        <group position={[D, 0, 0]} rotation={[0, backFold, 0]}>
          <WallPanel shape={shapes.back} />
          {/* Back bottom flap */}
          <group position={[0, 0, 0.02]} rotation={[botMainFold, 0, 0]}>
            <WallPanel shape={shapes.backBotFlap} />
          </group>
          {/* Back top flap */}
          <group position={[0, H, 0.02]} rotation={[topMainFold, 0, 0]}>
            <WallPanel shape={shapes.backTopFlap} />
          </group>

          {/* Left side (wraps from far edge of back, closes tube) */}
          <group position={[W, 0, 0]} rotation={[0, leftFold, 0]}>
            <WallPanel shape={shapes.leftSide} />
            {/* Left bottom flap */}
            <group position={[0, 0, 0.02]} rotation={[botSideFold, 0, 0]}>
              <WallPanel shape={shapes.leftBotFlap} />
            </group>
            {/* Left top flap */}
            <group position={[0, H, 0.02]} rotation={[topSideFold, 0, 0]}>
              <WallPanel shape={shapes.leftTopFlap} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
