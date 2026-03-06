/**
 * Parametric Folding Box Engine
 *
 * Generates 2D dieline geometry for a die-cut folding box (FEFCO 0427 style).
 * All coordinates are derived mathematically from W, H, D, T parameters.
 *
 * Reference: 500x300x80mm-folding-box.dxf (ground truth)
 *
 * Coordinate system:
 *   Origin (0,0) = bottom-left corner of the FRONT FACE
 *   X+ = right, Y+ = up (for the front face)
 *   Y- = bottom flap, Y+ beyond faceH = depth strip → back panel → tongue
 *
 * Output layers:
 *   "cut"    = die-cut outlines (red)
 *   "crease" = fold/score lines (green)
 */

// ─── Arc utility ───────────────────────────────────────────────
// Approximate a circular arc with line segments
function arcPoints(cx, cy, r, startAngle, endAngle, segments = 12) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = startAngle + (endAngle - startAngle) * (i / segments);
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return pts;
}

/**
 * Generate the complete dieline for a folding box.
 *
 * @param {number} W - Box width (mm), e.g. 500
 * @param {number} H - Box height (mm), e.g. 300
 * @param {number} D - Box depth (mm), e.g. 80
 * @param {number} [T=3] - Paper/board thickness (mm)
 * @returns {{ cut: number[][][], crease: number[][][], panels: Object, bounds: Object }}
 */
