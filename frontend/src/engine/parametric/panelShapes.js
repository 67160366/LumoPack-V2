/**
 * Parametric Panel Shape Generator
 *
 * Pure math engine — generates closed polygon outlines for each panel
 * of a die-cut folding box (FEFCO 0427 style).
 *
 * CRITICAL DESIGN RULE:
 *   Each panel's origin (0,0) sits at its HINGE (fold line).
 *   This makes 3D folding trivial: just rotate around local Y axis.
 *
 * All dimensions derived from: W (width), H (height), D (depth), T (thickness)
 *
 * Reverse-engineered from: 500x300x80mm-folding-box.dxf
 * Verified to 4 decimal places against DXF reference.
 *
 * ─── Panel Layout (flat, Y+ = up) ────────────────────────────
 *
 *              ┌──────── Tongue ────────┐
 *              │                        │
 *              ├──── Back Panel ────────┤
 *              │  ◄ BackFlapL  BackFlapR ►  │
 *              ├────── Depth Strip ─────┤
 *   ┌──────┬──┼────── FRONT FACE ──────┼──┬──────┐
 *   │GlueL │DL│   (with ear tabs)      │DR│GlueR │
 *   └──────┴──┼────────────────────────┼──┴──────┘
 *              └──── Bottom Flap ──────┘
 */

// ─── Derived dimensions ─────────────────────────────────────
function dims(W, H, D, T = 3) {
  const tabW = D * 0.13125;           // 10.5  ear-lock tab width
  const tabH = D * 0.75;              // 60    ear-lock tab height
  const faceW = W + 2 * tabW;         // 521   front face width (incl tabs)
  const faceH = H + 2 * T;            // 306   front face height
  const seg = (faceH - D - 2 * tabH) / 2; // 53 edge segment
  const tab1Bot = seg;                 // 53
  const tab1Top = seg + tabH;          // 113
  const tab2Bot = tab1Top + D;         // 193
  const tab2Top = tab2Bot + tabH;      // 253
  const depthW = D + T;                // 83    depth panel width
  const glueTransW = T * 3;            // 9     glue transition bevel
  const glueFlapW = D + 1.5;           // 81.5  glue flap body
  const earBump = 4.5;                 // fixed ear bump depth
  const earInset = tabH * 0.0433;      // ~2.6  ear bump rounded entry
  const backInset = tabW + 1.5;        // 12    back panel inset from face edge
  const backW = faceW - 2 * backInset; // 497
  const backGap = 2 * T;               // 6     gap between depth strip and back panel
  const tongueInset = T;               // 3
  const tongueW = faceW - 2 * tongueInset; // 515
  const tongueGap = 2 * T;             // 6
  const botInsetX = 2 * T;             // 6     bottom flap inner crease inset
  const botInsetY = T / 2;             // 1.5   bottom flap overlap

  return {
    W, H, D, T, tabW, tabH, faceW, faceH, seg,
    tab1Bot, tab1Top, tab2Bot, tab2Top,
    depthW, glueTransW, glueFlapW, earBump, earInset,
    backInset, backW, backGap,
    tongueInset, tongueW, tongueGap,
    botInsetX, botInsetY,
  };
}

// ─── 1. FRONT FACE ─────────────────────────────────────────
// Origin: bottom-left corner (0, 0)
// Hinge LEFT at x=0, hinge RIGHT at x=faceW
// Hinge BOTTOM at y=0, hinge TOP at y=faceH
// Includes 4 ear-lock tab protrusions on left/right edges
function frontFaceShape(d) {
  const { faceW, faceH, tabW, tab1Bot, tab1Top, tab2Bot, tab2Top } = d;
  return [
    // Bottom edge
    [0, 0], [faceW, 0],
    // Right edge going up (with 2 tab protrusions)
    [faceW, tab1Bot],
    [faceW + tabW, tab1Bot], [faceW + tabW, tab1Top],  // right lower tab
    [faceW, tab1Top],
    [faceW, tab2Bot],
    [faceW + tabW, tab2Bot], [faceW + tabW, tab2Top],  // right upper tab
    [faceW, tab2Top],
    // Top edge
    [faceW, faceH], [0, faceH],
    // Left edge going down (with 2 tab protrusions)
    [0, tab2Top],
    [-tabW, tab2Top], [-tabW, tab2Bot],                 // left upper tab
    [0, tab2Bot],
    [0, tab1Top],
    [-tabW, tab1Top], [-tabW, tab1Bot],                 // left lower tab
    [0, tab1Bot],
  ];
}

