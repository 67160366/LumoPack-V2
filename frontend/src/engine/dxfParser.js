/**
 * DXF Parser — Extracts exact polylines from DXF files
 *
 * Handles:
 * - POLYLINE/VERTEX entities (open and closed)
 * - LINE entities
 * - Bulge factors (arc interpolation between vertices)
 * - Layer separation (cut vs crease)
 *
 * DXF bulge = tan(included_angle / 4)
 * Positive bulge = counterclockwise arc from current to next vertex
 */

/**
 * Convert a DXF bulge between two points into intermediate arc points.
 *
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 * @param {number} bulge - DXF bulge factor
 * @param {number} [segments=16] - Number of interpolation segments
 * @returns {number[][]} Array of [x, y] points along the arc (excluding start, including end)
 */
function bulgeToArcPoints(x1, y1, x2, y2, bulge, segments = 16) {
  if (Math.abs(bulge) < 1e-6) {
    return [[x2, y2]];
  }

  // Chord vector and length
  const dx = x2 - x1;
  const dy = y2 - y1;
  const chord = Math.sqrt(dx * dx + dy * dy);

  if (chord < 1e-10) return [[x2, y2]];

  // Sagitta (height of arc)
  const sagitta = Math.abs(bulge) * chord / 2;

  // Radius
  const radius = (chord * chord / 4 + sagitta * sagitta) / (2 * sagitta);

  // Included angle
  const includedAngle = 4 * Math.atan(Math.abs(bulge));

  // Midpoint of chord
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  // Unit vector along chord
  const ux = dx / chord;
  const uy = dy / chord;

  // Perpendicular unit vector (rotated 90 degrees CCW)
  const px = -uy;
  const py = ux;

  // Distance from midpoint to center
  const d = radius - sagitta;

  // Center of arc (direction depends on bulge sign)
  const sign = bulge > 0 ? 1 : -1;
  const cx = mx + sign * d * px;
  const cy = my + sign * d * py;

  // Start and end angles
  const startAngle = Math.atan2(y1 - cy, x1 - cx);
  const endAngle = Math.atan2(y2 - cy, x2 - cx);

  // Determine sweep direction
  let sweep = endAngle - startAngle;
  if (bulge > 0) {
    // CCW: sweep should be positive
    while (sweep < 0) sweep += 2 * Math.PI;
    if (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
  } else {
    // CW: sweep should be negative
    while (sweep > 0) sweep -= 2 * Math.PI;
    if (sweep < -2 * Math.PI) sweep += 2 * Math.PI;
  }

  // Generate arc points (skip start point, it's already in the polyline)
  const pts = [];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + sweep * t;
    pts.push([
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
    ]);
  }

  return pts;
}

/**
 * Parse a DXF string into structured polyline data.
 *
 * @param {string} dxfText - Raw DXF file content
 * @returns {{ cut: number[][][], crease: number[][][], bounds: Object }}
 */
export function parseDxf(dxfText) {
  const lines = dxfText.split(/\r?\n/).map(l => l.trim());
  const entities = { cut: [], crease: [] };

  // Map layer names to our categories (case-insensitive)
  function normalizeLayer(raw) {
    const l = (raw || '').toLowerCase();
    if (l === 'cut') return 'cut';
    if (l === 'crease' || l === 'valley' || l === 'mountain') return 'crease';
    return l; // fallback to raw lowercase
  }

  let i = 0;

  // Skip to ENTITIES section
  while (i < lines.length) {
    if (lines[i] === 'ENTITIES') break;
    i++;
  }
  i++;

  // Parse entities
  while (i < lines.length) {
    const code = lines[i];
    const value = lines[i + 1];

    if (code === '0' && value === 'EOF') break;
    if (code === '0' && value === 'ENDSEC') break;

    if (code === '0' && value === 'POLYLINE') {
      i += 2;
      const result = parsePolyline(lines, i);
      i = result.nextIndex;
      const layer = normalizeLayer(result.layer);
      if (entities[layer]) {
        entities[layer].push(result.points);
      }
    } else if (code === '0' && value === 'LINE') {
      i += 2;
      const result = parseLine(lines, i);
      i = result.nextIndex;
      const layer = normalizeLayer(result.layer);
      if (entities[layer]) {
        entities[layer].push(result.points);
      }
    } else {
      i++;
    }
  }

  // Compute bounds
  const allPts = [...entities.cut, ...entities.crease].flat();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of allPts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return {
    cut: entities.cut,
    crease: entities.crease,
    bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}

function parsePolyline(lines, i) {
  let layer = 'cut';
  let closed = false;
  const vertices = []; // { x, y, bulge }

  // Read polyline header attributes
  while (i < lines.length) {
    const code = lines[i];
    const value = lines[i + 1];

    if (code === '0') break; // Next entity type

    if (code === '8') {
      layer = value;
    } else if (code === '70') {
      closed = (parseInt(value) & 1) !== 0;
    }
    i += 2;
  }

  // Read vertices
  while (i < lines.length) {
    const code = lines[i];
    const value = lines[i + 1];

    if (code === '0' && value === 'SEQEND') {
      i += 2;
      // Skip any remaining SEQEND attributes
      while (i < lines.length && lines[i] !== '0') {
        i += 2;
      }
      break;
    }

    if (code === '0' && value === 'VERTEX') {
      i += 2;
      const v = { x: 0, y: 0, bulge: 0 };

      while (i < lines.length) {
        const vc = lines[i];
        const vv = lines[i + 1];
        if (vc === '0') break;

        if (vc === '10') v.x = parseFloat(vv);
        else if (vc === '20') v.y = parseFloat(vv);
        else if (vc === '42') v.bulge = parseFloat(vv);
        i += 2;
      }
      vertices.push(v);
    } else {
      i += 2;
    }
  }

  // Convert vertices + bulges into point arrays
  const points = [];
  for (let j = 0; j < vertices.length; j++) {
    const v = vertices[j];
    if (j === 0) {
      points.push([v.x, v.y]);
    }

    // If this vertex has a bulge, generate arc to next vertex
    if (j < vertices.length - 1) {
      const next = vertices[j + 1];
      if (Math.abs(v.bulge) > 1e-6) {
        const arcPts = bulgeToArcPoints(v.x, v.y, next.x, next.y, v.bulge);
        points.push(...arcPts);
      } else {
        points.push([next.x, next.y]);
      }
    }
  }

  // Handle closed polyline: arc from last vertex back to first
  if (closed && vertices.length > 0) {
    const last = vertices[vertices.length - 1];
    const first = vertices[0];
    if (Math.abs(last.bulge) > 1e-6) {
      const arcPts = bulgeToArcPoints(last.x, last.y, first.x, first.y, last.bulge);
      points.push(...arcPts);
    } else {
      points.push([first.x, first.y]);
    }
  }

  return { layer, points, closed, nextIndex: i };
}

function parseLine(lines, i) {
  let layer = 'crease';
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

  while (i < lines.length) {
    const code = lines[i];
    const value = lines[i + 1];
    if (code === '0') break;

    if (code === '8') layer = value;
    else if (code === '10') x1 = parseFloat(value);
    else if (code === '20') y1 = parseFloat(value);
    else if (code === '11') x2 = parseFloat(value);
    else if (code === '21') y2 = parseFloat(value);
    i += 2;
  }

  return { layer, points: [[x1, y1], [x2, y2]], nextIndex: i };
}
