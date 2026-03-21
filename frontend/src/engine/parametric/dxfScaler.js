/**
 * DXF Piecewise Scaler  (v2 — fixed-tab rewrite)
 *
 * Maps DXF reference coordinates (500×300×80 mm) to any (W, H, D) box.
 *
 * Key insight from packmyman.com analysis:
 *   Lock tabs, ear bumps, transitions, and gaps are structural features
 *   whose size depends ONLY on paper thickness T — NOT on box depth D.
 *
 * What scales with what:
 *   W  → front face width, back panel width, tongue width
 *   H  → front face height, back panel height
 *   D  → depth panels, glue flaps, bottom/top flaps, depth strips
 *   T  → tabs, ears, transitions, gaps (FIXED for same material)
 */

/**
 * Create a scaler function for transforming DXF reference coords.
 *
 * @param {number} W - Target face width (mm)
 * @param {number} H - Target face height (mm)
 * @param {number} D - Target box depth (mm)
 * @param {number} [T=3] - Paper thickness (mm)
 * @returns {function(number, number): [number, number]} scalePoint(x, y)
 */
export function createDxfScaler(W, H, D, T = 3) {
  // ─── Fixed-size features (depend on T only) ───
  const tabW      = 3.5 * T;       // lock tab width          (ref: 10.5)
  const earBump   = 1.5 * T;       // ear protrusion          (ref: 4.5)
  const glueTransW = 3 * T;        // glue taper transition   (ref: 9)
  const backGap   = 2 * T;         // back panel gap          (ref: 6)
  const tongueGap = 2 * T;         // tongue gap              (ref: 6)

  // ─── D-dependent features ───
  const depthW    = D + T;         // depth panel width       (ref: 83)
  const glueFlapW = D + T / 2;     // glue flap width         (ref: 81.5)

  // ─── Face dimensions ───
  const faceW = W + 2 * tabW;      // total face width inc. tabs (ref: 521)
  const faceH = H + 2 * T;         // total face height          (ref: 306)

  // ─── Tab height: fixed at 20T, but clamped so layout stays valid ───
  const maxTabH = Math.max(0, (faceH - D - 2 * T) / 2);
  const tabH = Math.min(20 * T, maxTabH);   // ref: 60

  // Segment = remaining space in face after tabs + depth strip
  const seg = Math.max(T, (faceH - D - 2 * tabH) / 2);

  // ─── Back panel / tongue X ───
  const backInset  = tabW + T / 2;                   // ref: 12
  const backW      = faceW - 2 * backInset;           // ref: 497
  const tongueInset = T;                               // ref: 3
  const tongueW    = faceW - 2 * tongueInset;         // ref: 515
  const flapTaper  = 0.8967;  // arc taper ratio from DXF

  // ═══════════════════════════════════════════════
  // X breakpoints: [referenceValue, newValue]
  // Layout: ear | glueFl | trans | depth | face(tab+main+tab) | depth | trans | glueFl | ear
  // ═══════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════
  // Y breakpoints: [referenceValue, newValue]
  // Layout (bottom→top): botFlap | seg | tab | depthStrip | tab | seg | depthStrip | gap | backPanel | gap | tongue
  // ═══════════════════════════════════════════════
  const yMap = [
    [-80,    -D],
    [0,      0],
    [53,     seg],
    [113,    seg + tabH],
    [193,    seg + tabH + D],
    [253,    seg + 2 * tabH + D],
    [306,    faceH],
    [386,    faceH + D],
    [387.5,  faceH + D + (backGap - T) / 2 + T / 2],
    [392,    faceH + D + backGap],
    [692,    faceH + D + backGap + H],
    [696.5,  faceH + D + backGap + H + (tongueGap - T) / 2 + T / 2],
    [698,    faceH + D + backGap + H + tongueGap],
    [778,    faceH + D + backGap + H + tongueGap + D],
  ];

  // ═══════════════════════════════════════════════
  // Back-panel / tongue X breakpoints (narrower, different insets)
  // ═══════════════════════════════════════════════
  const xMapBack = [
    [-68,    backInset - D],
    [-59.7,  backInset - D * flapTaper],
    [12,     backInset],
    [509,    backInset + backW],
    [580.7,  backInset + backW + D * flapTaper],
    [589,    backInset + backW + D],
  ];

  // ─── Piecewise linear interpolation (with extrapolation at edges) ───
  function interpolate(val, map) {
    if (map.length === 0) return val;

    if (val <= map[0][0]) {
      const [r0, n0] = map[0];
      const [r1, n1] = map[1] || map[0];
      if (Math.abs(r1 - r0) < 1e-10) return n0;
      return n0 + (val - r0) * (n1 - n0) / (r1 - r0);
    }
    if (val >= map[map.length - 1][0]) {
      const [r0, n0] = map[map.length - 2] || map[map.length - 1];
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
   * Context-aware: back panel / tongue area uses narrower X mapping.
   */
  return function scalePoint(x, y) {
    const newY = interpolate(y, yMap);

    let newX;
    if (y > 386) {
      // Back panel + tongue region: merge outer X + back-specific X
      const mergedX = [
        ...xMap.filter(([rx]) => rx <= -83 || rx >= 604),
        ...xMapBack,
        [0,   0],
        [3,   tongueInset],
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
 * @param {{ cut: number[][][], crease: number[][][] }} dxfData
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