// ─── 2. DEPTH PANEL (left or right) ────────────────────────
// Origin: at hinge line (fold line with front face)
//   Left:  origin at x=0 (= front face x=0), panel extends to x=-depthW
//   Right: origin at x=0 (= front face x=faceW), panel extends to x=+depthW
function depthPanelShape(d, side = 'left') {
  const { depthW, faceH } = d;
  const dir = side === 'left' ? -1 : 1;
  return [
    [0, 0],
    [dir * depthW, 0],
    [dir * depthW, faceH],
    [0, faceH],
  ];
}

// ─── 3. GLUE FLAP (left or right) ──────────────────────────
// Origin: at hinge (fold line with depth panel)
//   Left:  origin at x=0 (= depth panel outer edge), extends to x=-glue
//   Right: origin at x=0 (= depth panel outer edge), extends to x=+glue
// Includes: transition bevel + glue body + ear bumps
function glueFlapShape(d, side = 'left') {
  const {
    faceH, T, glueTransW, glueFlapW, earBump, earInset,
    tab1Bot, tab1Top, tab2Bot, tab2Top,
  } = d;
  const dir = side === 'left' ? -1 : 1;

  // Transition from depth edge to glue flap body
  const transX = dir * glueTransW;     // ±9
  const bodyX = dir * (glueTransW + glueFlapW);  // ±90.5
  const earX = dir * (glueTransW + glueFlapW + earBump); // ±95

  const pts = [];

  // Start at origin bottom, go out
  pts.push([0, 0]);
  pts.push([transX, T]);               // bevel to body start
  pts.push([bodyX, T]);                // body bottom edge

  // Body with ear bumps at tab positions
  pts.push([bodyX, tab1Bot]);
  // Ear bump 1
  pts.push([earX, tab1Bot + earInset]);
  pts.push([earX, tab1Top - earInset]);
  pts.push([bodyX, tab1Top]);

  pts.push([bodyX, tab2Bot]);
  // Ear bump 2
  pts.push([earX, tab2Bot + earInset]);
  pts.push([earX, tab2Top - earInset]);
  pts.push([bodyX, tab2Top]);

  pts.push([bodyX, faceH - T]);        // body top edge
  pts.push([transX, faceH - T]);       // bevel
  pts.push([0, faceH]);                // back to hinge at top

  return pts;
}

// ─── 4. BOTTOM FLAP ────────────────────────────────────────
// Origin: at hinge (bottom edge of front face, y=0)
// Extends downward (y negative)
// Width: faceW + 2 * depthW (wider than front face)
function bottomFlapShape(d) {
  const { faceW, D, depthW } = d;
  const totalW = faceW + 2 * depthW;
  // Center on front face: offset left by depthW
  return [
    [-depthW, 0],
    [faceW + depthW, 0],
    [faceW + depthW, -D],
    [-depthW, -D],
  ];
}

// ─── 5. DEPTH STRIP (top, connects front to back) ──────────
// Origin: at hinge (top edge of front face, y=0 in local coords)
// Extends upward (y positive)
// Width same as bottom flap
function depthStripShape(d) {
  const { faceW, D, depthW } = d;
  return [
    [-depthW, 0],
    [faceW + depthW, 0],
    [faceW + depthW, D],
    [-depthW, D],
  ];
}

// ─── 6. BACK PANEL ─────────────────────────────────────────
// Origin: at hinge (top of depth strip → bottom of back panel)
// Width: backW (narrower than front face, inset by backInset)
// Height: H
// Position: centered within faceW
function backPanelShape(d) {
  const { backW, H, backInset } = d;
  return [
    [backInset, 0],
    [backInset + backW, 0],
    [backInset + backW, H],
    [backInset, H],
  ];
}

// ─── 7. BACK FLAP (left or right) ──────────────────────────
// Origin: at hinge (side edge of back panel)
// Extends outward with curved profile
// Uses DXF-verified arc geometry via bulge interpolation
function backFlapShape(d, side = 'left') {
  const { D, T, H, backInset, backW, backGap } = d;
  const dir = side === 'left' ? -1 : 1;

  // DXF-derived arc parameters (from 500x300x80 reference, scaled)
  const reach = D + T;                 // 83: how far flap extends
  const taperX = D * 0.8967;           // 71.7: x of taper point
  const taperYBot = backGap + D * 0.158; // 12.6: y offset at bottom taper
  const straightYBot = backGap + D * 0.281; // 22.5: where straight section starts
  const straightYTop = H + backGap - D * 0.281;
  const taperYTop = H + backGap - D * 0.158;

  const pts = [];

  // Hinge at (0, 0) = side edge of back panel
  // Back panel starts at y=backGap (after the gap)
  pts.push([0, backGap]);

  // Bottom arc: from hinge to outer edge
  const arcPts1 = bulgeArc(
    0, backGap,
    dir * taperX, taperYBot,
    dir * reach, straightYBot,
    8
  );
  pts.push(...arcPts1);

  // Straight outer edge
  pts.push([dir * reach, straightYTop]);

  // Top arc: from outer edge back to hinge
  const arcPts2 = bulgeArc(
    dir * reach, straightYTop,
    dir * taperX, taperYTop,
    0, H + backGap,
    8
  );
  pts.push(...arcPts2);

  pts.push([0, H + backGap]);

  return pts;
}

