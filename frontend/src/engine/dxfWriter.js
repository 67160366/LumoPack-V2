/**
 * DXF Writer — Converts scaled polyline data back to DXF format
 *
 * Takes the output of scaleDxfData() and generates a valid DXF file string
 * that can be imported into CAD software (AutoCAD, Illustrator, CorelDRAW, etc.)
 *
 * Output: DXF R12 format (most compatible)
 */

/**
 * Generate a DXF file string from scaled dieline data.
 *
 * @param {{ cut: number[][][], crease: number[][][] }} data - Scaled DXF data
 * @param {number} W - Box width in mm (for metadata)
 * @param {number} H - Box height in mm
 * @param {number} D - Box depth in mm
 * @returns {string} DXF file content
 */
export function generateDxf(data, W, H, D) {
  const lines = [];

  // Header section
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1009'); // R12
  lines.push('9', '$INSUNITS', '70', '4');     // mm
  lines.push('0', 'ENDSEC');

  // Tables section (layers)
  lines.push('0', 'SECTION', '2', 'TABLES');
  lines.push('0', 'TABLE', '2', 'LAYER', '70', '2');

  // Cut layer
  lines.push('0', 'LAYER');
  lines.push('2', 'cut');
  lines.push('70', '0');
  lines.push('62', '1');  // red
  lines.push('6', 'CONTINUOUS');

  // Crease layer
  lines.push('0', 'LAYER');
  lines.push('2', 'crease');
  lines.push('70', '0');
  lines.push('62', '3');  // green
  lines.push('6', 'DASHED');

  lines.push('0', 'ENDTAB');
  lines.push('0', 'ENDSEC');

  // Entities section
  lines.push('0', 'SECTION', '2', 'ENTITIES');

  // Write cut polylines
  for (const polyline of data.cut) {
    writePolyline(lines, polyline, 'cut');
  }

  // Write crease lines
  for (const polyline of data.crease) {
    if (polyline.length === 2) {
      // Simple LINE entity for 2-point segments
      writeLine(lines, polyline[0], polyline[1], 'crease');
    } else {
      writePolyline(lines, polyline, 'crease');
    }
  }

  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');

  return lines.join('\n');
}

function writePolyline(lines, points, layer) {
  if (!points || points.length < 2) return;

  // Check if closed (first ≈ last point)
  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = Math.abs(first[0] - last[0]) < 0.01 && Math.abs(first[1] - last[1]) < 0.01;

  lines.push('0', 'POLYLINE');
  lines.push('8', layer);
  lines.push('66', '1');         // vertices follow
  lines.push('70', isClosed ? '1' : '0');

  // Write vertices (skip last if closed, since DXF closes automatically)
  const count = isClosed ? points.length - 1 : points.length;
  for (let i = 0; i < count; i++) {
    lines.push('0', 'VERTEX');
    lines.push('8', layer);
    lines.push('10', points[i][0].toFixed(4));
    lines.push('20', points[i][1].toFixed(4));
    lines.push('30', '0');
  }

  lines.push('0', 'SEQEND');
  lines.push('8', layer);
}

function writeLine(lines, p1, p2, layer) {
  lines.push('0', 'LINE');
  lines.push('8', layer);
  lines.push('10', p1[0].toFixed(4));
  lines.push('20', p1[1].toFixed(4));
  lines.push('30', '0');
  lines.push('11', p2[0].toFixed(4));
  lines.push('21', p2[1].toFixed(4));
  lines.push('31', '0');
}

/**
 * Trigger browser download of a DXF file.
 *
 * @param {string} dxfContent - DXF file string
 * @param {string} [filename] - Download filename
 */
export function downloadDxf(dxfContent, filename = 'dieline.dxf') {
  const blob = new Blob([dxfContent], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
