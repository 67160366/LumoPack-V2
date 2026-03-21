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
 * - PanelBox:    กล่องจากแผ่นพับ (die-cut, bow)
 * - ContourBox:  กล่องรูปทรงพิเศษ (heart, star, bear, circle)
 */

import { useEffect, useState, useMemo, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import { TextureLoader } from 'three';
import HeatmapBox from './HeatmapBox';
import useCorrugatedTexture from './useCorrugatedTexture';
import DieCutBox from './DieCutBox';
import DxfFoldBox from './DxfFoldBox';
import ContourBox from './ContourBox';
import BowBox from './BowBox';
import RSCBox from './RSCBox';

import {
  getContourSteps,
  getContourStepIndex,
  getBowSteps,
  getBowStepIndex,
  getRSCSteps,
  getRSCStepIndex,
} from '../../engine/animationPhases';

// Box type labels (for fallback badge)
const BOX_TYPE_LABELS = {
  rsc: 'RSC',
  die_cut: 'Die-cut',
  heart: 'Heart Box',
  star: 'Star Box',
  bear: 'Bear Box',
  circle: 'Circle Box',
  bow: 'Bow Box',
};

// Box types that support fold animation
const FOLDABLE_TYPES = ['rsc', 'die_cut', 'heart', 'star', 'bear', 'circle', 'bow'];
// Box types that are contour-based (not panel-based)
const CONTOUR_TYPES = ['heart', 'star', 'bear', 'circle'];
// Box types that support the support structure toggle
const SUPPORT_TYPES = ['die_cut', 'heart', 'star', 'bear', 'circle', 'bow'];

/* ============================================================
 * PlainBox  (RSC — simple boxGeometry)
 * ========================================================== */
function PlainBox({ width, height, depth }) {
  const corrugatedMap = useCorrugatedTexture();
  return (
    <mesh position={[0, height / 20, 0]}>
      <boxGeometry args={[width / 10, height / 10, depth / 10]} />
      <meshStandardMaterial map={corrugatedMap} roughness={0.85} />
    </mesh>
  );
}

/* ============================================================
 * TexturedBox
 * ========================================================== */
function TexturedBox({ width, height, depth, textureUrl }) {
  const texture = useLoader(TextureLoader, textureUrl);
  return (
    <mesh position={[0, height / 20, 0]}>
      <boxGeometry args={[width / 10, height / 10, depth / 10]} />
      <meshStandardMaterial map={texture} roughness={0.5} />
    </mesh>
  );
}

/* ============================================================
 * PanelBox — dispatcher ตาม boxType
 * ========================================================== */
function PanelBox({ width, height, depth, boxType, foldProgress, showSupport, supportConfig }) {
  switch (boxType) {
    case 'rsc':
      return <RSCBox width={width} height={height} depth={depth} foldProgress={foldProgress} />;
    case 'bow':
      return <BowBox width={width} height={height} depth={depth} foldProgress={foldProgress} showSupport={showSupport} supportConfig={supportConfig} />;
    case 'heart':
    case 'star':
    case 'bear':
      return (
        <ContourBox
          shapeType={boxType}
          scale={Math.min(width, depth) / 100}
          height={height / 10}
          foldProgress={foldProgress}
          showSupport={showSupport}
          supportConfig={supportConfig}
        />
      );
    case 'circle':
      return (
        <ContourBox
          shapeType="circle"
          radius={Math.min(width, depth) / 20}
          height={height / 10}
          foldProgress={foldProgress}
          showSupport={showSupport}
          supportConfig={supportConfig}
        />
      );
    case 'die_cut':
    default:
      return <DxfFoldBox width={width * 10} height={height * 10} depth={depth * 10} foldProgress={foldProgress} />;
  }
}

/* ============================================================
 * Die-cut now uses same phases as BowBox (getBowSteps/getBowStepIndex)
 * ========================================================== */

/* ============================================================
 * BoxViewer Container
 * ========================================================== */
export default function BoxViewer({ width, height, depth, image, isDanger, boxType = 'rsc', supportConfig }) {
  const [foldProgress, setFoldProgress] = useState(0);
  const [showSupport, setShowSupport] = useState(false);

  const showTexture = image && !isDanger;
  const usePanelBox = !showTexture && !isDanger;
  const showFoldSlider = usePanelBox && FOLDABLE_TYPES.includes(boxType);
  const isContour = CONTOUR_TYPES.includes(boxType);
  const canShowSupport = SUPPORT_TYPES.includes(boxType);

  // Dynamic fold steps based on box type
  const foldSteps = useMemo(() => {
    if (boxType === 'rsc') return getRSCSteps();
    if (isContour) return getContourSteps(showSupport);
    return getBowSteps(showSupport);
  }, [boxType, isContour, showSupport]);

  const activeStep = useMemo(() => {
    if (boxType === 'rsc') return getRSCStepIndex(foldProgress);
    if (isContour) return getContourStepIndex(foldProgress, showSupport);
    return getBowStepIndex(foldProgress, showSupport);
  }, [foldProgress, boxType, isContour, showSupport]);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [6, 6, 6], fov: 45 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#5c5c5c']} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} />
        <Environment preset="studio" />

        <Suspense fallback={null}>
          {showTexture ? (
            <TexturedBox width={width} height={height} depth={depth} textureUrl={image} />
          ) : isDanger ? (
            <HeatmapBox width={width} height={height} depth={depth} />
          ) : usePanelBox ? (
            <PanelBox
              width={width}
              height={height}
              depth={depth}
              boxType={boxType}
              foldProgress={foldProgress}
              showSupport={showSupport}
              supportConfig={supportConfig}
            />
          ) : (
            <PlainBox width={width} height={height} depth={depth} />
          )}
        </Suspense>

        <ContactShadows opacity={0.4} scale={10} blur={2.5} />
        <OrbitControls makeDefault autoRotate={false} />
        <gridHelper args={[20, 20, '#e9d5ff', '#f3e8ff']} />
      </Canvas>

      {/* Fold slider — bottom bar (pacdora style) */}
      {showFoldSlider && (
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: 16,
            padding: '12px 24px',
            border: '1px solid rgba(147,51,234,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minWidth: 380,
            maxWidth: '90%',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          {/* Step label */}
          <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#7c3aed', whiteSpace: 'nowrap', minWidth: 100 }}>
            {foldSteps[activeStep]}
          </span>

          {/* Slider */}
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={foldProgress * 100}
            onChange={(e) => setFoldProgress(parseFloat(e.target.value) / 100)}
            style={{ flex: 1, height: 6, accentColor: '#7c3aed', cursor: 'pointer' }}
          />

          {/* Percentage */}
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b21a8', fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
            {Math.round(foldProgress * 100)}%
          </span>

          {/* Support toggle */}
          {canShowSupport && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderLeft: '1px solid rgba(147,51,234,0.2)', paddingLeft: 16, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={showSupport}
                onChange={(e) => setShowSupport(e.target.checked)}
                style={{ accentColor: '#7c3aed' }}
              />
              <span style={{ fontSize: 11, color: '#7c3aed' }}>ซัพพอร์ท</span>
            </label>
          )}
        </div>
      )}

      {/* Dimension label overlay */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-purple-200 shadow-sm">
        <span className="text-[11px] font-mono text-purple-500">
          {isContour
            ? `${width} × ${height} cm`
            : `${width} × ${depth} × ${height} cm`
          }
        </span>
      </div>

      {/* Box type badge (when not RSC) */}
      {boxType !== 'rsc' && (
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-purple-200 shadow-sm">
          <span className="text-[11px] font-mono text-purple-700 font-semibold">
            {BOX_TYPE_LABELS[boxType] || boxType}
          </span>
        </div>
      )}
    </div>
  );
}