export function generateFoldingBoxDieline(W, H, D, T = 3) {
  // ─── Core derived dimensions ───────────────────────────────

  // Front face
  const faceH = H + 2 * T;                    // 306mm: height + thickness compensation
  const tabW = D * 0.13125;                    // 10.5mm: side tab protrusion width
  const tabH = D * 0.75;                       // 60mm: tab cutout height
  const faceW = W + 2 * tabW;                  // 521mm: front face total width

  // Tab positions (from bottom of front face)
  const seg = (faceH - D - 2 * tabH) / 2;     // 53mm: edge segment above/below tabs
  const tab1Bot = seg;                         // 53: lower tab bottom
  const tab1Top = seg + tabH;                  // 113: lower tab top
  const tab2Bot = tab1Top + D;                 // 193: upper tab bottom
  const tab2Top = tab2Bot + tabH;              // 253: upper tab top

  // Side depth panels
  const depthW = D + T;                        // 83mm: depth panel width

  // Glue flap (left & right side panels)
  const glueTransW = T * 3;                    // 9mm: transition bevel
  const glueFlapW = D + 1.5;                   // 81.5mm: glue flap body width
  const earBump = 4.5;                         // 4.5mm: ear bump extra depth
  const earR = earBump;                        // radius for ear bumps

  // Bottom flap
  const botFlapH = D;                          // 80mm
  const botInsetX = 6;                         // 6mm inset from face edges
  const botInsetY = 1.5;                       // 1.5mm overlap at fold

  // Back panel (above front, through depth strip)
  const depthStripH = D;                       // 80mm depth strip
  const backInset = tabW + 1.5;                // 12mm: back panel inset from face edge
  const backW = faceW - 2 * backInset;         // 497mm
  const backH = H;                             // 300mm
  const backGap = 2 * T;                       // 6mm gap between depth strip crease and back panel

  // Y positions for back panel area
  const yDepthTop = faceH + depthStripH;       // 386: top of depth strip
  const yBackBot = yDepthTop + backGap;        // 392: back panel bottom
  const yBackTop = yBackBot + backH;           // 692: back panel top

  // Tongue
  const tongueInset = T;                       // 3mm inset from face edges
  const tongueW = faceW - 2 * tongueInset;     // 515mm
  const tongueGap = 2 * T;                     // 6mm gap
  const yTongueBot = yBackTop + tongueGap;     // 698
  const tongueH = D;                           // 80mm
  const yTongueTop = yTongueBot + tongueH;     // 778

  // Back flap arc geometry
  const backFlapReach = D;                     // how far flaps extend from back panel
  const arcInsetX = D * 0.28;                  // ~22.4mm: horizontal taper
  const arcInsetY = D * 0.16;                  // ~12.6mm: vertical taper
  const arcBulgeR = D * 0.12;                  // curve radius for back flap arcs

  // ─── Build cut polylines ───────────────────────────────────
  const cut = [];
  const crease = [];

  // === 1. MAIN OUTLINE (top half: front face top → depth strip → back panel → back flaps → tongue) ===
  const mainOutline = [];

  // Start at right depth panel top-right
  mainOutline.push([faceW + depthW, faceH]);
  // Go up to depth strip top
  mainOutline.push([faceW + depthW, yDepthTop]);
  // Across to back panel right edge area
  mainOutline.push([faceW - backInset + backInset, yDepthTop]); // x=509+... actually

  // Let me build this more precisely section by section:

  // ─── 1a. RIGHT side of top outline ───
  // From depth panel top-right, up through back flap
  const rightOutline = [];
  rightOutline.push([faceW + depthW, faceH]);          // (604, 306)
  rightOutline.push([faceW + depthW, yDepthTop]);       // (604, 386)
  rightOutline.push([backInset + backW, yDepthTop]);     // (509, 386)
  rightOutline.push([backInset + backW, yBackBot]);      // (509, 392)

  // Right back flap arc (bottom curve: from back panel edge outward)
  const rbArcCx = backInset + backW + arcInsetX;
  const rbArcCy1 = yBackBot + arcInsetY;
  rightOutline.push(...arcPoints(
    backInset + backW, yBackBot + arcInsetY,
    arcInsetX, 0, Math.PI / 6, 6
  ).map(([x, y]) => [
    backInset + backW + (x - (backInset + backW)),
    y
  ]));

  // Actually, let me trace the DXF more faithfully
  // The right back flap goes: (509,392) → arc → (580.7, 404.6) → (589, 414.5) → (589, 669.5) → arc → (580.7, 679.4) → (509, 692)

  // I'll compute these relative to the back panel
  const bfOuterX = backInset + backW + backFlapReach + T; // 589 = 509 + 80
  const bfTaperX = backInset + backW + backFlapReach - arcInsetX; // 580.7 ≈ 509 + 71.7
  const bfTaperYBot = yBackBot + arcInsetY;               // 404.6 ≈ 392 + 12.6
  const bfStraightYBot = yBackBot + arcInsetY + D * 0.14; // 414.5 ≈ 392 + 22.5
  const bfStraightYTop = yBackTop - arcInsetY - D * 0.14; // 669.5 ≈ 692 - 22.5
  const bfTaperYTop = yBackTop - arcInsetY;                // 679.4 ≈ 692 - 12.6

  // Clear and rebuild right outline precisely
  rightOutline.length = 0;
  rightOutline.push(
    [faceW + depthW, faceH],
    [faceW + depthW, yDepthTop],
    [backInset + backW, yDepthTop],
    [backInset + backW, yBackBot],
  );

  // Back flap right - smooth curve from (509,392) to (589,414.5) via (580.7, 404.6)
  // Using quadratic bezier approximation with line segments
  const bfRightPts = generateBackFlapArc(
    backInset + backW, yBackBot,
    bfOuterX, bfStraightYBot,
    bfTaperX, bfTaperYBot,
    0.3639702 // DXF bulge factor
  );
  rightOutline.push(...bfRightPts);

  // Straight section of back flap
  rightOutline.push([bfOuterX, bfStraightYTop]);

  // Top arc of back flap
  const bfRightTopPts = generateBackFlapArc(
    bfOuterX, bfStraightYTop,
    backInset + backW, yBackTop,
    bfTaperX, bfTaperYTop,
    0.3639702
  );
  rightOutline.push(...bfRightTopPts);

  // Continue to tongue area
  rightOutline.push(
    [backInset + backW, yBackTop],
    [backInset + backW, yTongueBot - tongueGap + tongueGap], // (509, 698)
    [tongueInset + tongueW, yTongueBot],                      // (518, 698)
  );

  // Tongue right side arc
  const tongueArcR = generateTongueArc(
    tongueInset + tongueW, yTongueBot,
    tongueInset + tongueW, yTongueTop,
    D * 0.2, // arc control offset
    0.3697994
  );
  rightOutline.push(...tongueArcR);
  rightOutline.push([tongueInset + tongueW, yTongueTop]); // (518, 778)

  // ─── 1b. LEFT side of top outline (mirror) ───
  const leftOutline = [];
  leftOutline.push([tongueInset, yTongueTop]);  // (3, 778)

  // Tongue left side arc
  const tongueArcL = generateTongueArc(
    tongueInset, yTongueTop,
    tongueInset, yTongueBot,
    D * 0.2,
    0.3697994
  );
  leftOutline.push(...tongueArcL);
  leftOutline.push([tongueInset, yTongueBot]); // (3, 698)

  // Back to back panel
  leftOutline.push(
    [backInset, yTongueBot],                      // (12, 698)
    [backInset, yBackTop],                         // (12, 692)
  );

  // Left back flap top arc
  const bfLeftX = backInset - backFlapReach - T;   // -68
  const bfLeftTaperX = backInset - backFlapReach + arcInsetX; // -59.7

  const bfLeftTopPts = generateBackFlapArc(
    backInset, yBackTop,
    bfLeftX, bfStraightYTop,
    bfLeftTaperX, bfTaperYTop,
    0.3639702
  );
  leftOutline.push(...bfLeftTopPts);

  leftOutline.push([bfLeftX, bfStraightYBot]);

  // Left back flap bottom arc
  const bfLeftBotPts = generateBackFlapArc(
    bfLeftX, bfStraightYBot,
    backInset, yBackBot,
    bfLeftTaperX, bfTaperYBot,
    0.3639702
  );
  leftOutline.push(...bfLeftBotPts);

  leftOutline.push(
    [backInset, yBackBot],
    [backInset, yDepthTop],                        // (12, 386)
    [-depthW, yDepthTop],                          // (-83, 386)
    [-depthW, faceH],                              // (-83, 306)
  );

  // Combine top outline (right side → across top → left side)
  const topOutline = [...rightOutline, ...leftOutline];
  cut.push(topOutline);

  // === 2. BOTTOM FLAP outline ===
  cut.push([
    [faceW + depthW, 0],
    [faceW + depthW, -botFlapH],
    [-depthW, -botFlapH],
    [-depthW, 0],
  ]);

  // === 3. LEFT GLUE FLAP + DEPTH PANEL outline ===
  const leftGlueCut = buildGlueFlapOutline(
    0, faceH, -depthW, -depthW - glueTransW,
    -depthW - glueTransW - glueFlapW, earBump,
    tab1Bot, tab1Top, tab2Bot, tab2Top, T, 'left'
  );
  cut.push(leftGlueCut);

  // === 4. RIGHT GLUE FLAP + DEPTH PANEL outline ===
  const rightGlueCut = buildGlueFlapOutline(
    faceW, faceH, faceW + depthW, faceW + depthW + glueTransW,
    faceW + depthW + glueTransW + glueFlapW, earBump,
    tab1Bot, tab1Top, tab2Bot, tab2Top, T, 'right'
  );
  cut.push(rightGlueCut);

  // === 5. FRONT FACE tab cutouts (closed rectangles) ===
  // These are the rectangular ear-lock tab protrusions that are CUT from the sheet
  const tabCutouts = [
    // Left lower tab
    [[0, tab1Bot], [tabW, tab1Bot], [tabW, tab1Top], [0, tab1Top], [0, tab1Bot]],
    // Right lower tab
    [[faceW - tabW, tab1Bot], [faceW, tab1Bot], [faceW, tab1Top], [faceW - tabW, tab1Top], [faceW - tabW, tab1Bot]],
    // Left upper tab
    [[0, tab2Bot], [tabW, tab2Bot], [tabW, tab2Top], [0, tab2Top], [0, tab2Bot]],
    // Right upper tab
    [[faceW - tabW, tab2Bot], [faceW, tab2Bot], [faceW, tab2Top], [faceW - tabW, tab2Top], [faceW - tabW, tab2Bot]],
  ];
  tabCutouts.forEach(tc => cut.push(tc));

  // ─── Build crease polylines ────────────────────────────────

  // Top fold zone (front face top → depth strip)
  crease.push([
    [tongueInset + tongueW, yDepthTop],  // (518, 386)
    [tongueInset + tongueW, faceH - botInsetY],  // (518, 304.5)
    [tongueInset, faceH - botInsetY],             // (3, 304.5)
    [tongueInset, yDepthTop],                     // (3, 386)
  ]);

  // Bottom fold zone
  crease.push([
    [faceW - botInsetX, -botFlapH],       // (515, -80)
    [faceW - botInsetX, botInsetY],       // (515, 1.5)
    [botInsetX, botInsetY],               // (6, 1.5)
    [botInsetX, -botFlapH],              // (6, -80)
  ]);

  // Vertical creases - left depth panel
  crease.push([[-depthW, 0], [-depthW, faceH]]);
  // Left glue flap transition
  crease.push([[-depthW - glueTransW, T], [-depthW - glueTransW, faceH - T]]);

  // Vertical creases - left face edge (interrupted by tab cutouts)
  crease.push([[0, 0], [0, tab1Bot]]);
  crease.push([[0, tab1Top], [0, tab2Bot]]);
  crease.push([[0, tab2Top], [0, faceH]]);

  // Vertical creases - right face edge (interrupted by tab cutouts)
  crease.push([[faceW, 0], [faceW, tab1Bot]]);
  crease.push([[faceW, tab1Top], [faceW, tab2Bot]]);
  crease.push([[faceW, tab2Top], [faceW, faceH]]);

  // Vertical creases - right depth panel
  crease.push([[faceW + depthW, 0], [faceW + depthW, faceH]]);
  // Right glue flap transition
  crease.push([[faceW + depthW + glueTransW, T], [faceW + depthW + glueTransW, faceH - T]]);

  // Back panel vertical creases
  crease.push([[backInset, yBackBot], [backInset, yBackTop]]);
  crease.push([[backInset + backW, yBackBot], [backInset + backW, yBackTop]]);

  // Back panel horizontal creases
  crease.push([[backInset, yDepthTop + botInsetY], [backInset + backW, yDepthTop + botInsetY]]);  // 387.5
  crease.push([[backInset, yBackTop + (tongueGap - botInsetY)], [backInset + backW, yBackTop + (tongueGap - botInsetY)]]); // 696.5

  // Tongue vertical creases
  crease.push([[tongueInset, yTongueBot], [tongueInset, yTongueTop]]);
  crease.push([[tongueInset + tongueW, yTongueBot], [tongueInset + tongueW, yTongueTop]]);

  // ─── Panel definitions (for 3D folding later) ──────────────
  const panels = {
    front: {
      x: 0, y: 0, w: faceW, h: faceH,
      tabs: { tabW, tabH, positions: [tab1Bot, tab2Bot] },
    },
    depthLeft: { x: -depthW, y: 0, w: depthW, h: faceH },
    depthRight: { x: faceW, y: 0, w: depthW, h: faceH },
    glueFlapLeft: { x: -depthW - glueTransW - glueFlapW, y: T, w: glueFlapW, h: H },
    glueFlapRight: { x: faceW + depthW + glueTransW, y: T, w: glueFlapW, h: H },
    bottom: { x: -depthW, y: -botFlapH, w: faceW + 2 * depthW, h: botFlapH },
    depthStrip: { x: 0, y: faceH, w: faceW, h: depthStripH },
    back: { x: backInset, y: yBackBot, w: backW, h: backH },
    tongue: { x: tongueInset, y: yTongueBot, w: tongueW, h: tongueH },
  };

  // ─── Bounds ────────────────────────────────────────────────
  const allPts = [...cut, ...crease].flat();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of allPts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const bounds = { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };

  return { cut, crease, panels, bounds, params: { W, H, D, T, faceW, faceH } };
}

