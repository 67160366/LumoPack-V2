/**
 * BowBox — Rectangular mailer box with fold animation + optional support insert.
 * Ported from BowWSup.html. Similar to DieCutBox but with support structure.
 *
 * Fold sequence (8 steps with support, 7 without):
 * 1. Flat layout → 2. Side walls → 3. Side tabs → 4. Front/Back
 * 5. [Support insert] → 6. Ear flaps → 7. Lid close → 8. Tuck
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { getBowPhases } from '../../engine/animationPhases';

const HP = Math.PI / 2;
const CARD_COLOR = '#dfb48c';
const EDGE_COLOR = '#b48255';

/* ── Panel: shape mesh + edge lines (same as DieCutBox) ── */
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

/* ── Support panel (lighter color) ── */
function SupportPanel({ shape }) {
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

export default function BowBox({
  width,
  height,
  depth,
  foldProgress = 0,
  showSupport = false,
}) {
  const group = useRef();

  const W = (width || 30) / 10;
  const H = (height || 10) / 10;
  const D = (depth || 20) / 10;

  useFrame((_s, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.08;
  });

  // Build all box shapes
  const boxShapes = useMemo(() => {
    const chamfer = 0.15;
    const tabW = D * 0.48;
    const tabH = H * 0.96;
    const tw = W * 0.96;
    const th = H * 0.6;
    const ew = H * 0.85;
    const eStart = D * 0.1;
    const eEnd = D * 0.9;

    const base = new THREE.Shape();
    base.moveTo(-W / 2, -D / 2); base.lineTo(W / 2, -D / 2);
    base.lineTo(W / 2, D / 2); base.lineTo(-W / 2, D / 2);

    const back = new THREE.Shape();
    back.moveTo(-W / 2, 0); back.lineTo(W / 2, 0);
    back.lineTo(W / 2, H); back.lineTo(-W / 2, H);

    const front = new THREE.Shape();
    front.moveTo(-W / 2, 0); front.lineTo(W / 2, 0);
    front.lineTo(W / 2, -H); front.lineTo(-W / 2, -H);

    const left = new THREE.Shape();
    left.moveTo(0, -D / 2); left.lineTo(-H, -D / 2);
    left.lineTo(-H, D / 2); left.lineTo(0, D / 2);

    const right = new THREE.Shape();
    right.moveTo(0, -D / 2); right.lineTo(H, -D / 2);
    right.lineTo(H, D / 2); right.lineTo(0, D / 2);

    const lft = new THREE.Shape();
    lft.moveTo(0, 0); lft.lineTo(-tabH, 0);
    lft.lineTo(-tabH, -tabW + chamfer); lft.lineTo(-tabH + chamfer, -tabW); lft.lineTo(0, -tabW);

    const lbt = new THREE.Shape();
    lbt.moveTo(0, 0); lbt.lineTo(-tabH, 0);
    lbt.lineTo(-tabH, tabW - chamfer); lbt.lineTo(-tabH + chamfer, tabW); lbt.lineTo(0, tabW);

    const rft = new THREE.Shape();
    rft.moveTo(0, 0); rft.lineTo(tabH, 0);
    rft.lineTo(tabH, -tabW + chamfer); rft.lineTo(tabH - chamfer, -tabW); rft.lineTo(0, -tabW);

    const rbt = new THREE.Shape();
    rbt.moveTo(0, 0); rbt.lineTo(tabH, 0);
    rbt.lineTo(tabH, tabW - chamfer); rbt.lineTo(tabH - chamfer, tabW); rbt.lineTo(0, tabW);

    const lid = new THREE.Shape();
    lid.moveTo(-W / 2, 0); lid.lineTo(W / 2, 0);
    lid.lineTo(W / 2, D); lid.lineTo(-W / 2, D);

    const tuck = new THREE.Shape();
    tuck.moveTo(-tw / 2, 0); tuck.lineTo(tw / 2, 0);
    tuck.lineTo(tw / 2 - 0.1, th - 0.1);
    tuck.quadraticCurveTo(tw / 2 - 0.15, th, tw / 2 - 0.3, th);
    tuck.lineTo(-tw / 2 + 0.3, th);
    tuck.quadraticCurveTo(-tw / 2 + 0.15, th, -tw / 2 + 0.1, th - 0.1);

    const earL = new THREE.Shape();
    earL.moveTo(0, eStart); earL.lineTo(-ew + 0.1, eStart);
    earL.quadraticCurveTo(-ew, eStart + 0.1, -ew, eStart + 0.3);
    earL.lineTo(-ew, eEnd - 0.3);
    earL.quadraticCurveTo(-ew + 0.1, eEnd, -ew + 0.3, eEnd);
    earL.lineTo(0, eEnd);

    const earR = new THREE.Shape();
    earR.moveTo(0, eStart); earR.lineTo(ew - 0.1, eStart);
    earR.quadraticCurveTo(ew, eStart + 0.1, ew, eStart + 0.3);
    earR.lineTo(ew, eEnd - 0.3);
    earR.quadraticCurveTo(ew - 0.1, eEnd, ew - 0.3, eEnd);
    earR.lineTo(0, eEnd);

    return { base, back, front, left, right, lft, lbt, rft, rbt, lid, tuck, earL, earR };
  }, [W, H, D]);

  // Build support shapes
  const suppShapes = useMemo(() => {
    const sw = W * 0.96;
    const sd = D * 0.96;
    const sh = H * 0.78;
    const holeRadius = Math.min(sw, sd) * 0.3;

    const top = new THREE.Shape();
    top.moveTo(-sw / 2, -sd / 2); top.lineTo(sw / 2, -sd / 2);
    top.lineTo(sw / 2, sd / 2); top.lineTo(-sw / 2, sd / 2);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, false);
    top.holes.push(holePath);

    const suppFront = new THREE.Shape();
    suppFront.moveTo(-sw / 2, 0); suppFront.lineTo(sw / 2, 0);
    suppFront.lineTo(sw / 2, -sh); suppFront.lineTo(-sw / 2, -sh);

    const suppBack = new THREE.Shape();
    suppBack.moveTo(-sw / 2, 0); suppBack.lineTo(sw / 2, 0);
    suppBack.lineTo(sw / 2, sh); suppBack.lineTo(-sw / 2, sh);

    const suppLeft = new THREE.Shape();
    suppLeft.moveTo(0, -sd / 2); suppLeft.lineTo(-sh, -sd / 2);
    suppLeft.lineTo(-sh, sd / 2); suppLeft.lineTo(0, sd / 2);

    const suppRight = new THREE.Shape();
    suppRight.moveTo(0, -sd / 2); suppRight.lineTo(sh, -sd / 2);
    suppRight.lineTo(sh, sd / 2); suppRight.lineTo(0, sd / 2);

    return { top, suppFront, suppBack, suppLeft, suppRight, sw, sd, sh };
  }, [W, H, D]);

  // Fold angles
  const p = foldProgress;
  const ph = getBowPhases(p, showSupport);
  const sideFold = ph.side * HP;
  const tabFold = ph.tab * HP;
  const fbFold = ph.fb * HP;
  const earFold = ph.ear * (Math.PI / 1.95);
  const lidFold = ph.lid * (HP * 0.99);
  const tuckFold = ph.tuck * (HP * 0.98);

  // Support animation
  const startY = H + 3;
  const endY = suppShapes.sh;
  const suppY = showSupport
    ? startY - ph.suppDrop * (startY - endY)
    : startY;

  return (
    <group ref={group} position={[0, ph.lift, 0]}>
      {/* Base */}
      <Panel shape={boxShapes.base} />

      {/* Back → Lid → Tuck + Ears */}
      <group position={[0, 0, -D / 2]} rotation={[fbFold, 0, 0]}>
        <Panel shape={boxShapes.back} />
        <group position={[0, 0, -H]} rotation={[lidFold, 0, 0]}>
          <Panel shape={boxShapes.lid} />
          <group position={[0, 0, -D]} rotation={[tuckFold, 0, 0]}>
            <Panel shape={boxShapes.tuck} />
          </group>
          <group position={[-W / 2 + 0.03, 0, 0]} rotation={[0, 0, -earFold]}>
            <Panel shape={boxShapes.earL} />
          </group>
          <group position={[W / 2 - 0.03, 0, 0]} rotation={[0, 0, earFold]}>
            <Panel shape={boxShapes.earR} />
          </group>
        </group>
      </group>

      {/* Front */}
      <group position={[0, 0, D / 2]} rotation={[-fbFold, 0, 0]}>
        <Panel shape={boxShapes.front} />
      </group>

      {/* Left wall + tabs */}
      <group position={[-W / 2, 0, 0]} rotation={[0, 0, -sideFold]}>
        <Panel shape={boxShapes.left} />
        <group position={[0, 0, D / 2 - 0.01]} rotation={[-tabFold, 0, 0]}>
          <Panel shape={boxShapes.lft} />
        </group>
        <group position={[0, 0, -D / 2 + 0.01]} rotation={[tabFold, 0, 0]}>
          <Panel shape={boxShapes.lbt} />
        </group>
      </group>

      {/* Right wall + tabs */}
      <group position={[W / 2, 0, 0]} rotation={[0, 0, sideFold]}>
        <Panel shape={boxShapes.right} />
        <group position={[0, 0, D / 2 - 0.01]} rotation={[-tabFold, 0, 0]}>
          <Panel shape={boxShapes.rft} />
        </group>
        <group position={[0, 0, -D / 2 + 0.01]} rotation={[tabFold, 0, 0]}>
          <Panel shape={boxShapes.rbt} />
        </group>
      </group>

      {/* Support structure */}
      {showSupport && (
        <group position={[0, suppY, 0]}>
          {/* Top plate with hole */}
          <SupportPanel shape={suppShapes.top} />
          {/* Front wall */}
          <group position={[0, 0, suppShapes.sd / 2]} rotation={[ph.suppFold * HP, 0, 0]}>
            <SupportPanel shape={suppShapes.suppFront} />
          </group>
          {/* Back wall */}
          <group position={[0, 0, -suppShapes.sd / 2]} rotation={[-ph.suppFold * HP, 0, 0]}>
            <SupportPanel shape={suppShapes.suppBack} />
          </group>
          {/* Left wall */}
          <group position={[-suppShapes.sw / 2, 0, 0]} rotation={[0, 0, ph.suppFold * HP]}>
            <SupportPanel shape={suppShapes.suppLeft} />
          </group>
          {/* Right wall */}
          <group position={[suppShapes.sw / 2, 0, 0]} rotation={[0, 0, -ph.suppFold * HP]}>
            <SupportPanel shape={suppShapes.suppRight} />
          </group>
        </group>
      )}
    </group>
  );
}
