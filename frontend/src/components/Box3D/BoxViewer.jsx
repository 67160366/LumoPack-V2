/**
 * BoxViewer — 3D Canvas Area (center panel)
 * 
 * แสดงกล่อง 3D ตามขนาดที่กำหนด
 * รับ dimensions จาก props (synced กับ ChatbotContext)
 * 
 * Mode:
 * - PlainBox:    ปกติ (สี cardboard)
 * - TexturedBox: มี texture จาก image upload
 * - HeatmapBox:  danger mode (heatmap shader)
 */

import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { TextureLoader } from 'three';
import HeatmapBox from '../../HeatmapBox';

// --- PlainBox ---
function PlainBox({ width, height, depth, color }) {
  const mesh = useRef();
  useFrame((state, delta) => (mesh.current.rotation.y += delta * 0.1));
  return (
    <mesh ref={mesh} position={[0, height / 20, 0]}>
      <boxGeometry args={[width / 10, height / 10, depth / 10]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

// --- TexturedBox ---
function TexturedBox({ width, height, depth, textureUrl }) {
  const mesh = useRef();
  const texture = useLoader(TextureLoader, textureUrl);
  useFrame((state, delta) => (mesh.current.rotation.y += delta * 0.1));
  return (
    <mesh ref={mesh} position={[0, height / 20, 0]}>
      <boxGeometry args={[width / 10, height / 10, depth / 10]} />
      <meshStandardMaterial map={texture} roughness={0.5} />
    </mesh>
  );
}

// --- BoxViewer Container ---
export default function BoxViewer({ width, height, depth, image, isDanger }) {
  const showTexture = image && !isDanger;

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [6, 6, 6], fov: 45 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#1a1d23']} />
        <ambientLight intensity={0.8} />
        <spotLight position={[10, 10, 10]} angle={0.15} />

        <Suspense fallback={null}>
          {showTexture ? (
            <TexturedBox width={width} height={height} depth={depth} textureUrl={image} />
          ) : isDanger ? (
            <HeatmapBox width={width} height={height} depth={depth} />
          ) : (
            <PlainBox width={width} height={height} depth={depth} color="#d4a373" />
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
    </div>
  );
}