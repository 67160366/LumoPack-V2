/**
 * ContourBox — R3F component for contour-based shaped boxes
 * (Heart, Star, Bear, Circle)
 *
 * Uses hinge chain system: wall segments linked by pivots for fold + roll animation.
 * Supports optional support structures (perforated plate + legs).
 *
 * Architecture:
 * - Imperative THREE.Group construction (70-80 nested hinges too deep for JSX)
 * - Rendered via <primitive object={...} />
 * - Animation driven by foldProgress prop
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { shapes } from '../../engine/shapes';
import { SEGMENTS as CIRCLE_SEGMENTS } from '../../engine/shapes/circleShape';
import {
  buildHingeChain,
  buildCircleHingeChain,
  animateHingeChain,
  animateCircleChain,
} from '../../engine/hingeChain';
import { getContourPhases } from '../../engine/animationPhases';

const HP = Math.PI / 2;

/**
 * Build base or lid assembly for contour shapes (heart/star/bear)
 */
function buildContourParts(points, height, material, overlap) {
  const group = new THREE.Group();

  // Base plate
  const shape = new THREE.Shape();
  for (let i = 0; i < points.length; i++) {
    if (i === 0) shape.moveTo(points[i].x, points[i].y);
    else shape.lineTo(points[i].x, points[i].y);
  }
  const baseGeo = new THREE.ShapeGeometry(shape);
  const baseMesh = new THREE.Mesh(baseGeo, material);
  baseMesh.rotation.x = -HP;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Walls via hinge chain
  const { wallsGroup, wallHinges } = buildHingeChain(points, height, material, overlap);
  group.add(wallsGroup);

  return { group, wallHinges };
}

/**
 * Build base or lid assembly for circle shapes
 */
function buildCircleParts(radius, height, material) {
  const group = new THREE.Group();

  // Circle base plate
  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    material
  );
  circle.rotation.x = -HP;
  circle.castShadow = true;
  circle.receiveShadow = true;
  group.add(circle);

  // Walls via bidirectional hinge chain
  const chainData = buildCircleHingeChain(radius, CIRCLE_SEGMENTS, height, material);
  group.add(chainData.wallGroup);

  return { group, chainData };
}

/**
 * Build support structure for contour shapes
 */
function buildContourSupport(points, scale, holeRadius, legHeight, material) {
  const group = new THREE.Group();
  const innerScale = 0.96;

  // Perforated plate
  const shape = new THREE.Shape();
  for (let i = 0; i < points.length; i++) {
    const x = points[i].x * innerScale;
    const y = points[i].y * innerScale;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  const holePath = new THREE.Path();
  holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, false);
  shape.holes.push(holePath);

  const plateMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  plateMesh.rotation.x = -HP;
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  group.add(plateMesh);

  // Cylindrical leg
  if (legHeight > 0.01) {
    const tubeGeo = new THREE.CylinderGeometry(holeRadius, holeRadius, legHeight, 32, 1, true);
    const tubeMesh = new THREE.Mesh(tubeGeo, material);
    tubeMesh.position.y = -legHeight / 2;
    tubeMesh.castShadow = true;
    tubeMesh.receiveShadow = true;
    group.add(tubeMesh);
  }

  return group;
}

/**
 * Build support for circle shape
 */
function buildCircleSupport(radius, holeRadius, supportHeight, material) {
  const group = new THREE.Group();
  const innerRadius = radius * 0.96;

  // Perforated disk
  const shape = new THREE.Shape();
  shape.absarc(0, 0, innerRadius, 0, Math.PI * 2, false);
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, false);
  shape.holes.push(holePath);

  const plateMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  plateMesh.rotation.x = -HP;
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  group.add(plateMesh);

  // Cylinder wall
  if (supportHeight > 0.01) {
    const wallGeo = new THREE.CylinderGeometry(
      innerRadius - 0.06, innerRadius - 0.06,
      supportHeight, 64, 1, true
    );
    const wallMesh = new THREE.Mesh(wallGeo, material);
    wallMesh.position.y = -supportHeight / 2;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    group.add(wallMesh);
  }

  return group;
}

