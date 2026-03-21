import { useMemo } from 'react';
import * as THREE from 'three';
import useImageTexture from './useImageTexture';
import useCardboardNoise from './useCardboardNoise';

const cardboardColor = '#c4a882';

/**
 * A single box-shaped panel with procedural cardboard noise + optional outer/inner image textures.
 *
 * BoxGeometry face indices: 0:+x, 1:-x, 2:+y(inner), 3:-y(outer), 4:+z, 5:-z
 */
export default function Panel({
  width,
  height,
  color = cardboardColor,
  outerUrl = null,
  innerUrl = null,
  thickness = 0.005,
}) {
  // Procedural noise texture scaled to panel size
  const repeatX = Math.max(0.5, width / 0.05 * 0.3);
  const repeatY = Math.max(0.5, height / 0.05 * 0.3);
  const noiseTex = useCardboardNoise(color, repeatX, repeatY);

  const outerTex = useImageTexture(outerUrl, false);
  const innerTex = useImageTexture(innerUrl, true);

  // Edge wireframe
  const edgeGeo = useMemo(() => {
    const box = new THREE.BoxGeometry(width, thickness, height);
    return new THREE.EdgesGeometry(box);
  }, [width, height, thickness]);

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, thickness, height]} />
        {(!outerTex && !innerTex) ? (
          <meshStandardMaterial
            color="#ffffff"
            map={noiseTex}
            side={THREE.DoubleSide}
            roughness={0.85}
            metalness={0.02}
          />
        ) : (
          <>
            <meshStandardMaterial attach="material-0" color="#ffffff" map={noiseTex} roughness={0.85} metalness={0.02} />
            <meshStandardMaterial attach="material-1" color="#ffffff" map={noiseTex} roughness={0.85} metalness={0.02} />
            <meshStandardMaterial attach="material-2"
              color="#ffffff"
              map={innerTex || noiseTex}
              roughness={innerTex ? 0.7 : 0.85}
              metalness={0.02}
              side={THREE.DoubleSide}
            />
            <meshStandardMaterial attach="material-3"
              color="#ffffff"
              map={outerTex || noiseTex}
              roughness={outerTex ? 0.7 : 0.85}
              metalness={0.02}
              side={THREE.DoubleSide}
            />
            <meshStandardMaterial attach="material-4" color="#ffffff" map={noiseTex} roughness={0.85} metalness={0.02} />
            <meshStandardMaterial attach="material-5" color="#ffffff" map={noiseTex} roughness={0.85} metalness={0.02} />
          </>
        )}
      </mesh>
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={0x333333} transparent opacity={0.3} />
      </lineSegments>
    </group>
  );
}
