/**
 * DieCutBox — Mailer box with pivot-based fold animation.
 * Ported from diecut.html (vanilla Three.js) to React Three Fiber.
 *
 * Architecture: nested <group> hierarchy where each group's position
 * is the fold pivot and rotation animates the fold.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HP = Math.PI / 2;
const CARD_COLOR = '#dfb48c';
const EDGE_COLOR = '#b48255';

/* ── smoothstep easing for fold stages ── */
function getStage(p, start, end) {
  if (p <= start) return 0;
  if (p >= end) return 1;
  const t = (p - start) / (end - start);
  return t * t * (3 - 2 * t);
}

/* ── Single panel: shape mesh + edge lines ── */
function Panel({ shape }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(shape), [shape]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);

  return (
    <mesh rotation={[-HP, 0, 0]} castShadow receiveShadow>
      <primitive object={geo} attach="geometry" />
      <meshStandardMaterial color={CARD_COLOR} side={THREE.DoubleSide} roughness={0.9} />
      <lineSegments>
        <primitive object={edges} attach="geometry" />
        <lineBasicMaterial color={EDGE_COLOR} transparent opacity={0.5} />
      </lineSegments>
    </mesh>
  );
}

/* ── Main component ── */
export default function DieCutBox({ width, height, depth, foldProgress = 0 }) {
  const group = useRef();

  // Convert cm props → scene units (same scale as diecut.html)
  const W = (width || 50) / 10;
  const H = (height || 30) / 10;
  const D = (depth || 8) / 10;

  // Slow auto-rotate
  useFrame((_s, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.08;
  });

  // Build all shapes (memoized on dimensions)
  const shapes = useMemo(() => {
    const chamfer = 0.15;
    const tabW = D * 0.48;
    const tabH = H * 0.96;
    const tw = W * 0.96;
    const th = H * 0.6;
    const ew = H * 0.85;
    const eStart = D * 0.1;
    const eEnd = D * 0.9;

    // Base
    const base = new THREE.Shape();
    base.moveTo(-W / 2, -D / 2);
    base.lineTo(W / 2, -D / 2);
    base.lineTo(W / 2, D / 2);
    base.lineTo(-W / 2, D / 2);

    // Back wall
    const back = new THREE.Shape();
    back.moveTo(-W / 2, 0);
    back.lineTo(W / 2, 0);
    back.lineTo(W / 2, H);
    back.lineTo(-W / 2, H);

    // Front wall
    const front = new THREE.Shape();
    front.moveTo(-W / 2, 0);
    front.lineTo(W / 2, 0);
    front.lineTo(W / 2, -H);
    front.lineTo(-W / 2, -H);

    // Left wall
    const left = new THREE.Shape();
    left.moveTo(0, -D / 2);
    left.lineTo(-H, -D / 2);
    left.lineTo(-H, D / 2);
    left.lineTo(0, D / 2);

    // Right wall
    const right = new THREE.Shape();
    right.moveTo(0, -D / 2);
    right.lineTo(H, -D / 2);
    right.lineTo(H, D / 2);
    right.lineTo(0, D / 2);

    // Left-front tab
    const lft = new THREE.Shape();
    lft.moveTo(0, 0);
    lft.lineTo(-tabH, 0);
    lft.lineTo(-tabH, -tabW + chamfer);
    lft.lineTo(-tabH + chamfer, -tabW);
    lft.lineTo(0, -tabW);

    // Left-back tab
    const lbt = new THREE.Shape();
    lbt.moveTo(0, 0);
    lbt.lineTo(-tabH, 0);
    lbt.lineTo(-tabH, tabW - chamfer);
    lbt.lineTo(-tabH + chamfer, tabW);
    lbt.lineTo(0, tabW);

    // Right-front tab
    const rft = new THREE.Shape();
    rft.moveTo(0, 0);
    rft.lineTo(tabH, 0);
    rft.lineTo(tabH, -tabW + chamfer);
    rft.lineTo(tabH - chamfer, -tabW);
    rft.lineTo(0, -tabW);

    // Right-back tab
    const rbt = new THREE.Shape();
    rbt.moveTo(0, 0);
    rbt.lineTo(tabH, 0);
    rbt.lineTo(tabH, tabW - chamfer);
    rbt.lineTo(tabH - chamfer, tabW);
    rbt.lineTo(0, tabW);

    // Lid
    const lid = new THREE.Shape();
    lid.moveTo(-W / 2, 0);
    lid.lineTo(W / 2, 0);
    lid.lineTo(W / 2, D);
    lid.lineTo(-W / 2, D);

    // Tuck flap
    const tuck = new THREE.Shape();
    tuck.moveTo(-tw / 2, 0);
    tuck.lineTo(tw / 2, 0);
    tuck.lineTo(tw / 2 - 0.1, th - 0.1);
    tuck.quadraticCurveTo(tw / 2 - 0.15, th, tw / 2 - 0.3, th);
    tuck.lineTo(-tw / 2 + 0.3, th);
    tuck.quadraticCurveTo(-tw / 2 + 0.15, th, -tw / 2 + 0.1, th - 0.1);

    // Left ear
    const earL = new THREE.Shape();
    earL.moveTo(0, eStart);
    earL.lineTo(-ew + 0.1, eStart);
    earL.quadraticCurveTo(-ew, eStart + 0.1, -ew, eStart + 0.3);
    earL.lineTo(-ew, eEnd - 0.3);
    earL.quadraticCurveTo(-ew + 0.1, eEnd, -ew + 0.3, eEnd);
    earL.lineTo(0, eEnd);

    // Right ear
    const earR = new THREE.Shape();
    earR.moveTo(0, eStart);
    earR.lineTo(ew - 0.1, eStart);
    earR.quadraticCurveTo(ew, eStart + 0.1, ew, eStart + 0.3);
    earR.lineTo(ew, eEnd - 0.3);
    earR.quadraticCurveTo(ew - 0.1, eEnd, ew - 0.3, eEnd);
    earR.lineTo(0, eEnd);

    return { base, back, front, left, right, lft, lbt, rft, rbt, lid, tuck, earL, earR };
  }, [W, H, D]);

  // Fold angles
  const p = foldProgress;
  const lift     = getStage(p, 0, 0.10) * 0.05;
  const sideFold = getStage(p, 0.05, 0.20) * HP;
  const tabFold  = getStage(p, 0.20, 0.35) * HP;
  const fbFold   = getStage(p, 0.35, 0.50) * HP;
  const earFold  = getStage(p, 0.50, 0.65) * (Math.PI / 1.95);
  const lidFold  = getStage(p, 0.65, 0.85) * (HP * 0.99);
  const tuckFold = getStage(p, 0.85, 1.00) * (HP * 0.98);

  return (
    <group ref={group} position={[0, lift, 0]}>
      {/* Base */}
      <Panel shape={shapes.base} />

      {/* Back wall → Lid → Tuck + Ears */}
      <group position={[0, 0, -D / 2]} rotation={[fbFold, 0, 0]}>
        <Panel shape={shapes.back} />
        <group position={[0, 0, -H]} rotation={[lidFold, 0, 0]}>
          <Panel shape={shapes.lid} />
          <group position={[0, 0, -D]} rotation={[tuckFold, 0, 0]}>
            <Panel shape={shapes.tuck} />
          </group>
          <group position={[-W / 2 + 0.03, 0, 0]} rotation={[0, 0, -earFold]}>
            <Panel shape={shapes.earL} />
          </group>
          <group position={[W / 2 - 0.03, 0, 0]} rotation={[0, 0, earFold]}>
            <Panel shape={shapes.earR} />
          </group>
        </group>
      </group>

      {/* Front wall */}
      <group position={[0, 0, D / 2]} rotation={[-fbFold, 0, 0]}>
        <Panel shape={shapes.front} />
      </group>

      {/* Left wall + tabs */}
      <group position={[-W / 2, 0, 0]} rotation={[0, 0, -sideFold]}>
        <Panel shape={shapes.left} />
        <group position={[0, 0, D / 2 - 0.01]} rotation={[-tabFold, 0, 0]}>
          <Panel shape={shapes.lft} />
        </group>
        <group position={[0, 0, -D / 2 + 0.01]} rotation={[tabFold, 0, 0]}>
          <Panel shape={shapes.lbt} />
        </group>
      </group>

      {/* Right wall + tabs */}
      <group position={[W / 2, 0, 0]} rotation={[0, 0, sideFold]}>
        <Panel shape={shapes.right} />
        <group position={[0, 0, D / 2 - 0.01]} rotation={[-tabFold, 0, 0]}>
          <Panel shape={shapes.rft} />
        </group>
        <group position={[0, 0, -D / 2 + 0.01]} rotation={[tabFold, 0, 0]}>
          <Panel shape={shapes.rbt} />
        </group>
      </group>
    </group>
  );
}