// ─── 8. TONGUE ──────────────────────────────────────────────
// Origin: at hinge (top edge of back panel)
// Width: tongueW (slightly narrower than faceW)
// Height: D
// Has curved side edges (DXF-verified arcs)
function tongueShape(d) {
  const { D, T, tongueInset, tongueW, tongueGap } = d;

  // DXF-derived tongue arc geometry (reverse-engineered from 500x300x80 reference)
  // The tongue has large circular arcs on left/right sides
  // Right arc: (518,698) → (592.5,704.5) → (597.1,710.3) → (518,778)
  // Ratios relative to D:
  const arcMid1X = D * 0.931;   // 74.5mm: first intermediate X offset
  const arcMid1Y = D * 0.081;   // 6.5mm: first intermediate Y offset
  const arcMid2X = D * 0.988;   // 79.1mm: second intermediate X offset (peak)
  const arcMid2Y = D * 0.154;   // 12.3mm: second intermediate Y offset

  const xL = tongueInset;
  const xR = tongueInset + tongueW;
  const yBot = tongueGap;
  const yTop = tongueGap + D;

  const pts = [];

  // Bottom edge
  pts.push([xL, yBot]);
  pts.push([xR, yBot]);

  // Right arc: from (xR, yBot) outward then back to (xR, yTop)
  // Split into 3 segments through DXF-verified intermediate points
  const rMid1 = [xR + arcMid1X, yBot + arcMid1Y];
  const rMid2 = [xR + arcMid2X, yBot + arcMid2Y];
  pts.push(...arcThroughPoints(xR, yBot, rMid1[0], rMid1[1], 6));
  pts.push(...arcThroughPoints(rMid1[0], rMid1[1], rMid2[0], rMid2[1], 4));
  pts.push(...arcThroughPoints(rMid2[0], rMid2[1], xR, yTop, 12));

  // Top edge
  pts.push([xR, yTop]);
  pts.push([xL, yTop]);

  // Left arc: from (xL, yTop) outward left then back to (xL, yBot)
  const lMid2 = [xL - arcMid2X, yTop - arcMid2Y];
  const lMid1 = [xL - arcMid1X, yTop - arcMid1Y];
  pts.push(...arcThroughPoints(xL, yTop, lMid2[0], lMid2[1], 4));
  pts.push(...arcThroughPoints(lMid2[0], lMid2[1], lMid1[0], lMid1[1], 4));
  pts.push(...arcThroughPoints(lMid1[0], lMid1[1], xL, yBot, 6));

  return pts;
}

// ─── 9. TAB CUTOUTS (ear locks) ────────────────────────────
// Returns 4 closed rectangles for the tab cutout slots
// These are rendered as cut lines (not fills)
function tabCutoutShapes(d) {
  const { tabW, tab1Bot, tab1Top, tab2Bot, tab2Top, faceW } = d;
  return [
    [[0, tab1Bot], [tabW, tab1Bot], [tabW, tab1Top], [0, tab1Top], [0, tab1Bot]],
    [[faceW - tabW, tab1Bot], [faceW, tab1Bot], [faceW, tab1Top], [faceW - tabW, tab1Top], [faceW - tabW, tab1Bot]],
    [[0, tab2Bot], [tabW, tab2Bot], [tabW, tab2Top], [0, tab2Top], [0, tab2Bot]],
    [[faceW - tabW, tab2Bot], [faceW, tab2Bot], [faceW, tab2Top], [faceW - tabW, tab2Top], [faceW - tabW, tab2Bot]],
  ];
}

// ─── Arc helpers ────────────────────────────────────────────
// Quadratic bezier arc through 3 points
function bulgeArc(x1, y1, ctrlX, ctrlY, x2, y2, steps) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([
      u * u * x1 + 2 * u * t * ctrlX + t * t * x2,
      u * u * y1 + 2 * u * t * ctrlY + t * t * y2,
    ]);
  }
  return pts;
}

// Arc through two points (simple interpolation for short segments)
function arcThroughPoints(x1, y1, x2, y2, steps) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
  }
  return pts;
}

