/**
 * SVG Exporter — Generates downloadable SVG from scaled dieline data
 *
 * Produces a clean SVG with:
 * - Cut lines (red, solid)
 * - Crease/fold lines (green, dashed)
 * - Proper mm units and viewBox
 */

const CUT_COLOR = '#cc2222';
const CREASE_COLOR = '#22aa44';

function polylineToPath(points) {
  if (!points || points.length < 2) return '';
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${(-y).toFixed(2)}`)
    .join(' ');
}

/**
 * Generate an SVG string from scaled dieline data.
 *
 * @param {{ cut: number[][][], crease: number[][][], bounds: Object }} data
 * @param {number} W - Box width mm
 * @param {number} H - Box height mm
 * @param {number} D - Box depth mm
 * @returns {string} SVG file content
 */
export function generateSvg(data, W, H, D) {
  const { bounds } = data;
  const pad = Math.max(bounds.width, bounds.height) * 0.05;
  const vx = bounds.minX - pad;
  const vy = -(bounds.maxY + pad);
  const vw = bounds.width + pad * 2;
  const vh = bounds.height + pad * 2;

  const strokeW = Math.max(0.3, vw * 0.001);
  const dash = `${vw * 0.005} ${vw * 0.003}`;

  const cutPaths = data.cut.map(poly =>
    `<path d="${polylineToPath(poly)}" fill="none" stroke="${CUT_COLOR}" stroke-width="${strokeW.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`
  ).join('\n    ');

  const creasePaths = data.crease.map(poly =>
    `<path d="${polylineToPath(poly)}" fill="none" stroke="${CREASE_COLOR}" stroke-width="${(strokeW * 0.7).toFixed(2)}" stroke-dasharray="${dash}" stroke-linejoin="round"/>`
  ).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${vw.toFixed(1)}mm" height="${vh.toFixed(1)}mm"
     viewBox="${vx.toFixed(2)} ${vy.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}">
  <title>Dieline ${W}x${H}x${D}mm</title>
  <desc>LumoPack box dieline - Cut (red) / Crease (green dashed)</desc>
  <g id="crease">
    ${creasePaths}
  </g>
  <g id="cut">
    ${cutPaths}
  </g>
</svg>`;
}

/**
 * Trigger browser download of an SVG file.
 */
export function downloadSvg(svgContent, filename = 'dieline.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