export default function ContourBox({
  shapeType = 'heart',
  scale: scaleProp,
  height: heightProp,
  radius: radiusProp,
  foldProgress = 0,
  showSupport = false,
}) {
  const rootRef = useRef();
  const isCircle = shapeType === 'circle';

  // Get shape config
  const config = shapes[shapeType]?.SHAPE_CONFIG || shapes.heart.SHAPE_CONFIG;

  // Determine dimensions
  const scale = scaleProp || config.defaultScale || 1;
  const boxHeight = heightProp || 5;
  const radius = radiusProp || config.defaultRadius || 2.5;

  // Materials (memoized)
  const matBox = useMemo(() => new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: 0.8,
    metalness: shapeType === 'star' ? 0.2 : 0.05,
    side: THREE.DoubleSide,
  }), [config.color, shapeType]);

  const matSupport = useMemo(() => new THREE.MeshStandardMaterial({
    color: config.supportColor,
    roughness: 0.9,
    side: THREE.DoubleSide,
  }), [config.supportColor]);

  // Build geometry (imperative, memoized on dimensions)
  const assembly = useMemo(() => {
    if (isCircle) {
      const base = buildCircleParts(radius, boxHeight, matBox);
      const lid = buildCircleParts(radius + config.lidRadiusOffset, config.lidHeight, matBox);

      const holeR = radius * 0.3;
      const supportH = boxHeight * 0.4;
      const support = buildCircleSupport(radius, holeR, supportH, matSupport);
      support.position.y = boxHeight + 10;

      return { base, lid, support, isCircle: true };
    }

    // Contour shapes (heart/star/bear)
    const getPoints = shapes[shapeType]?.getOutlinePoints;
    if (!getPoints) return null;

    const points = getPoints(scale);
    const base = buildContourParts(points, boxHeight, matBox, config.wallOverlap);
    const lid = buildContourParts(
      getPoints(scale + config.lidScaleOffset),
      config.lidHeight,
      matBox,
      config.wallOverlap
    );

    const holeR = scale * 3;
    const legH = Math.max(0.01, (boxHeight - (boxHeight * 0.5)) / 2);
    const support = buildContourSupport(points, scale, holeR, legH, matSupport);
    support.position.y = boxHeight + 10;

    return { base, lid, support, isCircle: false };
  }, [shapeType, scale, boxHeight, radius, matBox, matSupport, config, isCircle]);

  // Auto-rotate
  useFrame((_s, dt) => {
    if (rootRef.current) rootRef.current.rotation.y += dt * 0.08;
  });

  // Apply animation each frame when foldProgress changes
  useEffect(() => {
    if (!assembly) return;
    const p = foldProgress;
    const phases = getContourPhases(p, showSupport);

    if (assembly.isCircle) {
      // Circle animation
      animateCircleChain(assembly.base.chainData, phases.fold, phases.roll, CIRCLE_SEGMENTS);
      animateCircleChain(assembly.lid.chainData, phases.fold, phases.roll, CIRCLE_SEGMENTS);

      // Lid positioning
      const peakY = boxHeight + config.lidHeight + 2;
      const finalY = boxHeight + 0.1;

      assembly.lid.group.rotation.x = Math.PI * phases.lift;
      assembly.lid.group.position.z = -8 * (1 - phases.lift);

      if (phases.close === 0) {
        assembly.lid.group.position.y = peakY * phases.lift;
      } else {
        assembly.lid.group.position.y =
          peakY * (1 - phases.close) + finalY * phases.close;
      }

      // Support
      if (showSupport) {
        const startY = boxHeight + 10;
        const endY = boxHeight * 0.4;
        assembly.support.position.y = startY - phases.support * (startY - endY);
      }
      assembly.support.visible = showSupport;
    } else {
      // Contour shape animation (heart/star/bear)
      animateHingeChain(assembly.base.wallHinges, phases.fold, phases.roll);
      animateHingeChain(assembly.lid.wallHinges, phases.fold, phases.roll);

      // Lid animation
      const lidOffset = (shapeType === 'star' ? 25 : 18) * scale;
      const peakY = boxHeight + config.lidHeight + (shapeType === 'star' ? 6 : 3);
      const finalY = boxHeight + 0.05;

      if (phases.lift > 0 && phases.close === 0) {
        assembly.lid.group.position.x = lidOffset * (1 - phases.lift);
        assembly.lid.group.position.y = peakY * phases.lift;
        assembly.lid.group.rotation.z = Math.PI * phases.lift;
      } else if (phases.close > 0) {
        assembly.lid.group.position.x = 0;
        assembly.lid.group.rotation.z = Math.PI;
        assembly.lid.group.position.y =
          peakY * (1 - phases.close) + finalY * phases.close;
      } else {
        assembly.lid.group.position.set(lidOffset, 0, 0);
        assembly.lid.group.rotation.z = 0;
      }

      // Support drop
      if (showSupport) {
        const startY = boxHeight + 10;
        const legH = Math.max(0.01, (boxHeight - (boxHeight * 0.5)) / 2);
        assembly.support.position.y = startY - phases.support * (startY - legH);
      }
      assembly.support.visible = showSupport;
    }
  }, [foldProgress, showSupport, assembly, boxHeight, scale, config, shapeType]);

  if (!assembly) return null;

  return (
    <group ref={rootRef}>
      <primitive object={assembly.base.group} />
      <primitive object={assembly.lid.group} />
      <primitive object={assembly.support} />
    </group>
  );
}
