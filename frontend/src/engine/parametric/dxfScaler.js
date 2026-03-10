/**
 * DXF Piecewise Scaler
 *
 * Maps DXF reference coordinates (500x300x80mm) to any (W, H, D) box.
 * Uses breakpoint-based piecewise linear interpolation:
 *   - Each structural boundary in the DXF maps to a computed boundary for the new size
 *   - Points between boundaries scale linearly within each zone
 *
 * This preserves the exact topology and curve shapes while allowing
 * the box to resize parametrically.
 */

/**
 * Create a scaler function for transforming DXF reference coords.
 *
 * @param {number} W - Target width (mm)
 * @param {number} H - Target height (mm)
 * @param {number} D - Target depth (mm)
 * @param {number} [T=3] - Paper thickness (mm)
 * @returns {function(number, number): [number, number]} scalePoint(x, y)
 */
export function createDxfScaler(W, H, D, T = 3) {
  const tabW = D * 0.13125;
  const tabH = D * 0.75;
  const faceW = W + 2 * tabW;
  const faceH = H + 2 * T;
  const depthW = D + T;
  const glueTransW = T * 3;
  const glueFlapW = D + 1.5;
  const earBump = 4.5;
  const seg = (faceH - D - 2 * tabH) / 2;
  const backInset = tabW + 1.5;
  const backW = faceW - 2 * backInset;
  const backGap = 2 * T;
  const tongueInset = T;
  const tongueW = faceW - 2 * tongueInset;
  const tongueGap = 2 * T;

  // X breakpoints: [referenceValue, newValue]
  // Symmetric around the center of the front face
  const xMap = [
    [-178,   -(depthW + glueTransW + glueFlapW + earBump)],
    [-173.5, -(depthW + glueTransW + glueFlapW)],
    [-92,    -(depthW + glueTransW)],
    [-83,    -depthW],
    [0,      0],
    [10.5,   tabW],
    [510.5,  faceW - tabW],
    [521,    faceW],
    [604,    faceW + depthW],
    [613,    faceW + depthW + glueTransW],
    [694.5,  faceW + depthW + glueTransW + glueFlapW],
    [699,    faceW + depthW + glueTransW + glueFlapW + earBump],
  ];

  // Y breakpoints: [referenceValue, newValue]
  const yMap = [
    [-80,  -D],
    [0,    0],
    [53,   seg],
    [113,  seg + tabH],
    [193,  seg + tabH + D],
    [253,  seg + 2 * tabH + D],
    [306,  faceH],
    [386,  faceH + D],
    [387.5, faceH + D + (backGap - T) / 2 + T / 2],  // inner crease
    [392,  faceH + D + backGap],
    [692,  faceH + D + backGap + H],
    [696.5, faceH + D + backGap + H + (tongueGap - T) / 2 + T / 2],
    [698,  faceH + D + backGap + H + tongueGap],
    [778,  faceH + D + backGap + H + tongueGap + D],
  ];

  // Also need intermediate X breakpoints for back panel / tongue area
  // These are within the X range but at different structural boundaries
  // Flap arc taper ratio 0.8967 from DXF: first arc vertex X / D
  const xMapBack = [
    [-68,   backInset - D],                    // left back flap outer
    [-59.7, backInset - D * 0.8967],           // left back flap taper
    [12,    backInset],                         // back panel left
    [509,   backInset + backW],                 // back panel right
    [580.7, backInset + backW + D * 0.8967],   // right back flap taper
    [589,   backInset + backW + D],             // right back flap outer
  ];

  // Merge xMapBack into xMap for the back panel Y range
  // For simplicity, we'll use yMap for all Y coords and a context-aware X mapping

  function interpolate(val, map) {
    if (map.length === 0) return val;

    // Clamp/extrapolate
    if (val <= map[0][0]) {
      if (map.length < 2) return map[0][1];
      const [r0, n0] = map[0];
      const [r1, n1] = map[1];
      if (Math.abs(r1 - r0) < 1e-10) return n0;
      return n0 + (val - r0) * (n1 - n0) / (r1 - r0);
    }
    if (val >= map[map.length - 1][0]) {
      if (map.length < 2) return map[map.length - 1][1];
      const [r0, n0] = map[map.length - 2];
      const [r1, n1] = map[map.length - 1];
      if (Math.abs(r1 - r0) < 1e-10) return n1;
      return n0 + (val - r0) * (n1 - n0) / (r1 - r0);
    }

    for (let i = 0; i < map.length - 1; i++) {
      const [r0, n0] = map[i];
      const [r1, n1] = map[i + 1];
      if (val >= r0 && val <= r1) {
        if (Math.abs(r1 - r0) < 1e-10) return n0;
        const t = (val - r0) / (r1 - r0);
        return n0 + t * (n1 - n0);
      }
    }
    return val;
  }

  /**
   * Scale a single DXF reference point to new dimensions.
   * Uses context-aware mapping: X coordinates in the back panel / tongue area
   * use a different mapping than the front face area.
   */
  return function scalePoint(x, y) {
    const newY = interpolate(y, yMap);

    // Determine which X mapping to use based on Y position
    // Back panel area (y > 386): use back-specific X breakpoints merged
    let newX;
    if (y > 386) {
      // Merge main xMap with back-specific breakpoints
      const mergedX = [
        ...xMap.filter(([rx]) => rx <= -83 || rx >= 604),
        ...xMapBack,
        // Keep face-level breakpoints for the depth strip connection
        [0, 0],
        [3, tongueInset],
        [518, tongueInset + tongueW],
        [521, faceW],
      ].sort((a, b) => a[0] - b[0]);
      newX = interpolate(x, mergedX);
    } else {
      newX = interpolate(x, xMap);
    }

    return [newX, newY];
  };
}

/**
 * Scale an entire parsed DXF dataset to new dimensions.
 *
 * @param {{ cut: number[][][], crease: number[][][] }} dxfData - Parsed DXF data
 * @param {number} W - Target width
 * @param {number} H - Target height
 * @param {number} D - Target depth
 * @param {number} [T=3] - Paper thickness
 * @returns {{ cut: number[][][], crease: number[][][], bounds: Object }}
 */
export function scaleDxfData(dxfData, W, H, D, T = 3) {
  const scale = createDxfScaler(W, H, D, T);

  const scalePoly = (polyline) => polyline.map(([x, y]) => scale(x, y));

  const cut = dxfData.cut.map(scalePoly);
  const crease = dxfData.crease.map(scalePoly);

  // Recompute bounds
  const allPts = [...cut, ...crease].flat();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of allPts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return {
    cut,
    crease,
    bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}
