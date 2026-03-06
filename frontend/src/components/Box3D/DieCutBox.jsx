/**
 * DieCutBox — Scalable 3D flat dieline from DXF + piecewise scaler
 *
 * Pipeline:
 *   1. Parse reference DXF (500x300x80mm) once
 *   2. Scale all coordinates to current (W, H, D) via piecewise mapping
 *   3. Create filled shapes by closing open polylines
 *   4. Render cut/crease lines from scaled DXF
 *
 * Coordinate mapping:
 *   Scaled X (mm) → Three.js X * S
 *   Scaled Y (mm) → Three.js -Z * S
 *   Flat on Y=0 plane
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Shape, DoubleSide, ShapeGeometry } from 'three';
import { Line } from '@react-three/drei';
import useCorrugatedTexture from './useCorrugatedTexture';
import { parseDxf } from '../../engine/dxfParser';
import { scaleDxfData } from '../../engine/parametric/dxfScaler';
import dxfRaw from '../../assets/500x300x80mm-folding-box.dxf?raw';

const CUT_COLOR = '#cc2222';
const CREASE_COLOR = '#22aa44';
const S = 0.01; // mm → scene units

// ─── Convert polyline (mm) to Line3D points ──────────────────
function toLine3D(polyline, y = 0) {
  return polyline.map(([x, z]) => [x * S, y, -z * S]);
}

// ─── Create a filled mesh from a closed polyline ─────────────
// Polyline coords are in mm; mesh is laid flat on the XZ plane at given Y
function ClosedFill({ polyline, material, y = 0 }) {
  const geometry = useMemo(() => {
    if (!polyline || polyline.length < 3) return null;

    const shape = new Shape();
    shape.moveTo(polyline[0][0] * S, -polyline[0][1] * S);
    for (let i = 1; i < polyline.length; i++) {
      shape.lineTo(polyline[i][0] * S, -polyline[i][1] * S);
    }
    shape.closePath();

    const geo = new ShapeGeometry(shape);

    // Rotate from XY plane to XZ plane: swap Y → Z
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      pos.setXYZ(i, px, y, py);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [polyline, y]);

  if (!geometry) return null;
  return <mesh geometry={geometry}><meshStandardMaterial {...material} /></mesh>;
}

// ─── Build fill regions from open polylines ──────────────────
// Close each open DXF polyline + add front face rectangle
function buildFillRegions(scaled) {
  const fills = [];

  // Close open cut polylines to create fill regions
  // Cut[0]: Top section (depth strip + back panel + back flaps + tongue)
  if (scaled.cut[0]?.length > 2) {
    const top = [...scaled.cut[0]];
    top.push(top[0]); // close it
    fills.push(top);
  }

  // Cut[1]: Bottom flap
  if (scaled.cut[1]?.length > 2) {
    const bot = [...scaled.cut[1]];
    bot.push(bot[0]);
    fills.push(bot);
  }

  // Cut[2]: Left side (depth panel + glue flap)
  if (scaled.cut[2]?.length > 2) {
    const left = [...scaled.cut[2]];
    left.push(left[0]);
    fills.push(left);
  }

  // Cut[3]: Right side (depth panel + glue flap)
  if (scaled.cut[3]?.length > 2) {
    const right = [...scaled.cut[3]];
    right.push(right[0]);
    fills.push(right);
  }

  // Front face: simple rectangle from (0,0) to (faceW, faceH)
  // We get these from the first points of cut[2] and cut[3]
  // cut[2] starts near (6, 1.5) and ends near (3, 304.5)
  // cut[3] starts near (515, 1.5) and ends near (518, 304.5)
  // The face creases define the edges
  // Use the outermost face bounds from the glue flap endpoints
  const leftFace = scaled.cut[2];
  const rightFace = scaled.cut[3];
  if (leftFace && rightFace) {
    // left face start (bottom): ~(6, 1.5), end (top): ~(3, 304.5)
    // right face start (bottom): ~(515, 1.5), end (top): ~(518, 304.5)
    const bL = leftFace[0]; // bottom-left area
    const tL = leftFace[leftFace.length - 1]; // top-left area
    const bR = rightFace[0]; // bottom-right area
    const tR = rightFace[rightFace.length - 1]; // top-right area

    // Front face rectangle connecting the endpoints
    fills.push([bL, bR, tR, tL, bL]);
  }

  // Tab cutouts (Cut[4-7]) are already closed → include as fills
  for (let i = 4; i < scaled.cut.length; i++) {
    if (scaled.cut[i]?.length > 2) {
      fills.push(scaled.cut[i]);
    }
  }

  return fills;
}

// ─── Main Component ──────────────────────────────────────────
export default function DieCutBox({ width, height, depth }) {
  const ref = useRef();
  const map = useCorrugatedTexture();
  useFrame((_s, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.06; });

  // Convert cm → mm (BoxViewer passes cm)
  const W = (width || 50) * 10;
  const H = (height || 30) * 10;
  const D = (depth || 8) * 10;

  // Parse reference DXF once
  const refDxf = useMemo(() => parseDxf(dxfRaw), []);

  // Scale DXF to current dimensions
  const scaled = useMemo(() => scaleDxfData(refDxf, W, H, D, 3), [refDxf, W, H, D]);

  // Build fill regions
  const fills = useMemo(() => buildFillRegions(scaled), [scaled]);

  const mat = { map, roughness: 0.86, side: DoubleSide };

  // Center offset: place rotation pivot at geometric center
  const { bounds } = scaled;
  const cx = (bounds.minX + bounds.width / 2) * S;
  const cz = -(bounds.minY + bounds.height / 2) * S;

  return (
    <group ref={ref} position={[-cx, 0.01, -cz]}>

      {/* Filled panels */}
      {fills.map((polyline, i) => (
        <ClosedFill key={`fill-${i}`} polyline={polyline} material={mat} y={0} />
      ))}

      {/* Cut lines (red) */}
      {scaled.cut.map((polyline, i) => (
        <Line
          key={`cut-${i}`}
          points={toLine3D(polyline, 0.002)}
          color={CUT_COLOR}
          lineWidth={1.5}
        />
      ))}

      {/* Crease lines (green dashed) */}
      {scaled.crease.map((polyline, i) => (
        <Line
          key={`crease-${i}`}
          points={toLine3D(polyline, 0.003)}
          color={CREASE_COLOR}
          lineWidth={1}
          dashed
          dashSize={0.06}
          gapSize={0.04}
        />
      ))}
    </group>
  );
}