// ─── Helper: Generate back flap arc transition ───────────────
// Approximates the DXF bulge arcs with bezier-like interpolation
function generateBackFlapArc(x1, y1, x2, y2, ctrlX, ctrlY, _bulge) {
  const pts = [];
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Quadratic bezier: B(t) = (1-t)^2*P0 + 2*(1-t)*t*P1 + t^2*P2
    const u = 1 - t;
    const x = u * u * x1 + 2 * u * t * ctrlX + t * t * x2;
    const y = u * u * y1 + 2 * u * t * ctrlY + t * t * y2;
    pts.push([x, y]);
  }
  return pts;
}

// ─── Helper: Generate tongue arc ─────────────────────────────
function generateTongueArc(x1, y1, x2, y2, offset, _bulge) {
  const pts = [];
  const steps = 8;
  // Control point bulges outward from the tongue edge
  const ctrlX = (x1 > (x1 + x2) / 2) ? x1 + offset : x1 - offset;
  const ctrlY = (y1 + y2) / 2;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * x1 + 2 * u * t * ctrlX + t * t * x2;
    const y = u * u * y1 + 2 * u * t * ctrlY + t * t * y2;
    pts.push([x, y]);
  }
  return pts;
}

// ─── Helper: Build glue flap outline ─────────────────────────
function buildGlueFlapOutline(
  faceEdgeX, faceH, depthEdgeX, transEdgeX, glueFarX,
  earBump, tab1Bot, tab1Top, tab2Bot, tab2Top, T, side
) {
  const isLeft = side === 'left';
  const earFarX = isLeft ? glueFarX - earBump : glueFarX + earBump;

  // Build from bottom to top
  const pts = [];

  if (isLeft) {
    // Start from front face bottom-left area
    pts.push([faceEdgeX + 6, 1.5]);        // (6, 1.5) for left
    pts.push([faceEdgeX, 0]);               // (0, 0)
    pts.push([depthEdgeX, 0]);              // (-83, 0)
    pts.push([transEdgeX, T]);              // (-92, 3)
    pts.push([glueFarX, T]);                // (-173.5, 3)

    // Glue flap body with ear bumps
    pts.push([glueFarX, tab1Bot]);           // (-173.5, 53)
    // Ear bump 1
    pts.push(...arcPoints(glueFarX, (tab1Bot + tab1Top) / 2, earBump, Math.PI, Math.PI, 1).slice(0, 0)); // placeholder
    pts.push([earFarX, tab1Bot + (tab1Top - tab1Bot) * 0.044]); // (-178, 55.6)
    pts.push([earFarX, tab1Top - (tab1Top - tab1Bot) * 0.044]); // (-178, 110.4)
    pts.push([glueFarX, tab1Top]);           // (-173.5, 113)

    pts.push([glueFarX, tab2Bot]);           // (-173.5, 193)
    // Ear bump 2
    pts.push([earFarX, tab2Bot + (tab2Top - tab2Bot) * 0.044]); // (-178, 195.6)
    pts.push([earFarX, tab2Top - (tab2Top - tab2Bot) * 0.044]); // (-178, 250.4)
    pts.push([glueFarX, tab2Top]);           // (-173.5, 253)

    pts.push([glueFarX, faceH - T]);        // (-173.5, 303)
    pts.push([transEdgeX, faceH - T]);      // (-92, 303)
    pts.push([depthEdgeX, faceH]);           // (-83, 306)
    pts.push([faceEdgeX, faceH]);            // (0, 306)
    pts.push([faceEdgeX + T, faceH - 1.5]); // (3, 304.5)
  } else {
    // Right side (mirror logic)
    pts.push([faceEdgeX - 6, 1.5]);          // (515, 1.5)
    pts.push([faceEdgeX, 0]);                 // (521, 0)
    pts.push([depthEdgeX, 0]);                // (604, 0)
    pts.push([transEdgeX, T]);                // (613, 3)
    pts.push([glueFarX, T]);                  // (694.5, 3)

    pts.push([glueFarX, tab1Bot]);
    pts.push([earFarX, tab1Bot + (tab1Top - tab1Bot) * 0.044]);
    pts.push([earFarX, tab1Top - (tab1Top - tab1Bot) * 0.044]);
    pts.push([glueFarX, tab1Top]);

    pts.push([glueFarX, tab2Bot]);
    pts.push([earFarX, tab2Bot + (tab2Top - tab2Bot) * 0.044]);
    pts.push([earFarX, tab2Top - (tab2Top - tab2Bot) * 0.044]);
    pts.push([glueFarX, tab2Top]);

    pts.push([glueFarX, faceH - T]);
    pts.push([transEdgeX, faceH - T]);
    pts.push([depthEdgeX, faceH]);
    pts.push([faceEdgeX, faceH]);
    pts.push([faceEdgeX - T, faceH - 1.5]);
  }

  return pts;
}

// ─── Convenience: Get DXF reference box ──────────────────────
export function getDxfReferenceBox() {
  return generateFoldingBoxDieline(500, 300, 80, 3);
}
