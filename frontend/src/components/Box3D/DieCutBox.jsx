/**
 * DieCutBox — Phase 1: Flat Dieline Layout
 *
 * กล่อง Die-cut (Tuck Top, Snap Lock Bottom) สร้างจาก Three.js geometry ล้วนๆ
 * ไม่ใช้ไฟล์ .glb — ทุกค่าคำนวณจาก w, h, d (ห้าม hardcode)
 *
 * 8 Panels:
 *   1. Front Panel        (PlaneGeometry)
 *   2. Back Panel          (PlaneGeometry)
 *   3. Left Side Flap      (ShapeGeometry — step cuts + slots)
 *   4. Right Side Flap     (ShapeGeometry — mirror of left)
 *   5. Top Inner Flap      (PlaneGeometry)
 *   6. Top Flap / Tongue   (ShapeGeometry — rounded top)
 *   7. Bottom Inner Flap   (PlaneGeometry)
 *   8. Bottom Flap          (ShapeGeometry — snap lock + tab)
 *
 * pivot point ของทุก flap อยู่ที่ขอบที่ติดกัน (เพื่อ Phase 2 folding)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Shape, Path, DoubleSide } from 'three';
import useCorrugatedTexture from './useCorrugatedTexture';

export default function DieCutBox({ width, height, depth }) {
  const group = useRef();
  const map = useCorrugatedTexture();
  useFrame((_state, delta) => (group.current.rotation.y += delta * 0.1));

  // cm → scene units (/10)
  const w = width / 10;
  const h = height / 10;
  const d = depth / 10;
  const t = 0.015; // ความหนากระดาษ

  // Derived dimensions (ทุกค่าจาก w, h, d เท่านั้น)
  const topFlapH = d * 0.95;
  const topInnerH = d * 0.85;
  const bottomFlapH = d * 0.95;
  const bottomInnerH = d * 0.85;

  // Guards — ป้องกัน slot/tongue เล็กเกินเมื่อ depth น้อยมาก
  const slotH = Math.max(d * 0.35, t * 3);
  const slotW = Math.max(t * 1.5, 0.02);

  const matProps = { map, roughness: 0.85, side: DoubleSide };

  // ─── ShapeGeometry: Side Flap (step cuts + 2 slots) ───
  const sideFlapShape = useMemo(() => {
    const s = new Shape();
    const step = t * 2;

    // Outline with step cuts at all 4 corners (clockwise from bottom-left)
    s.moveTo(step, 0);
    s.lineTo(d - step, 0);
    s.lineTo(d - step, step);
    s.lineTo(d, step);
    s.lineTo(d, h - step);
    s.lineTo(d - step, h - step);
    s.lineTo(d - step, h);
    s.lineTo(step, h);
    s.lineTo(step, h - step);
    s.lineTo(0, h - step);
    s.lineTo(0, step);
    s.lineTo(step, step);
    s.closePath();

    // Slot 1 — ตำแหน่ง x = d*0.25, ห่างจากขอบบน h*0.15
    const slot1X = d * 0.25;
    const slotTopY = h * 0.5 - h * 0.15;
    const hole1 = new Path();
    hole1.moveTo(slot1X, slotTopY);
    hole1.lineTo(slot1X + slotW, slotTopY);
    hole1.lineTo(slot1X + slotW, slotTopY - slotH);
    hole1.lineTo(slot1X, slotTopY - slotH);
    hole1.closePath();
    s.holes.push(hole1);

    // Slot 2 — ตำแหน่ง x = d*0.65
    const slot2X = d * 0.65;
    const hole2 = new Path();
    hole2.moveTo(slot2X, slotTopY);
    hole2.lineTo(slot2X + slotW, slotTopY);
    hole2.lineTo(slot2X + slotW, slotTopY - slotH);
    hole2.lineTo(slot2X, slotTopY - slotH);
    hole2.closePath();
    s.holes.push(hole2);

    return s;
  }, [d, h, t, slotW, slotH]);

  // ─── ShapeGeometry: Top Flap — Tongue (rounded top) ───
  const tongueShape = useMemo(() => {
    const s = new Shape();
    const fw = w;
    const fh = d * 0.95;
    const curve = d * 0.15;
    const tipOut = d * 0.05;

    s.moveTo(0, 0);
    s.lineTo(fw, 0);
    s.lineTo(fw, fh - curve);
    s.quadraticCurveTo(fw, fh, fw - curve, fh + tipOut);               // มุมขวาโค้ง
    s.lineTo(fw * 0.5 + fw * 0.1, fh + tipOut * 1.5);                  // ไปกลางขวา
    s.quadraticCurveTo(fw * 0.5, fh + tipOut * 2, fw * 0.5 - fw * 0.1, fh + tipOut * 1.5); // โค้งกลาง
    s.lineTo(curve, fh + tipOut);                                        // ไปมุมซ้าย
    s.quadraticCurveTo(0, fh, 0, fh - curve);                           // มุมซ้ายโค้ง
    s.closePath();

    return s;
  }, [w, d]);

  // ─── ShapeGeometry: Bottom Flap — Snap Lock (chamfer + tab) ───
  const bottomFlapShape = useMemo(() => {
    const s = new Shape();
    const fw = w;
    const fh = d * 0.95;
    const chamfer = d * 0.1;
    const tabW = w * 0.3;
    const tabH = d * 0.08;

    // Start from top-left, clockwise
    s.moveTo(0, fh);
    s.lineTo(fw, fh);
    s.lineTo(fw, chamfer);
    s.lineTo(fw - chamfer, 0);

    // Bottom edge with center tab
    s.lineTo(fw / 2 + tabW / 2, 0);
    s.lineTo(fw / 2 + tabW / 2, -tabH);
    s.lineTo(fw / 2 - tabW / 2, -tabH);
    s.lineTo(fw / 2 - tabW / 2, 0);

    s.lineTo(chamfer, 0);
    s.lineTo(0, chamfer);
    s.closePath();

    return s;
  }, [w, d]);

  return (
    <group ref={group} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>

      {/* ═══════════════════════════════════════════════
       *  1. FRONT PANEL (center, reference)
       * ═══════════════════════════════════════════════ */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* ═══════════════════════════════════════════════
       *  TOP SECTION — pivot ที่ขอบบนของ Front
       * ═══════════════════════════════════════════════ */}
      <group position={[0, h / 2, 0]}>

        {/* 5. TOP INNER FLAP */}
        <mesh position={[0, topInnerH / 2, 0]}>
          <planeGeometry args={[w, topInnerH]} />
          <meshStandardMaterial {...matProps} />
        </mesh>

        {/* pivot ที่ขอบบนของ Top Inner */}
        <group position={[0, topInnerH, 0]}>

          {/* 2. BACK PANEL */}
          <mesh position={[0, h / 2, 0]}>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial {...matProps} />
          </mesh>

          {/* pivot ที่ขอบบนของ Back */}
          <group position={[0, h, 0]}>

            {/* 6. TOP FLAP — TONGUE (ShapeGeometry) */}
            <mesh position={[-w / 2, 0, 0]}>
              <shapeGeometry args={[tongueShape]} />
              <meshStandardMaterial {...matProps} />
            </mesh>

          </group>
        </group>
      </group>

      {/* ═══════════════════════════════════════════════
       *  BOTTOM SECTION — pivot ที่ขอบล่างของ Front
       * ═══════════════════════════════════════════════ */}
      <group position={[0, -h / 2, 0]}>

        {/* 7. BOTTOM INNER FLAP */}
        <mesh position={[0, -bottomInnerH / 2, 0]}>
          <planeGeometry args={[w, bottomInnerH]} />
          <meshStandardMaterial {...matProps} />
        </mesh>

        {/* pivot ที่ขอบล่างของ Bottom Inner */}
        <group position={[0, -bottomInnerH, 0]}>

          {/* 8. BOTTOM FLAP — SNAP LOCK (ShapeGeometry) */}
          <mesh position={[-w / 2, -bottomFlapH, 0]}>
            <shapeGeometry args={[bottomFlapShape]} />
            <meshStandardMaterial {...matProps} />
          </mesh>

        </group>
      </group>

      {/* ═══════════════════════════════════════════════
       *  LEFT SIDE — pivot ที่ขอบซ้ายของ Front
       * ═══════════════════════════════════════════════ */}
      <group position={[-w / 2, 0, 0]}>

        {/* 3. LEFT SIDE FLAP (ShapeGeometry — step cuts + slots) */}
        <mesh position={[-d, -h / 2, 0]}>
          <shapeGeometry args={[sideFlapShape]} />
          <meshStandardMaterial {...matProps} />
        </mesh>

      </group>

      {/* ═══════════════════════════════════════════════
       *  RIGHT SIDE — pivot ที่ขอบขวาของ Front
       * ═══════════════════════════════════════════════ */}
      <group position={[w / 2, 0, 0]}>

        {/* 4. RIGHT SIDE FLAP (mirror of left) */}
        <mesh position={[d, -h / 2, 0]} scale={[-1, 1, 1]}>
          <shapeGeometry args={[sideFlapShape]} />
          <meshStandardMaterial {...matProps} />
        </mesh>

      </group>

    </group>
  );
}