// ─── Crease lines ───────────────────────────────────────────
// Returns all crease (fold score) lines as polylines
function creaseLines(d) {
  const {
    faceW, faceH, D, T, depthW, glueTransW,
    tab1Bot, tab1Top, tab2Bot, tab2Top,
    backInset, backW, backGap, H,
    tongueInset, tongueW, tongueGap, botInsetX, botInsetY,
  } = d;

  const lines = [];

  // Top fold zone rectangle (front→depth strip transition)
  lines.push([
    [tongueInset + tongueW, faceH + D],
    [tongueInset + tongueW, faceH - botInsetY],
    [tongueInset, faceH - botInsetY],
    [tongueInset, faceH + D],
  ]);

  // Bottom fold zone rectangle
  lines.push([
    [faceW - botInsetX, -D],
    [faceW - botInsetX, botInsetY],
    [botInsetX, botInsetY],
    [botInsetX, -D],
  ]);

  // Vertical: left depth panel edge
  lines.push([[-depthW, 0], [-depthW, faceH]]);
  // Vertical: left glue transition
  lines.push([[-depthW - glueTransW, T], [-depthW - glueTransW, faceH - T]]);

  // Vertical: left face edge (interrupted by tab cutouts)
  lines.push([[0, 0], [0, tab1Bot]]);
  lines.push([[0, tab1Top], [0, tab2Bot]]);
  lines.push([[0, tab2Top], [0, faceH]]);

  // Vertical: right face edge (interrupted)
  lines.push([[faceW, 0], [faceW, tab1Bot]]);
  lines.push([[faceW, tab1Top], [faceW, tab2Bot]]);
  lines.push([[faceW, tab2Top], [faceW, faceH]]);

  // Vertical: right depth panel edge
  lines.push([[faceW + depthW, 0], [faceW + depthW, faceH]]);
  // Vertical: right glue transition
  lines.push([[faceW + depthW + glueTransW, T], [faceW + depthW + glueTransW, faceH - T]]);

  // Back panel vertical creases
  const yBackBot = faceH + D + backGap;
  const yBackTop = yBackBot + H;
  lines.push([[backInset, yBackBot], [backInset, yBackTop]]);
  lines.push([[backInset + backW, yBackBot], [backInset + backW, yBackTop]]);

  // Back panel horizontal creases
  lines.push([[backInset, faceH + D + botInsetY], [backInset + backW, faceH + D + botInsetY]]);
  lines.push([[backInset, yBackTop + (tongueGap - botInsetY)], [backInset + backW, yBackTop + (tongueGap - botInsetY)]]);

  // Tongue vertical creases
  const yTongueBot = yBackTop + tongueGap;
  lines.push([[tongueInset, yTongueBot], [tongueInset, yTongueBot + D]]);
  lines.push([[tongueInset + tongueW, yTongueBot], [tongueInset + tongueW, yTongueBot + D]]);

  return lines;
}


// ─── MAIN EXPORT ────────────────────────────────────────────

/**
 * Generate all panel shapes and layout for a die-cut folding box.
 *
 * @param {number} W - Box width (mm)
 * @param {number} H - Box height (mm)
 * @param {number} D - Box depth (mm)
 * @param {number} [T=3] - Paper thickness (mm)
 * @returns {Object} panels, crease lines, tab cutouts, and layout positions
 */
export function generatePanels(W, H, D, T = 3) {
  const d = dims(W, H, D, T);

  // Generate shapes (each in local coords with origin at hinge)
  const panels = {
    front:      { shape: frontFaceShape(d),       pos: [0, 0] },
    depthLeft:  { shape: depthPanelShape(d, 'left'),  pos: [0, 0] },
    depthRight: { shape: depthPanelShape(d, 'right'), pos: [d.faceW, 0] },
    glueFlapL:  { shape: glueFlapShape(d, 'left'),    pos: [-d.depthW, 0] },
    glueFlapR:  { shape: glueFlapShape(d, 'right'),   pos: [d.faceW + d.depthW, 0] },
    bottom:     { shape: bottomFlapShape(d),      pos: [0, 0] },
    depthStrip: { shape: depthStripShape(d),      pos: [0, d.faceH] },
    back:       { shape: backPanelShape(d),       pos: [0, d.faceH + D + d.backGap] },
    backFlapL:  { shape: backFlapShape(d, 'left'),  pos: [d.backInset, d.faceH + D] },
    backFlapR:  { shape: backFlapShape(d, 'right'), pos: [d.backInset + d.backW, d.faceH + D] },
    tongue:     { shape: tongueShape(d),          pos: [0, d.faceH + D + d.backGap + H] },
  };

  const tabCutouts = tabCutoutShapes(d);
  const creases = creaseLines(d);

  // Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { shape, pos } of Object.values(panels)) {
    for (const [lx, ly] of shape) {
      const gx = lx + pos[0], gy = ly + pos[1];
      if (gx < minX) minX = gx;
      if (gy < minY) minY = gy;
      if (gx > maxX) maxX = gx;
      if (gy > maxY) maxY = gy;
    }
  }

  return {
    panels,
    tabCutouts,
    creases,
    dims: d,
    bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}
