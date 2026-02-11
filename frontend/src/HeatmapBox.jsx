import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Vertex Shader: จัดการตำแหน่ง
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment Shader: จัดการไล่สี Heatmap (เขียว->แดง)
const fragmentShader = `
  uniform vec3 colorSafe;
  uniform vec3 colorDanger;
  varying vec2 vUv;

  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    // ไล่สีจากจุดกึ่งกลาง (0.2) ไปยังขอบ (0.65)
    float heat = smoothstep(0.2, 0.65, dist);
    vec3 finalColor = mix(colorSafe, colorDanger, heat);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function HeatmapBox({ width, height, depth }) {
  const mesh = useRef();

  useFrame((state, delta) => {
    mesh.current.rotation.y += delta * 0.1;
  });

  const uniforms = useMemo(
    () => ({
      colorSafe: { value: new THREE.Color('#2ecc71') }, // เขียว
      colorDanger: { value: new THREE.Color('#e74c3c') }, // แดง
    }),
    []
  );

  return (
    <mesh ref={mesh} position={[0, height / 20, 0]}>
      <boxGeometry args={[width / 10, height / 10, depth / 10]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}