/**
 * DielineViewer — SVG-based 2D dieline renderer
 *
 * Two modes:
 * 1. DXF mode (default for 500x300x80): renders exact DXF geometry
 * 2. Parametric mode: uses the parametric engine for custom dimensions
 *
 * Shows cut lines (red) and crease/fold lines (green dashed).
 * Supports pan & zoom via mouse/touch.
 */

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { parseDxf } from '../../engine/dxfParser';
import { scaleDxfData } from '../../engine/parametric/dxfScaler';
import dxfRaw from '../../assets/500x300x80mm-folding-box.dxf?raw';

const CUT_COLOR = '#cc2222';
const CREASE_COLOR = '#22aa44';
const GRID_COLOR = 'rgba(255,255,255,0.04)';

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

  // Parse reference DXF once, then scale to current dimensions
  const refDxf = useMemo(() => parseDxf(dxfRaw), []);
  const dieline = useMemo(
    () => scaleDxfData(refDxf, width, height, depth, 3),
    [refDxf, width, height, depth]
  );

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

  // Stroke widths relative to view
  const cutStroke = Math.max(0.8, vb.w * 0.002);
  const creaseStroke = Math.max(0.5, vb.w * 0.0012);
  const dashPattern = `${vb.w * 0.006} ${vb.w * 0.004}`;

  // Cut paths
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
      />
    )),
    [dieline.cut, cutStroke]
  );

  // Crease paths
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
          className="bg-panel-darker/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-panel-border text-[11px] font-mono text-zinc-400 hover:text-white transition-colors"
        >
          Reset View
        </button>
      </div>

      {/* Dimension info */}
      <div className="absolute bottom-3 left-3 bg-panel-darker/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-panel-border">
        <span className="text-[11px] font-mono text-zinc-400">
          {width} x {depth} x {height} mm
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-panel-darker/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-panel-border flex gap-3">
        <span className="text-[10px] font-mono flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: CUT_COLOR }} />
          <span className="text-zinc-400">Cut</span>
        </span>
        <span className="text-[10px] font-mono flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 border-t border-dashed" style={{ borderColor: CREASE_COLOR }} />
          <span className="text-zinc-400">Crease</span>
        </span>
      </div>
    </div>
  );
}
