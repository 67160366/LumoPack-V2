/**
 * BoxViewer — 3D Canvas Area (center panel)
 *
 * ระบบ Panel-Based Folding:
 * กล่องทุกแบบสร้างจาก "แผ่น" (panel) แต่ละแผ่นมี
 *   - pivot point = จุดพับ (ขอบที่ติดกับ panel ก่อนหน้า)
 *   - rotation   = มุมพับ (0° = แบน, 90° = พับตั้งฉาก)
 *
 * Mode:
 * - PlainBox:    RSC ปกติ (boxGeometry + corrugated texture)
 * - TexturedBox: มี texture จาก image upload
 * - HeatmapBox:  danger mode (heatmap shader)
 * - PanelBox:    กล่องจากแผ่นพับ (die-cut, tuck-end, ear-lock)
 */

import { useRef, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import { TextureLoader, DoubleSide } from 'three';
import HeatmapBox from './HeatmapBox';
import useCorrugatedTexture from './useCorrugatedTexture';
import DieCutBox from './DieCutBox';

// Box type labels (for fallback badge)
const BOX_TYPE_LABELS = {
  rsc: 'RSC',
  die_cut: 'Die-cut',
  tuck_end: 'ฝาชน',
  ear_lock: 'หูช้าง',
};

/* ============================================================
 * PlainBox  (RSC — simple boxGeometry)
 * ========================================================== */
function PlainBox({ width, height, depth }) {
  const mesh = useRef();
  const corrugatedMap = useCorrugatedTexture();
  useFrame((_state, delta) => (mesh.current.rotation.y += delta * 0.1));
  return (
    <mesh ref={mesh} position={[0, height / 20, 0]}>
      <boxGeometry args={[width / 10, height / 10, depth / 10]} />
      <meshStandardMaterial map={corrugatedMap} roughness={0.85} />
    </mesh>
  );
}

/* ============================================================
 * TexturedBox
 * ========================================================== */
function TexturedBox({ width, height, depth, textureUrl }) {
  const mesh = useRef();
  const texture = useLoader(TextureLoader, textureUrl);
  useFrame((_state, delta) => (mesh.current.rotation.y += delta * 0.1));
  return (
    <mesh ref={mesh} position={[0, height / 20, 0]}>
      <boxGeometry args={[width / 10, height / 10, depth / 10]} />
      <meshStandardMaterial map={texture} roughness={0.5} />
    </mesh>
  );
}

/* ============================================================
 * PanelBox — Panel-based folding box system
 *
 * แต่ละแผ่นพับต่อจาก panel ก่อนหน้าผ่าน pivot (ขอบร่วม)
 * chain หลักวนรอบกล่อง:
 *   FRONT → BOTTOM → BACK → TOP LID → TUCK FLAP
 * แผ่นข้างพับจาก FRONT:
 *   LEFT SIDE (+ ear flaps)
 *   RIGHT SIDE (+ ear flaps)
 * ========================================================== */

/* ============================================================
 * TuckEndPanelBox — กล่องฝาชน (tuck-end)
 *
 * คล้าย die-cut แต่มีฝาเสียบทั้งบนและล่าง
 * chain: FRONT → BOTTOM FLAP(tuck) + FRONT → TOP FLAP(tuck)
 *        LEFT/RIGHT sides เป็นแผ่นเต็ม
 * ========================================================== */

function TuckEndPanelBox({ width, height, depth }) {
  const mesh = useRef();
  const map = useCorrugatedTexture();
  useFrame((_state, delta) => (mesh.current.rotation.y += delta * 0.1));

  const w = width / 10;
  const h = height / 10;
  const d = depth / 10;

  const HP = Math.PI / 2;
  const tuck = Math.min(d * 0.4, h * 0.3);
  const lidOpen = 0.44;

  return (
    <group ref={mesh} position={[0, h / 2, 0]}>

      {/* FRONT */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
      </mesh>

      {/* BACK */}
      <mesh position={[0, 0, -d]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
      </mesh>

      {/* BOTTOM */}
      <mesh position={[0, -h / 2, -d / 2]} rotation={[HP, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
      </mesh>

      {/* LEFT SIDE */}
      <group position={[-w / 2, 0, 0]} rotation={[0, HP, 0]}>
        <mesh position={[d / 2, 0, 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
        </mesh>
      </group>

      {/* RIGHT SIDE */}
      <group position={[w / 2, 0, 0]} rotation={[0, -HP, 0]}>
        <mesh position={[-d / 2, 0, 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
        </mesh>
      </group>

      {/* TOP FLAP — pivot ที่ขอบบนของ front, เปิดเล็กน้อย */}
      <group position={[0, h / 2, 0]} rotation={[-HP + lidOpen, 0, 0]}>
        <mesh position={[0, d / 2, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
        </mesh>
        {/* TUCK — pivot ที่ขอบไกลของ top flap */}
        <group position={[0, d, 0]} rotation={[HP, 0, 0]}>
          <mesh position={[0, tuck / 2, 0]}>
            <planeGeometry args={[w * 0.92, tuck]} />
            <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* BOTTOM TUCK FLAP — pivot ที่ขอบล่างของ front */}
      <group position={[0, -h / 2, 0]} rotation={[HP, 0, 0]}>
        <group position={[0, d, 0]} rotation={[-HP, 0, 0]}>
          <mesh position={[0, -tuck / 2, 0]}>
            <planeGeometry args={[w * 0.92, tuck]} />
            <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ============================================================
 * EarLockPanelBox — กล่องหูช้าง (ear-lock)
 *
 * กล่องที่ก้นล็อกตัวเอง + ฝาเสียบด้านบน
 * มี "หู" (ear tabs) ที่มุมก้นกล่อง
 * ========================================================== */

function EarLockPanelBox({ width, height, depth }) {
  const mesh = useRef();
  const map = useCorrugatedTexture();
  useFrame((_state, delta) => (mesh.current.rotation.y += delta * 0.1));

  const w = width / 10;
  const h = height / 10;
  const d = depth / 10;

  const HP = Math.PI / 2;
  const tuck = Math.min(d * 0.4, h * 0.3);
  const earW = Math.min(d * 0.35, w * 0.2); // ขนาดหูช้าง
  const lidOpen = 0.44;

  return (
    <group ref={mesh} position={[0, h / 2, 0]}>

      {/* FRONT */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
      </mesh>

      {/* BACK */}
      <mesh position={[0, 0, -d]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
      </mesh>

      {/* BOTTOM */}
      <mesh position={[0, -h / 2, -d / 2]} rotation={[HP, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
      </mesh>

      {/* LEFT SIDE */}
      <group position={[-w / 2, 0, 0]} rotation={[0, HP, 0]}>
        <mesh position={[d / 2, 0, 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
        </mesh>
      </group>

      {/* RIGHT SIDE */}
      <group position={[w / 2, 0, 0]} rotation={[0, -HP, 0]}>
        <mesh position={[-d / 2, 0, 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
        </mesh>
      </group>

      {/* TOP FLAP + TUCK (เหมือน tuck-end) */}
      <group position={[0, h / 2, 0]} rotation={[-HP + lidOpen, 0, 0]}>
        <mesh position={[0, d / 2, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
        </mesh>
        <group position={[0, d, 0]} rotation={[HP, 0, 0]}>
          <mesh position={[0, tuck / 2, 0]}>
            <planeGeometry args={[w * 0.92, tuck]} />
            <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* ───── EAR TABS ที่ก้นกล่อง (4 มุม) ───── */}
      {/* หูซ้ายหน้า */}
      <group position={[-w / 2, -h / 2, 0]} rotation={[HP, 0, 0]}>
        <group rotation={[0, HP * 0.85, 0]}>
          <mesh position={[earW / 2, d * 0.15, 0]}>
            <planeGeometry args={[earW, d * 0.3]} />
            <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
          </mesh>
        </group>
      </group>
      {/* หูขวาหน้า */}
      <group position={[w / 2, -h / 2, 0]} rotation={[HP, 0, 0]}>
        <group rotation={[0, -HP * 0.85, 0]}>
          <mesh position={[-earW / 2, d * 0.15, 0]}>
            <planeGeometry args={[earW, d * 0.3]} />
            <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
          </mesh>
        </group>
      </group>
      {/* หูซ้ายหลัง */}
      <group position={[-w / 2, -h / 2, -d]} rotation={[HP, 0, 0]}>
        <group rotation={[0, HP * 0.85, 0]}>
          <mesh position={[earW / 2, -d * 0.15, 0]}>
            <planeGeometry args={[earW, d * 0.3]} />
            <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
          </mesh>
        </group>
      </group>
      {/* หูขวาหลัง */}
      <group position={[w / 2, -h / 2, -d]} rotation={[HP, 0, 0]}>
        <group rotation={[0, -HP * 0.85, 0]}>
          <mesh position={[-earW / 2, -d * 0.15, 0]}>
            <planeGeometry args={[earW, d * 0.3]} />
            <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ============================================================
 * PanelBox — dispatcher ตาม boxType
 * ========================================================== */
function PanelBox({ width, height, depth, boxType }) {
  switch (boxType) {
    case 'tuck_end':
      return <TuckEndPanelBox width={width} height={height} depth={depth} />;
    case 'ear_lock':
      return <EarLockPanelBox width={width} height={height} depth={depth} />;
    case 'die_cut':
    default:
      return <DieCutBox width={width} height={height} depth={depth} />;
  }
}

/* ============================================================
 * BoxViewer Container
 * ========================================================== */
export default function BoxViewer({ width, height, depth, image, isDanger, boxType = 'rsc' }) {
  const showTexture = image && !isDanger;
  const usePanelBox = boxType !== 'rsc' && !showTexture && !isDanger;

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [6, 6, 6], fov: 45 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#1a1d23']} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} />
        <Environment preset="studio" />

        <Suspense fallback={null}>
          {showTexture ? (
            <TexturedBox width={width} height={height} depth={depth} textureUrl={image} />
          ) : isDanger ? (
            <HeatmapBox width={width} height={height} depth={depth} />
          ) : usePanelBox ? (
            <PanelBox width={width} height={height} depth={depth} boxType={boxType} />
          ) : (
            <PlainBox width={width} height={height} depth={depth} />
          )}
        </Suspense>

        <ContactShadows opacity={0.4} scale={10} blur={2.5} />
        <OrbitControls makeDefault />
        <gridHelper args={[20, 20, '#2e3139', '#22252d']} />
      </Canvas>

      {/* Dimension label overlay */}
      <div className="absolute bottom-3 left-3 bg-panel-darker/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-panel-border">
        <span className="text-[11px] font-mono text-zinc-400">
          {width} × {depth} × {height} cm
        </span>
      </div>

      {/* Box type badge (when not RSC) */}
      {boxType !== 'rsc' && (
        <div className="absolute top-3 left-3 bg-panel-darker/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-panel-border">
          <span className="text-[11px] font-mono text-lumo-400">
            {BOX_TYPE_LABELS[boxType] || boxType}
          </span>
        </div>
      )}
    </div>
  );
}
