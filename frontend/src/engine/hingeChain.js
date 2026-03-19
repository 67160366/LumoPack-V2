/**
 * Hinge chain builder — creates nested pivot groups from 2D outline points.
 *
 * Used by heart, star, bear shapes. Each wall segment is a child of the
 * previous pivot, creating a chain that can fold and roll.
 */
import * as THREE from 'three';

/**
 * Build a hinge chain from contour outline points.
 * @param {THREE.Vector2[]} points - 2D outline (first ~= last for closed shapes)
 * @param {number} height - wall height
 * @param {THREE.Material} material
 * @param {number} overlap - extra width per segment to prevent gaps
 * @returns {{ wallsGroup: THREE.Group, wallHinges: THREE.Group[] }}
 */
export function buildHingeChain(points, height, material, overlap = 0.01) {
  const wallsGroup = new THREE.Group();
  const wallHinges = [];
  let distPrev = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    let relAngle = 0;
    if (i === 0) {
      relAngle = angle;
    } else {
      const prevDx = points[i].x - points[i - 1].x;
      const prevDy = points[i].y - points[i - 1].y;
      const prevAngle = Math.atan2(prevDy, prevDx);
      relAngle = angle - prevAngle;
      relAngle = Math.atan2(Math.sin(relAngle), Math.cos(relAngle));
    }

    const pivot = new THREE.Group();
    pivot.userData.targetAngle = relAngle;

    if (i === 0) {
      pivot.position.set(p1.x, 0, -p1.y);
      wallsGroup.add(pivot);
    } else {
      pivot.position.set(distPrev, 0, 0);
      wallHinges[i - 1].add(pivot);
    }

    const wallGeo = new THREE.PlaneGeometry(dist + overlap, height);
    wallGeo.translate(dist / 2, height / 2, 0);
    const wallMesh = new THREE.Mesh(wallGeo, material);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    pivot.add(wallMesh);
    pivot.userData.mesh = wallMesh;
    wallHinges.push(pivot);
    distPrev = dist;
  }

  return { wallsGroup, wallHinges };
}

/**
 * Build a bidirectional hinge chain for circular shapes.
 * Center segment + right chain + left chain, rolling in opposite directions.
 * @param {number} radius
 * @param {number} segments - total segments (e.g. 64)
 * @param {number} height - wall height
 * @param {THREE.Material} material
 * @returns {{ wallGroup: THREE.Group, rightSegs: THREE.Group[], leftSegs: THREE.Group[] }}
 */
export function buildCircleHingeChain(radius, segments, height, material) {
  const W = (2 * Math.PI * radius) / segments;
  const R_circum = W / (2 * Math.tan(Math.PI / segments));

  const wallGroup = new THREE.Group();
  wallGroup.position.set(0, 0, R_circum);

  // Center segment
  const centerGeo = new THREE.PlaneGeometry(W, height);
  centerGeo.translate(0, height / 2, 0);
  const centerMesh = new THREE.Mesh(centerGeo, material);
  centerMesh.castShadow = true;
  centerMesh.receiveShadow = true;
  wallGroup.add(centerMesh);

  // Right chain (31 segments)
  const rightSegs = [];
  const geoRight = new THREE.PlaneGeometry(W, height);
  geoRight.translate(W / 2, height / 2, 0);
  let prevRight = wallGroup;

  for (let i = 0; i < 31; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(i === 0 ? W / 2 : W, 0, 0);
    const mesh = new THREE.Mesh(geoRight, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    prevRight.add(pivot);
    rightSegs.push(pivot);
    prevRight = pivot;
  }

  // Left chain (32 segments)
  const leftSegs = [];
  const geoLeft = new THREE.PlaneGeometry(W, height);
  geoLeft.translate(-W / 2, height / 2, 0);
  let prevLeft = wallGroup;

  for (let i = 0; i < 32; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(i === 0 ? -W / 2 : -W, 0, 0);
    const mesh = new THREE.Mesh(geoLeft, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    prevLeft.add(pivot);
    leftSegs.push(pivot);
    prevLeft = pivot;
  }

  return { wallGroup, rightSegs, leftSegs };
}

/**
 * Apply fold + roll animation to a standard hinge chain.
 * @param {THREE.Group[]} wallHinges
 * @param {number} foldProgress - 0..1 (walls flat → upright)
 * @param {number} rollProgress - 0..1 (straight → curved shape)
 */
export function animateHingeChain(wallHinges, foldProgress, rollProgress) {
  const tiltAngle = (-Math.PI / 2) * (1 - foldProgress);
  wallHinges.forEach(hinge => {
    hinge.userData.mesh.rotation.x = tiltAngle;
    hinge.rotation.y = hinge.userData.targetAngle * rollProgress;
  });
}

/**
 * Apply fold + roll animation to a circle's bidirectional chain.
 * @param {{ wallGroup, rightSegs, leftSegs }} chainData
 * @param {number} foldProgress - 0..1
 * @param {number} rollProgress - 0..1
 * @param {number} segments - total segments
 */
export function animateCircleChain(chainData, foldProgress, rollProgress, segments) {
  const wallAngleX = (-Math.PI / 2) * (1 - foldProgress);
  chainData.wallGroup.rotation.x = wallAngleX;

  const rollAngle = rollProgress * ((Math.PI * 2) / segments);
  chainData.rightSegs.forEach(seg => (seg.rotation.y = rollAngle));
  chainData.leftSegs.forEach(seg => (seg.rotation.y = -rollAngle));
}
