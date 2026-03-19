/**
 * DielineViewer — SVG-based 2D dieline renderer
 *
 * Renders exact DXF geometry directly from parsed DXF file.
 * Shows cut lines (red) and crease/fold lines (green dashed).
 * Supports pan & zoom via mouse/touch.
 * Click on lines to inspect vertex coordinates in Console.
 */

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { parseDxf } from '../../engine/dxfParser';
import dxfRaw from '../../assets/500x300x80mm-folding-box.dxf?raw';

const CUT_COLOR = '#cc2222';
const CREASE_COLOR = '#22aa44';
const GRID_COLOR = 'rgba(255,255,255,0.04)';

// Convert SVG client coords to DXF coords (Y is flipped)
function svgPointToDxf(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM().inverse();
  const svgPt = pt.matrixTransform(ctm);
  return { x: parseFloat(svgPt.x.toFixed(2)), y: parseFloat((-svgPt.y).toFixed(2)) };
}

function polylineToPath(points) {
  if (!points || points.length < 2) return '';
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${(-y).toFixed(2)}`)
    .join(' ');
}

export default function DielineViewer({ width = 500, height = 300, depth = 80 }) {
  const svgRef = useRef(null);
  const [viewBox, setViewBox] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [viewBoxStart, setViewBoxStart] = useState(null);

  // Parse DXF once — render raw geometry directly, no scaling
  const dieline = useMemo(() => parseDxf(dxfRaw), []);

  // Compute initial viewBox from bounds
  const initialViewBox = useMemo(() => {
    const { bounds } = dieline;
    const pad = Math.max(bounds.width, bounds.height) * 0.08;
    return {
      x: bounds.minX - pad,
      y: -(bounds.maxY + pad),
      w: bounds.width + pad * 2,
      h: bounds.height + pad * 2,
    };
  }, [dieline]);

  useEffect(() => {
    setViewBox(initialViewBox);
  }, [initialViewBox]);

  const vb = viewBox || initialViewBox;

  // Zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(prev => {
      const v = prev || initialViewBox;
      const svg = svgRef.current;
      if (!svg) return v;
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      const newW = v.w * factor;
      const newH = v.h * factor;
      return {
        x: v.x + (v.w - newW) * mx,
        y: v.y + (v.h - newH) * my,
        w: newW,
        h: newH,
      };
    });
  }, [initialViewBox]);

  // Pan
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setViewBoxStart(viewBox || initialViewBox);
  }, [viewBox, initialViewBox]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning || !viewBoxStart) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - panStart.x) / rect.width * viewBoxStart.w;
    const dy = (e.clientY - panStart.y) / rect.height * viewBoxStart.h;
    setViewBox({
      x: viewBoxStart.x - dx,
      y: viewBoxStart.y - dy,
      w: viewBoxStart.w,
      h: viewBoxStart.h,
    });
  }, [isPanning, panStart, viewBoxStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setViewBoxStart(null);
  }, []);

  const resetView = useCallback(() => {
    setViewBox(initialViewBox);
  }, [initialViewBox]);

  // Click on SVG background to log DXF coordinates
  const handleClick = useCallback((e) => {
    if (isPanning) return;
    const svg = svgRef.current;
    if (!svg) return;
    const dxfPt = svgPointToDxf(svg, e.clientX, e.clientY);
    console.log(`%c[Click] DXF coords: (${dxfPt.x}, ${dxfPt.y})`, 'color: #00ff88; font-weight: bold');
  }, [isPanning]);

  // Stroke widths relative to view
  const cutStroke = Math.max(0.8, vb.w * 0.002);
  const creaseStroke = Math.max(0.5, vb.w * 0.0012);
  const dashPattern = `${vb.w * 0.006} ${vb.w * 0.004}`;

  // Cut paths — click to inspect vertices
  const cutPaths = useMemo(() =>
    dieline.cut.map((polyline, i) => (
      <path
        key={`cut-${i}`}
        d={polylineToPath(polyline)}
        fill="none"
        stroke={CUT_COLOR}
        strokeWidth={cutStroke}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ cursor: 'crosshair', pointerEvents: 'stroke' }}
        onClick={(e) => {
          e.stopPropagation();
          console.log(`%c[Cut #${i}] ${polyline.length} vertices`, 'color: #ff4444; font-weight: bold');
          console.log(polyline.map(([x, y]) => `(${x.toFixed(2)}, ${y.toFixed(2)})`).join(' → '));
          console.table(polyline.map(([x, y], j) => ({ vertex: j, x: +x.toFixed(2), y: +y.toFixed(2) })));
        }}
      />
    )),
    [dieline.cut, cutStroke]
  );

  // Crease paths — click to inspect vertices
  const creasePaths = useMemo(() =>
    dieline.crease.map((polyline, i) => (
      <path
        key={`crease-${i}`}
        d={polylineToPath(polyline)}
        fill="none"
        stroke={CREASE_COLOR}
        strokeWidth={creaseStroke}
        strokeDasharray={dashPattern}
        strokeLinejoin="round"
        style={{ cursor: 'crosshair', pointerEvents: 'stroke' }}
        onClick={(e) => {
          e.stopPropagation();
          console.log(`%c[Crease #${i}] ${polyline.length} vertices`, 'color: #22ff44; font-weight: bold');
          console.log(polyline.map(([x, y]) => `(${x.toFixed(2)}, ${y.toFixed(2)})`).join(' → '));
          console.table(polyline.map(([x, y], j) => ({ vertex: j, x: +x.toFixed(2), y: +y.toFixed(2) })));
        }}
      />
    )),
    [dieline.crease, creaseStroke, dashPattern]
  );

  // Grid
  const gridLines = useMemo(() => {
    const step = Math.pow(10, Math.floor(Math.log10(vb.w / 5)));
    const lines = [];
    const startX = Math.floor(vb.x / step) * step;
    const startY = Math.floor(vb.y / step) * step;
    for (let x = startX; x < vb.x + vb.w; x += step) {
      lines.push(
        <line key={`gx-${x}`}
          x1={x} y1={vb.y} x2={x} y2={vb.y + vb.h}
          stroke={GRID_COLOR} strokeWidth={vb.w * 0.0005}
        />
      );
    }
    for (let y = startY; y < vb.y + vb.h; y += step) {
      lines.push(
        <line key={`gy-${y}`}
          x1={vb.x} y1={y} x2={vb.x + vb.w} y2={y}
          stroke={GRID_COLOR} strokeWidth={vb.w * 0.0005}
        />
      );
    }
    return lines;
  }, [vb]);

  return (
    <div className="w-full h-full relative bg-[#1a1d23] select-none">
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        {gridLines}
        {creasePaths}
        {cutPaths}
      </svg>

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <button
          onClick={resetView}
          className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-purple-200 text-[11px] font-mono text-purple-500 hover:text-purple-700 transition-colors shadow-sm"
        >
          Reset View
        </button>
        <button
          onClick={() => {
            console.log('%c=== DXF Dieline Analyzer ===', 'color: #ffaa00; font-size: 14px; font-weight: bold');

            const creases = dieline.crease;
            const cuts = dieline.cut;

            // --- 1. Classify crease lines ---
            const horizontalCreases = [];
            const verticalCreases = [];
            const otherCreases = [];

            creases.forEach((polyline, index) => {
              const start = polyline[0];
              const end = polyline[polyline.length - 1];
              const dx = Math.abs(start[0] - end[0]);
              const dy = Math.abs(start[1] - end[1]);
              const len = Math.sqrt(dx * dx + dy * dy);

              if (dy < 0.1 && len > 1) {
                horizontalCreases.push({
                  index, y: +start[1].toFixed(2),
                  x1: +Math.min(start[0], end[0]).toFixed(2),
                  x2: +Math.max(start[0], end[0]).toFixed(2),
                  len: +len.toFixed(2),
                });
              } else if (dx < 0.1 && len > 1) {
                verticalCreases.push({
                  index, x: +start[0].toFixed(2),
                  y1: +Math.min(start[1], end[1]).toFixed(2),
                  y2: +Math.max(start[1], end[1]).toFixed(2),
                  len: +len.toFixed(2),
                });
              } else {
                otherCreases.push({ index, start: [+start[0].toFixed(2), +start[1].toFixed(2)], end: [+end[0].toFixed(2), +end[1].toFixed(2)], len: +len.toFixed(2) });
              }
            });

            // Sort for readability
            horizontalCreases.sort((a, b) => a.y - b.y);
            verticalCreases.sort((a, b) => a.x - b.x);

            console.log('%c--- Horizontal Creases (sorted by Y) ---', 'color: #22ff44; font-weight: bold');
            console.table(horizontalCreases);

            console.log('%c--- Vertical Creases (sorted by X) ---', 'color: #22ff44; font-weight: bold');
            console.table(verticalCreases);

            if (otherCreases.length > 0) {
              console.log('%c--- Diagonal/Other Creases ---', 'color: #ffaa44; font-weight: bold');
              console.table(otherCreases);
            }

            // --- 2. Extract unique Y and X values (structural grid) ---
            const uniqueY = [...new Set(horizontalCreases.map(l => l.y))].sort((a, b) => a - b);
            const uniqueX = [...new Set(verticalCreases.map(l => l.x))].sort((a, b) => a - b);

            console.log('%c--- Structural Grid ---', 'color: #ffaa00; font-weight: bold');
            console.log('Unique Y positions (horizontal folds):', uniqueY);
            console.log('Unique X positions (vertical folds):', uniqueX);

            // --- 3. Identify base panel candidates ---
            // Base = largest rectangle formed by crease intersections
            console.log('%c--- Base Panel Candidates ---', 'color: #44aaff; font-weight: bold');
            if (uniqueX.length >= 2 && uniqueY.length >= 2) {
              // Find the widest horizontal creases (likely front face edges)
              const longH = horizontalCreases.filter(l => l.len > 100).sort((a, b) => b.len - a.len);
              const longV = verticalCreases.filter(l => l.len > 100).sort((a, b) => b.len - a.len);

              console.log('Longest horizontal creases:', longH.slice(0, 6));
              console.log('Longest vertical creases:', longV.slice(0, 6));

              // Try to find front face: rectangle where Y spans ~H and X spans ~W
              for (let i = 0; i < uniqueY.length - 1; i++) {
                for (let j = i + 1; j < uniqueY.length; j++) {
                  const spanY = +(uniqueY[j] - uniqueY[i]).toFixed(2);
                  for (let m = 0; m < uniqueX.length - 1; m++) {
                    for (let n = m + 1; n < uniqueX.length; n++) {
                      const spanX = +(uniqueX[n] - uniqueX[m]).toFixed(2);
                      // Only report rectangles that could be structural panels
                      if (spanX > 50 && spanY > 50) {
                        console.log(
                          `  Rectangle: X[${uniqueX[m]} .. ${uniqueX[n]}] x Y[${uniqueY[i]} .. ${uniqueY[j]}]  =>  ${spanX} x ${spanY} mm`
                        );
                      }
                    }
                  }
                }
              }
            }

            // --- 4. Cut line summary ---
            console.log('%c--- Cut Lines Summary ---', 'color: #ff4444; font-weight: bold');
            cuts.forEach((polyline, i) => {
              const xs = polyline.map(p => p[0]);
              const ys = polyline.map(p => p[1]);
              console.log(
                `  Cut #${i}: ${polyline.length} pts, X[${Math.min(...xs).toFixed(1)}..${Math.max(...xs).toFixed(1)}], Y[${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)}]`
              );
            });

            // --- 5. Full data dump ---
            console.log('%c--- Full DXF Data (copy from here) ---', 'color: #888; font-weight: bold');
            console.log(JSON.parse(JSON.stringify(dieline)));
          }}
          className="bg-blue-600/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-blue-500 text-[11px] font-mono text-white hover:bg-blue-500 transition-colors"
        >
          Analyze DXF
        </button>
      </div>

      {/* Dimension info */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-purple-200 shadow-sm">
        <span className="text-[11px] font-mono text-purple-500">
          {width} x {depth} x {height} mm (DXF reference: 500x80x300)
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-purple-200 shadow-sm flex gap-3">
        <span className="text-[10px] font-mono flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: CUT_COLOR }} />
          <span className="text-purple-500">Cut</span>
        </span>
        <span className="text-[10px] font-mono flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 border-t border-dashed" style={{ borderColor: CREASE_COLOR }} />
          <span className="text-purple-500">Crease</span>
        </span>
      </div>
    </div>
  );
}
