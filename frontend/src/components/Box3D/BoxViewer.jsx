/**
 * BoxViewer — 3D Canvas Area (center panel)
 *
 * Mode:
 * - PlainBox:    ปกติ (corrugated paper texture)
 * - TexturedBox: มี texture จาก image upload
 * - HeatmapBox:  danger mode (heatmap shader — เขียว/แดง)
 * - GltfBox:     โมเดล .glb สำหรับกล่องทรงอื่น (ฝาชน, หูช้าง)
 */

import React, { useRef, Suspense, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, useGLTF, Html } from '@react-three/drei';
import { TextureLoader } from 'three';
import HeatmapBox from './HeatmapBox';
import useCorrugatedTexture from './useCorrugatedTexture';

// Box type labels (for fallback badge)
const BOX_TYPE_LABELS = {
  rsc: 'RSC',
  die_cut: 'Die-cut',
  tuck_end: 'ฝาชน',
  ear_lock: 'หูช้าง',
};

// --- PlainBox (with corrugated texture) ---
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

// --- TexturedBox ---
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

// --- GltfBox (loads .glb model) ---
function GltfBox({ width, height, depth, boxType }) {
  const mesh = useRef();
  const modelPath = `/models/${boxType}.glb`;
  const { scene } = useGLTF(modelPath);
  const corrugatedMap = useCorrugatedTexture();

  useFrame((_state, delta) => (mesh.current.rotation.y += delta * 0.1));

  // Apply corrugated texture to all meshes in the loaded model
  scene.traverse((child) => {
    if (child.isMesh) {
      child.material.map = corrugatedMap;
      child.material.roughness = 0.85;
      child.material.needsUpdate = true;
    }
  });

  // Scale model to match dimensions
  const scale = Math.max(width, height, depth) / 100;

  return (
    <group ref={mesh} position={[0, height / 20, 0]} scale={[scale, scale, scale]}>
      <primitive object={scene.clone()} />
    </group>
  );
}

// --- GltfBox wrapper with error fallback ---
function GltfBoxWithFallback({ width, height, depth, boxType }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <group>
        <PlainBox width={width} height={height} depth={depth} />
        <Html center position={[0, height / 20 + height / 20 + 0.5, 0]}>
          <div className="bg-panel-darker/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-lumo-400/30 whitespace-nowrap">
            <span className="text-[11px] font-mono text-lumo-400">
              {BOX_TYPE_LABELS[boxType] || boxType}
            </span>
            <span className="text-[10px] text-zinc-500 ml-1.5">
              (รอไฟล์โมเดล)
            </span>
          </div>
        </Html>
      </group>
    );
  }

  return (
    <ErrorBoundary onError={() => setHasError(true)}>
      <GltfBox width={width} height={height} depth={depth} boxType={boxType} />
    </ErrorBoundary>
  );
}

// Simple error boundary for catching GLB load failures
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// --- BoxViewer Container ---
export default function BoxViewer({ width, height, depth, image, isDanger, boxType = 'rsc' }) {
  const showTexture = image && !isDanger;
  const useGltfModel = boxType !== 'rsc' && !showTexture && !isDanger;

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
          ) : useGltfModel ? (
            <GltfBoxWithFallback width={width} height={height} depth={depth} boxType={boxType} />
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
