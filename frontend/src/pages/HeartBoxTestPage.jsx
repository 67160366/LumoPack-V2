/**
 * HeartBoxTestPage — Parametric heart-shaped box test page
 *
 * Architecture: [Icon Rail 64px] → [Flyout Panel 360px floating]
 * Tabs: Shape | Size | Lid (3D only)
 */

import { useState, useMemo, useRef, useCallback, useEffect, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FloatingChat from '../components/Chatbot/FloatingChat';
import { useChatbot } from '../contexts/ChatbotContext';
import { useAuth } from '../contexts/AuthContext';
import { getFreshAccessToken } from '../lib/authToken';
import { apiUrl } from '../utils/apiBase';
import HeartFoldBox, { generateHeart, outlineBounds, SUPPORT_COLORS } from '../components/Box3D/HeartFoldBox';
import { getScheme } from '../components/Box3D/cardboardColors';
import MaterialPresetPicker, { MATERIAL_PRESETS } from '../components/Box3D/MaterialPresetPicker';
import { generateDxf, downloadDxf } from '../engine/dxfWriter';
import { generateSvg, downloadSvg } from '../engine/svgExporter';
import { generateHeartDieline } from '../engine/heartDieline';
import useImagePlacement from '../hooks/useImagePlacement';
import ImageUploadPanel from '../components/DesignOverlay/ImageUploadPanel';
import DielineImageOverlay from '../components/DesignOverlay/DielineImageOverlay';

/* ── Design tokens ── */
const FONT = "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', monospace";
const PINK = '#e91e63';
const PINK_DARK = '#c2185b';
const RAIL_W = 64;
const PANEL_W = 360;

const CUT_COLOR = '#cc2222';
const CREASE_COLOR = '#22aa44';
const GRID_COLOR = 'rgba(255,255,255,0.04)';

/* ── Shape preview thumbnails ── */
const SHAPE_PREVIEWS = [35, 45, 55, 65, 75];
const TILT_PREVIEWS = [25, 35, 45, 55, 65];

/* ── SVG helpers ── */
function polylineToPath(pts) {
  if (!pts || pts.length < 2) return '';
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${(-y).toFixed(2)}`).join(' ');
}
function computeBounds(dl) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const pl of [...(dl.cut || []), ...(dl.crease || [])]) for (const [x, y] of pl) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { minX: x0, maxX: x1, minY: y0, maxY: y1, width: x1 - x0, height: y1 - y0 };
}

/* ── MiniHeart preview component ── */
function MiniHeart({ shapePct, tiltDeg, size = 24, color = PINK, opacity = 0.3, active = false }) {
  const outline = useMemo(() => {
    const tilt = (tiltDeg * Math.PI) / 180;
    const b = shapePct / 100;
    const t0 = Math.atan2(Math.cos(tilt), b * Math.sin(tilt));
    let right = [];
    for (let i = 0; i <= 30; i++) {
      const t = t0 + (i / 30) * Math.PI;
      const x = Math.cos(t) * Math.cos(tilt) - b * Math.sin(t) * Math.sin(tilt);
      const y = Math.cos(t) * Math.sin(tilt) + b * Math.sin(t) * Math.cos(tilt);
      right.push([x, y]);
    }
    if (right[15][0] < 0) {
      right = [];
      for (let i = 0; i <= 30; i++) {
        const t = t0 + Math.PI + (i / 30) * Math.PI;
        const x = Math.cos(t) * Math.cos(tilt) - b * Math.sin(t) * Math.sin(tilt);
        const y = Math.cos(t) * Math.sin(tilt) + b * Math.sin(t) * Math.cos(tilt);
        right.push([x, y]);
      }
    }
    const topY = right[0][1], botY = right[right.length - 1][1];
    const scale = 1 / Math.abs(topY - botY);
    const left = right.map(([x, y]) => [-x, y]).reverse();
    return [...right, ...left.slice(1)].map(([x, y]) => [x * scale, y * scale]);
  }, [shapePct, tiltDeg]);

  const d = outline.map(([x, y], i) =>
    `${i === 0 ? 'M' : 'L'}${(x * size * 0.8 + size / 2).toFixed(1)},${(-y * size * 0.8 + size / 2).toFixed(1)}`
  ).join(' ') + 'Z';

  return (
    <svg width={size} height={size} style={{ opacity: active ? 1 : opacity }}>
      <path d={d} fill={color} />
    </svg>
  );
}

/* ── Icons ── */
function ShapeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}
function SizeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 3H3v18h18V3z" />
      <path d="M9 3v18M3 9h18" />
    </svg>
  );
}
function MaterialIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
      <path d="M12 22a10 10 0 0010-10h-4a6 6 0 01-6 6v4z" />
    </svg>
  );
}
function SupportIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4" y1="12" x2="8" y2="12" />
      <line x1="16" y1="12" x2="20" y2="12" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <line x1="12" y1="16" x2="12" y2="20" />
    </svg>
  );
}
function ProjectsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function ImageIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/* ── Shared UI primitives ── */
function Section({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 8, fontFamily: FONT }}>{label}</div>
      {children}
    </div>
  );
}

/** SVG heart path string for 2D preview */
function svgHeartPathStr(cx, cy, size, sP = 55, tD = 45) {
  const n = 30;
  const tilt = (tD * Math.PI) / 180;
  const b = sP / 100;
  const t0 = Math.atan2(Math.cos(tilt), b * Math.sin(tilt));
  let right = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (i / n) * Math.PI;
    const x = Math.cos(t) * Math.cos(tilt) - b * Math.sin(t) * Math.sin(tilt);
    const y = Math.cos(t) * Math.sin(tilt) + b * Math.sin(t) * Math.cos(tilt);
    right.push([x, y]);
  }
  if (right[Math.floor(n / 2)][0] < 0) {
    right = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + Math.PI + (i / n) * Math.PI;
      const x = Math.cos(t) * Math.cos(tilt) - b * Math.sin(t) * Math.sin(tilt);
      const y = Math.cos(t) * Math.sin(tilt) + b * Math.sin(t) * Math.cos(tilt);
      right.push([x, y]);
    }
  }
  const topY = right[0][1], botY = right[right.length - 1][1];
  const sc = (size * 2) / Math.abs(topY - botY);
  const midY = (topY + botY) / 2;
  const left = right.map(([x, y]) => [-x, y]).reverse();
  const pts = [...right, ...left.slice(1)].map(([x, y]) => [cx + x * sc, cy - (y - midY) * sc]);
  return 'M' + pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join('L') + 'Z';
}

/** Point-in-polygon test (ray casting) */
function pointInPoly(px, py, polyPts) {
  let inside = false;
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    const [xi, yi] = polyPts[i];
    const [xj, yj] = polyPts[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Interactive heart-shaped support editor — click to place holes */
function HeartSupportEditor({ length, shapePct, tiltDeg, cardboard: cb, config, holeTool, holeW, holeL, onPlace, onRemove, selectedHoleId, onSelect }) {
  const editorRef = useRef(null);
  const [mouse, setMouse] = useState(null); // { mmX, mmY } relative to heart center

  const gap = 1;
  const innerLen = length - 2 * cb - 2 * gap;
  const heartPts = useMemo(() => innerLen > 0 ? generateHeart(innerLen, shapePct, tiltDeg) : [], [innerLen, shapePct, tiltDeg]);
  const bounds = useMemo(() => outlineBounds(heartPts), [heartPts]);

  const pad = 12;
  const svgW = 260;
  const ratio = bounds.w > 0 ? (svgW - 2 * pad) / bounds.w : 1;
  const svgH = bounds.h * ratio + 2 * pad;

  // Convert heart mm → SVG px
  const toSvg = useCallback((mmX, mmY) => [
    pad + (mmX - bounds.minX) * ratio,
    pad + (bounds.maxY - mmY) * ratio,
  ], [bounds, ratio]);

  // SVG path for heart outline
  const heartPath = useMemo(() => {
    if (!heartPts.length) return '';
    const svgPts = heartPts.map(([x, y]) => toSvg(x, y));
    return 'M' + svgPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
  }, [heartPts, toSvg]);

  function handleMove(e) {
    const rect = editorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const mmX = bounds.minX + (sx - pad) / ratio;
    const mmY = bounds.maxY - (sy - pad) / ratio;
    if (pointInPoly(mmX, mmY, heartPts)) {
      setMouse({ mmX: mmX - bounds.cx, mmY: mmY - bounds.cy }); // relative to center
    } else {
      setMouse(null);
    }
  }

  function handleClick() {
    if (!mouse || !holeTool) return;
    onPlace(mouse.mmX, mouse.mmY);
  }

  // Render one hole (existing or ghost)
  function renderHole(hole, key, isGhost) {
    const [sx, sy] = toSvg(hole.x * 10 + bounds.cx, hole.y * 10 + bounds.cy);
    const isSelected = !isGhost && hole.id === selectedHoleId;
    const fill = isGhost ? 'rgba(255,255,255,0.5)' : isSelected ? 'rgba(233,30,99,0.4)' : 'rgba(0,0,0,0.35)';
    const stroke = isGhost ? '#fff' : isSelected ? PINK : 'rgba(255,255,255,0.7)';
    const strokeW = isSelected ? 2 : 1;
    const clickProps = !isGhost ? { style: { cursor: 'pointer' }, onClick: (e) => { e.stopPropagation(); onSelect?.(hole.id); } } : { style: { cursor: 'crosshair' } };
    const hw = (hole.w || 3) * 10 * ratio;  // cm → mm → svg px
    const hl = (hole.l || 4) * 10 * ratio;

    if (hole.type === 'circle') {
      const r = Math.min(hw, hl) / 2;
      return <circle key={key} cx={sx} cy={sy} r={r} fill={fill} stroke={stroke} strokeWidth={strokeW} {...clickProps} />;
    }
    if (hole.type === 'heart') {
      return <g key={key} transform={`translate(${sx},${sy}) scale(${hw / hl},1)`} {...clickProps}>
        <path d={svgHeartPathStr(0, 0, hl, shapePct, tiltDeg)} fill={fill} stroke={stroke} strokeWidth={strokeW} />
      </g>;
    }
    if (hole.type === 'rect') {
      return <rect key={key} x={sx - hw / 2} y={sy - hl / 2} width={hw} height={hl} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeW} {...clickProps} />;
    }
    // capsule = ellipse
    return <ellipse key={key} cx={sx} cy={sy} rx={hw / 2} ry={hl / 2} fill={fill} stroke={stroke} strokeWidth={strokeW} {...clickProps} />;
  }

  // Ghost at cursor
  const ghost = (mouse && holeTool) ? {
    type: holeTool, x: mouse.mmX / 10, y: mouse.mmY / 10,
    w: holeW, l: holeL,
  } : null;

  return (
    <svg ref={editorRef} width={svgW} height={svgH}
      onMouseMove={handleMove} onMouseLeave={() => setMouse(null)} onClick={handleClick}
      style={{ cursor: mouse ? 'crosshair' : 'default', display: 'block', margin: '0 auto', borderRadius: 12, overflow: 'hidden' }}>
      {/* Background */}
      <rect width={svgW} height={svgH} fill="#1a1a1a" />
      {/* Heart tray */}
      <path d={heartPath} fill={config.color || '#3E2723'} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      {/* Existing holes */}
      {(config.holes || []).map((h, i) => renderHole(h, h.id || i, false))}
      {/* Ghost preview */}
      {ghost && renderHole(ghost, 'ghost', true)}
      {/* Hint */}
      {!config.holes?.length && !ghost && (
        <text x={svgW / 2} y={svgH / 2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={11} fontFamily={FONT}>
          คลิกเพื่อวางรู
        </text>
      )}
    </svg>
  );
}

function SliderField({ label, value, min, max, step, onChange, unit = 'mm' }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', fontFamily: FONT }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: MONO }}>{value}<span style={{ fontSize: 10, color: '#374151', marginLeft: 2 }}>{unit}</span></span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} style={{ width: '100%', height: 4, accentColor: PINK, cursor: 'pointer' }} />
    </div>
  );
}

const TABS = [
  { id: 'shape', label: 'Shape', icon: ShapeIcon },
  { id: 'material', label: 'Material', icon: MaterialIcon },
  { id: 'size',  label: 'Size',  icon: SizeIcon },
  { id: 'support', label: 'Support', icon: SupportIcon },
  { id: 'image', label: 'Image', icon: ImageIcon },
];

/* ── Error Boundary ── */
class HeartErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: FONT, color: '#c00' }}>
        <h2>HeartBoxTestPage Error:</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
      </div>
    );
    return this.props.children;
  }
}

export default function HeartBoxTestPage() {
  return <HeartErrorBoundary><HeartBoxInner /></HeartErrorBoundary>;
}

/* ================================================================
 * Main Component
 * ============================================================== */
function HeartBoxInner() {
  const [length, setLength] = useState(100);
  const [height, setHeight] = useState(40);
  const [shapePct, setShapePct] = useState(55);
  const [tiltDeg, setTiltDeg] = useState(45);
  const [lidOpen, setLidOpen] = useState(0);
  const [boxStyle, setBoxStyle] = useState('kraft');
  const [showSupport, setShowSupport] = useState(false);
  const [supportConfig, setSupportConfig] = useState({
    wallHeight: 0.78,
    holeDepth: 0.6,
    color: '#3E2723',
    holes: [],
  });
  const [holeTool, setHoleTool] = useState('heart');  // selected shape tool
  const [holeW, setHoleW] = useState(3.0);   // cm width (for new holes)
  const [holeL, setHoleL] = useState(4.0);   // cm length (for new holes)
  const [selectedHoleId, setSelectedHoleId] = useState(null);

  // --- Load project from navigation state ---
  const location = useLocation();
  useEffect(() => {
    const proj = location.state?.loadProject;
    if (!proj) return;
    window.history.replaceState({}, '');
    if (proj.dimensions) {
      if (proj.dimensions.width)  setLength(proj.dimensions.width * 10);
      if (proj.dimensions.height) setHeight(proj.dimensions.height * 10);
    }
    if (proj.material) {
      const v = proj.material.toLowerCase();
      if (v === 'red' || v.includes('แดง')) setBoxStyle('heart_red');
      else if (v === 'white' || v.includes('ขาว')) setBoxStyle('white');
      else setBoxStyle('kraft');
    }
    if (proj.support_required != null) {
      setShowSupport(!!proj.support_required);
    }
    if (proj.shape_pct != null) setShapePct(proj.shape_pct);
    if (proj.tilt_deg != null) setTiltDeg(proj.tilt_deg);
    if (proj.support_config) {
      setSupportConfig(prev => ({ ...prev, ...proj.support_config }));
      if (proj.support_config.holes?.length) setShowSupport(true);
    }
  }, []);

  // --- Chatbot sync: dimensions, material, support ---
  const { collectedData, updateCollectedData } = useChatbot();
  useEffect(() => {
    const dims = collectedData?.dimensions;
    if (!dims) return;
    // Heart box: length = width*10, height = height*10 (mm)
    if (dims.width)  setLength(dims.width * 10);
    if (dims.height) setHeight(dims.height * 10);
  }, [collectedData?.dimensions]);
  useEffect(() => {
    const mat = collectedData?.material;
    if (!mat) return;
    const v = mat.toLowerCase();
    if (v === 'red' || v.includes('แดง')) setBoxStyle('heart_red');
    else if (v === 'white' || v.includes('ขาว')) setBoxStyle('white');
    else setBoxStyle('kraft');
  }, [collectedData?.material]);
  useEffect(() => {
    if (collectedData?.support_required != null) {
      setShowSupport(!!collectedData.support_required);
    }
  }, [collectedData?.support_required]);

  // --- Sync heart-specific fields back to chatbot context ---
  useEffect(() => {
    updateCollectedData({ shape_pct: shapePct, tilt_deg: tiltDeg });
  }, [shapePct, tiltDeg, updateCollectedData]);

  useEffect(() => {
    if (showSupport) {
      updateCollectedData({ support_config: supportConfig, support_required: true });
    } else {
      updateCollectedData({ support_config: null, support_required: false });
    }
  }, [showSupport, supportConfig, updateCollectedData]);

  const [view, setView] = useState('3d');
  const [activeTab, setActiveTab] = useState(null);

  const heartPreviewColor = useMemo(() => getScheme(boxStyle).lidCap, [boxStyle]);

  const addHoleAt = useCallback((mmX, mmY) => {
    const newHole = {
      id: Date.now(),
      type: holeTool,
      x: mmX / 10, // mm → cm (relative to heart center)
      y: mmY / 10,
      w: holeW,
      l: holeL,
    };
    setSupportConfig(prev => ({ ...prev, holes: [...(prev.holes || []), newHole] }));
  }, [holeTool, holeW, holeL]);

  const removeHole = (id) => {
    setSupportConfig(prev => ({ ...prev, holes: prev.holes.filter(h => h.id !== id) }));
    if (selectedHoleId === id) setSelectedHoleId(null);
  };

  const updateHole = (id, updates) => {
    setSupportConfig(prev => ({
      ...prev,
      holes: prev.holes.map(h => h.id === id ? { ...h, ...updates } : h),
    }));
  };

  // 2D DXF pan/zoom
  const svgRef = useRef(null);
  const [svgVB, setSvgVB] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [svgVBStart, setSvgVBStart] = useState(null);

  const dieline = useMemo(() => {
    const result = generateHeartDieline(length, height, shapePct, tiltDeg);
    result.bounds = computeBounds(result);
    return result;
  }, [length, height, shapePct, tiltDeg]);

  const initialViewBox = useMemo(() => {
    const b = dieline.bounds, pad = Math.max(b.width, b.height) * 0.08;
    return { x: b.minX - pad, y: -(b.maxY + pad), w: b.width + pad * 2, h: b.height + pad * 2 };
  }, [dieline]);

  useEffect(() => { setSvgVB(initialViewBox); }, [initialViewBox]);
  const vb = svgVB || initialViewBox;

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.1 : 0.9;
    setSvgVB(prev => {
      const v = prev || initialViewBox, svg = svgRef.current;
      if (!svg) return v;
      const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
      const nW = v.w * f, nH = v.h * f;
      return { x: v.x + (v.w - nW) * mx, y: v.y + (v.h - nH) * my, w: nW, h: nH };
    });
  }, [initialViewBox]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setIsPanning(true); setPanStart({ x: e.clientX, y: e.clientY }); setSvgVBStart(svgVB || initialViewBox);
  }, [svgVB, initialViewBox]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning || !svgVBStart) return;
    const svg = svgRef.current; if (!svg) return;
    const r = svg.getBoundingClientRect();
    const dx = (e.clientX - panStart.x) / r.width * svgVBStart.w;
    const dy = (e.clientY - panStart.y) / r.height * svgVBStart.h;
    setSvgVB({ x: svgVBStart.x - dx, y: svgVBStart.y - dy, w: svgVBStart.w, h: svgVBStart.h });
  }, [isPanning, panStart, svgVBStart]);

  const handleMouseUp = useCallback(() => { setIsPanning(false); setSvgVBStart(null); }, []);
  const resetView = useCallback(() => { setSvgVB(initialViewBox); }, [initialViewBox]);

  // Image placement on dieline
  const placement = useImagePlacement({ svgRef, viewBox: svgVB || initialViewBox, defaultPlaceWidth: Math.min(300, dieline.bounds?.width || 300) });

  // Panel zones for heart dieline (in dieline coords: X right, Y up)
  const panelZones = useMemo(() => {
    const b = dieline.bounds;
    if (!b) return [];
    const cardboard = 1.5;
    const clearance = 1.03;
    const gap = 8;
    const teethH = 5;
    const baseH = height * 0.7;
    const lidH = height * 0.35;

    const baseBounds = outlineBounds(generateHeart(length, shapePct, tiltDeg));
    const lidBounds = outlineBounds(generateHeart(length * clearance, shapePct, tiltDeg));
    const basePeri = (() => { const pts = generateHeart(length, shapePct, tiltDeg); let p = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; p += Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]); } return p; })();
    const lidPeri = (() => { const pts = generateHeart(length * clearance, shapePct, tiltDeg); let p = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; p += Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]); } return p; })();

    // Row 1: caps
    const baseCapX = -baseBounds.w / 2;
    const baseCapY = -baseBounds.h / 2;
    const lidCapX = baseBounds.w / 2 + gap;
    const lidCapY = -lidBounds.h / 2;

    // Row 2: base wall strip
    const stripStartY = -baseBounds.h / 2 - gap;
    const bsx = -basePeri / 2;
    const bsy = stripStartY - baseH;

    // Row 3: lid wall strip
    const lidStripY = bsy - teethH - gap;
    const lsx = -lidPeri / 2;
    const lsy = lidStripY - lidH;

    return [
      { id: 'baseCap',  label: 'ฐาน (หัวใจ)', x: baseCapX, y: baseCapY, w: baseBounds.w, h: baseBounds.h },
      { id: 'lidCap',   label: 'ฝา (หัวใจ)',  x: lidCapX,  y: lidCapY,  w: lidBounds.w,  h: lidBounds.h },
      { id: 'baseWall', label: 'ผนังฐาน',     x: bsx,      y: bsy,      w: basePeri,     h: baseH },
      { id: 'lidWall',  label: 'ผนังฝา',      x: lsx,      y: lsy,      w: lidPeri,      h: lidH },
    ];
  }, [dieline, length, height, shapePct, tiltDeg]);

  const cutStroke = Math.max(0.8, vb.w * 0.002);
  const creaseStroke = Math.max(0.5, vb.w * 0.0012);
  const dashPattern = `${vb.w * 0.006} ${vb.w * 0.004}`;
  const toggle = (id) => setActiveTab(prev => prev === id ? null : id);

  // Hide Support in 2D mode, hide Image in 3D mode
  const visibleTabs = view === '3d' ? TABS.filter(t => t.id !== 'image') : TABS.filter(t => t.id !== 'support');

  // Download handlers
  const fname = `heart-box-${length}x${height}mm`;
  const handleDownload = useCallback((fmt) => {
    if (fmt === 'dxf') {
      downloadDxf(generateDxf(dieline, length, height, height), `${fname}.dxf`);
    } else if (fmt === 'svg') {
      downloadSvg(generateSvg(dieline, length, height, height), `${fname}.svg`);
    } else if (fmt === 'pdf') {
      import('jspdf').then(({ default: jsPDF }) => {
        const svg = generateSvg(dieline, length, height, height);
        const b = dieline.bounds;
        const pad = Math.max(b.width, b.height) * 0.05;
        const totalW = b.width + pad * 2;
        const totalH = b.height + pad * 2;
        const isLandscape = totalW > totalH;
        const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth() - 20;
        const pageH = doc.internal.pageSize.getHeight() - 30;
        const scale = Math.min(pageW / totalW, pageH / totalH);
        const imgW = totalW * scale, imgH = totalH * scale;
        const x = (doc.internal.pageSize.getWidth() - imgW) / 2;
        doc.setFontSize(14);
        doc.text(`LumoPack Dieline — ${length} x ${height} mm`, 10, 12);
        doc.setFontSize(9); doc.setTextColor(120);
        doc.text('Red = Cut line  |  Green = Crease/Fold line', 10, 18);
        doc.setTextColor(0);
        const img = new Image();
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = totalW * 4; canvas.height = totalH * 4;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, 22, imgW, imgH);
          doc.save(`${fname}.pdf`);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      });
    }
  }, [dieline, length, height, fname]);
  const [showDlMenu, setShowDlMenu] = useState(false);

  // --- Save as Project ---
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const handleSaveProject = useCallback(async () => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบก่อนบันทึกโปรเจค');
      return;
    }
    const projectName = prompt('ตั้งชื่อโปรเจค:', `Heart ${length}x${height}mm`);
    if (!projectName) return;

    setSaving(true);
    try {
      const token = await getFreshAccessToken();
      if (!token) {
        alert('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');
        return;
      }
      const materialMap = { kraft: 'kraft', white: 'white', heart_red: 'red' };
      const body = {
        name: projectName,
        box_type: 'heart',
        dimensions: { width: length / 10, length: length / 10, height: height / 10 },
        material: materialMap[boxStyle] || boxStyle,
        quantity: 500,
        shape_pct: shapePct,
        tilt_deg: tiltDeg,
        support_config: showSupport ? supportConfig : null,
        collected_data: {
          box_type: 'heart',
          dimensions: { width: length / 10, length: length / 10, height: height / 10 },
          material: materialMap[boxStyle] || boxStyle,
          shape_pct: shapePct,
          tilt_deg: tiltDeg,
          support_required: showSupport,
          support_config: showSupport ? supportConfig : null,
        },
      };
      const res = await fetch(apiUrl('/api/projects'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'บันทึกไม่สำเร็จ');
      }
      alert('บันทึกโปรเจคสำเร็จ!');
      navigate('/projects');
    } catch (err) {
      alert(err.message || 'บันทึกโปรเจคไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }, [user, length, height, shapePct, tiltDeg, boxStyle, showSupport, supportConfig, navigate]);

  return (
    <div style={{ height: '100vh', fontFamily: FONT, background: '#e5e7eb', position: 'relative', overflow: 'hidden' }}>

      {/* === Floating Icon Rail (left edge) === */}
      <div style={{
        position: 'absolute', top: 12, left: 12, bottom: 68, zIndex: 40,
        width: RAIL_W,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)',
        paddingTop: 14, paddingBottom: 14,
      }}>
        {/* Logo + Brand */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 6 }}>
          <img src="/logo.png" alt="LumoPack" style={{ width: 60, height: 60, objectFit: 'contain' }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: PINK_DARK, fontFamily: FONT, letterSpacing: '-0.02em', lineHeight: 1 }}>LumoPack</span>
        </Link>

        <div style={{ width: 36, height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 6 }} />

        {/* Tab buttons */}
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => toggle(tab.id)}
              title={tab.label}
              style={{
                width: 50, height: 50, borderRadius: 12, border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                background: isActive ? 'rgba(233,30,99,0.1)' : 'transparent',
                color: isActive ? PINK : '#374151',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(233,30,99,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(233,30,99,0.1)' : 'transparent'; }}
            >
              {isActive && (
                <div style={{ position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)', width: 4, height: 4, borderRadius: '50%', background: PINK }} />
              )}
              <tab.icon size={18} />
              <span style={{ fontSize: 8, fontWeight: 600, lineHeight: 1, fontFamily: FONT, letterSpacing: '0.01em' }}>{tab.label}</span>
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom links */}
        <div style={{ width: 32, height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 0 6px' }} />

        <Link to="/" title="Home" style={{
          width: 50, height: 44, borderRadius: 12, border: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          color: '#374151', textDecoration: 'none', transition: 'color 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = PINK; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#374151'; }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          <span style={{ fontSize: 8, fontWeight: 600, fontFamily: FONT }}>Home</span>
        </Link>

        <Link to="/projects" title="Projects" style={{
          width: 50, height: 44, borderRadius: 12, border: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          color: '#374151', textDecoration: 'none', transition: 'color 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = PINK; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#374151'; }}
        >
          <ProjectsIcon size={18} />
          <span style={{ fontSize: 8, fontWeight: 600, fontFamily: FONT }}>Projects</span>
        </Link>

      </div>

      {/* === Flyout Panel (floating, next to rail) === */}
      <div style={{
        position: 'absolute', top: 12, left: RAIL_W + 24, bottom: 68, zIndex: 35,
        width: activeTab ? PANEL_W : 0,
        opacity: activeTab ? 1 : 0,
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
        pointerEvents: activeTab ? 'auto' : 'none',
      }}>
        <div style={{
          width: PANEL_W, height: '100%',
          background: '#fff', borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '14px 18px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontFamily: FONT, margin: 0 }}>
              {TABS.find(t => t.id === activeTab)?.label || ''}
            </h2>
            <button
              onClick={() => setActiveTab(null)}
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'rgba(0,0,0,0.04)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6b7280', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Panel content */}
          <div className="scrollbar-thin" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

            {/* ── Shape tab ── */}
            {activeTab === 'shape' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Section label="Heart shape">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SliderField label="Shape" value={shapePct} min={35} max={75} step={1} unit="%" onChange={e => setShapePct(+e.target.value)} />
                    <SliderField label="Tilt" value={tiltDeg} min={25} max={65} step={1} unit="deg" onChange={e => setTiltDeg(+e.target.value)} />

                    {/* Current preview */}
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                      <MiniHeart shapePct={shapePct} tiltDeg={tiltDeg} size={64} active color={heartPreviewColor} />
                    </div>
                  </div>
                </Section>

                {/* Shape x Tilt matrix */}
                <Section label="Shape x Tilt matrix">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 12 }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: 2, color: '#9ca3af', fontSize: 9, fontFamily: MONO }}></th>
                          {SHAPE_PREVIEWS.map(s => (
                            <th key={s} style={{ padding: 2, fontSize: 9, color: PINK, fontFamily: MONO, fontWeight: 700 }}>{s}%</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TILT_PREVIEWS.map(t => (
                          <tr key={t}>
                            <td style={{ padding: 2, fontSize: 9, color: PINK, fontWeight: 700, fontFamily: MONO }}>{t}</td>
                            {SHAPE_PREVIEWS.map(s => (
                              <td key={s} style={{ padding: 1, textAlign: 'center', cursor: 'pointer' }}
                                onClick={() => { setShapePct(s); setTiltDeg(t); }}>
                                <MiniHeart
                                  shapePct={s}
                                  tiltDeg={t}
                                  size={28}
                                  active={s === shapePct && t === tiltDeg}
                                  color={heartPreviewColor}
                                  opacity={0.25}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </div>
            )}

            {/* ── Material tab ── */}
            {activeTab === 'material' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16 }}>
                  <MaterialPresetPicker
                    value={boxStyle}
                    onChange={setBoxStyle}
                    accentColor={PINK}
                    sectionLabel="กระดาษ / สีกล่อง"
                    hint="สีจะสะท้อนในมุมมอง 3D — โหมด Heart red เหมาะกับธีมของขวัญ"
                  />
                </div>
              </div>
            )}

            {/* ── Size tab ── */}
            {activeTab === 'size' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Section label="Dimensions">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SliderField label="Length" value={length} min={50} max={250} step={5} onChange={e => setLength(+e.target.value)} />
                    <SliderField label="Height" value={height} min={15} max={120} step={1} onChange={e => setHeight(+e.target.value)} />
                    <div style={{
                      background: 'rgba(233,30,99,0.04)', borderRadius: 10,
                      padding: '8px 0', textAlign: 'center',
                      fontSize: 14, fontFamily: MONO, fontWeight: 700, color: PINK,
                    }}>
                      {length} x {height} mm
                    </div>
                  </div>
                </Section>

                {view === '2d' && (
                  <button onClick={resetView} style={{
                    padding: '9px 0', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10,
                    cursor: 'pointer', background: '#fff', fontFamily: FONT,
                    fontSize: 12, fontWeight: 600, color: '#6b7280', transition: 'all 0.15s',
                  }}>
                    Reset View
                  </button>
                )}

                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: MONO }}>
                  Shape {shapePct}% / Tilt {tiltDeg}deg
                </div>
              </div>
            )}

            {/* ── Support tab (3D) ── */}
            {activeTab === 'support' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Toggle */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: '12px 16px',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: FONT }}>แสดงชั้นซัพพอร์ต</div>
                    <div style={{ fontSize: 10, color: '#6b7280', fontFamily: FONT, marginTop: 2 }}>ถาดรองสินค้าภายใน</div>
                  </div>
                  <button type="button" onClick={() => { setShowSupport(p => !p); if (view !== '3d') setView('3d'); }}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: showSupport ? PINK : '#d1d5db', transition: 'background 0.2s', position: 'relative' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute',
                      top: 3, left: showSupport ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </button>
                </div>

                {/* Color picker */}
                <Section label="สีซัพพอร์ต">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {SUPPORT_COLORS.map(c => (
                      <button key={c.id} type="button" title={c.label}
                        onClick={() => setSupportConfig(prev => ({ ...prev, color: c.hex }))}
                        style={{
                          width: 28, height: 28, borderRadius: 8, border: supportConfig.color === c.hex ? '2px solid ' + PINK : '2px solid rgba(0,0,0,0.1)',
                          background: c.hex, cursor: 'pointer', transition: 'border 0.15s',
                          boxShadow: supportConfig.color === c.hex ? '0 0 0 2px rgba(233,30,99,0.3)' : 'none',
                        }}
                      />
                    ))}
                  </div>
                </Section>

                {/* Wall height & hole depth */}
                <Section label={`ความสูงขอบ — ${Math.round((supportConfig.wallHeight || 0.78) * 100)}%`}>
                  <input type="range" min="40" max="95" value={Math.round((supportConfig.wallHeight || 0.78) * 100)}
                    onChange={e => setSupportConfig(prev => ({ ...prev, wallHeight: parseInt(e.target.value, 10) / 100 }))}
                    style={{ width: '100%', height: 4, accentColor: PINK, cursor: 'pointer' }} />
                </Section>
                <Section label={`ความลึกรู — ${Math.round((supportConfig.holeDepth || 0.6) * 100)}%`}>
                  <input type="range" min="20" max="95" value={Math.round((supportConfig.holeDepth || 0.6) * 100)}
                    onChange={e => setSupportConfig(prev => ({ ...prev, holeDepth: parseInt(e.target.value, 10) / 100 }))}
                    style={{ width: '100%', height: 4, accentColor: PINK, cursor: 'pointer' }} />
                </Section>

                {/* Shape tool selector */}
                <Section label="เลือกรูปแบบเจาะ">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { type: 'heart', label: 'หัวใจ', icon: '♥' },
                      { type: 'circle', label: 'วงกลม', icon: '○' },
                      { type: 'rect', label: 'สี่เหลี่ยม', icon: '□' },
                      { type: 'capsule', label: 'แคปซูล', icon: '⬭' },
                    ].map(opt => (
                      <button key={opt.type} type="button" onClick={() => setHoleTool(opt.type)}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                          border: holeTool === opt.type ? '2px solid ' + PINK : '1px solid rgba(0,0,0,0.1)',
                          background: holeTool === opt.type ? 'rgba(233,30,99,0.08)' : 'rgba(255,255,255,0.6)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        }}>
                        <span style={{ fontSize: 16, lineHeight: 1, color: holeTool === opt.type ? PINK : '#374151' }}>{opt.icon}</span>
                        <span style={{ fontSize: 9, color: holeTool === opt.type ? PINK : '#111827', fontWeight: 600 }}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Tool size W x L */}
                <Section label={`กว้าง — ${holeW.toFixed(1)} cm`}>
                  <input type="range" min="0.5" max="10" step="0.1" value={holeW}
                    onChange={e => setHoleW(parseFloat(e.target.value))}
                    style={{ width: '100%', height: 4, accentColor: PINK, cursor: 'pointer' }} />
                </Section>
                <Section label={`ยาว — ${holeL.toFixed(1)} cm`}>
                  <input type="range" min="0.5" max="10" step="0.1" value={holeL}
                    onChange={e => setHoleL(parseFloat(e.target.value))}
                    style={{ width: '100%', height: 4, accentColor: PINK, cursor: 'pointer' }} />
                </Section>

                {/* Interactive editor */}
                <Section label="คลิกเพื่อวางรู (คลิกรูเดิมเพื่อเลือก)">
                  <HeartSupportEditor
                    length={length} shapePct={shapePct} tiltDeg={tiltDeg} cardboard={1.5}
                    config={supportConfig} holeTool={holeTool} holeW={holeW} holeL={holeL}
                    onPlace={addHoleAt} onRemove={removeHole}
                    selectedHoleId={selectedHoleId} onSelect={setSelectedHoleId}
                  />
                </Section>

                {/* Per-hole list */}
                {supportConfig.holes?.length > 0 && (
                  <Section label={`รูที่เจาะ (${supportConfig.holes.length})`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {supportConfig.holes.map((hole, idx) => {
                        const isSelected = hole.id === selectedHoleId;
                        const typeLabels = { heart: '♥ หัวใจ', circle: '○ วงกลม', rect: '□ สี่เหลี่ยม', capsule: '⬭ แคปซูล' };
                        return (
                          <div key={hole.id}
                            onClick={() => setSelectedHoleId(isSelected ? null : hole.id)}
                            style={{
                              background: isSelected ? 'rgba(233,30,99,0.08)' : '#fff',
                              border: isSelected ? `2px solid ${PINK}` : '1px solid rgba(0,0,0,0.06)',
                              borderRadius: 10, padding: isSelected ? '8px 10px' : '9px 11px',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14, lineHeight: 1 }}>{typeLabels[hole.type]?.split(' ')[0] || '?'}</span>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', fontFamily: FONT }}>
                                    {typeLabels[hole.type]?.split(' ')[1] || hole.type} #{idx + 1}
                                  </div>
                                  <div style={{ fontSize: 9, color: '#6b7280', fontFamily: MONO }}>
                                    x:{hole.x.toFixed(1)} y:{hole.y.toFixed(1)} cm
                                  </div>
                                </div>
                              </div>
                              <button type="button" onClick={(e) => { e.stopPropagation(); removeHole(hole.id); }}
                                style={{ width: 22, height: 22, borderRadius: 6, border: 'none',
                                  background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                                ×
                              </button>
                            </div>
                            {/* Per-hole W/L sliders when selected */}
                            {isSelected && (
                              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#374151', fontFamily: FONT }}>กว้าง</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#111827', fontFamily: MONO }}>{hole.w.toFixed(1)} cm</span>
                                  </div>
                                  <input type="range" min="0.5" max="10" step="0.1" value={hole.w}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => updateHole(hole.id, { w: parseFloat(e.target.value) })}
                                    style={{ width: '100%', height: 3, accentColor: PINK, cursor: 'pointer' }} />
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#374151', fontFamily: FONT }}>ยาว</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#111827', fontFamily: MONO }}>{hole.l.toFixed(1)} cm</span>
                                  </div>
                                  <input type="range" min="0.5" max="10" step="0.1" value={hole.l}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => updateHole(hole.id, { l: parseFloat(e.target.value) })}
                                    style={{ width: '100%', height: 3, accentColor: PINK, cursor: 'pointer' }} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {/* Hole count + clear */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FONT }}>
                    {supportConfig.holes?.length || 0} รู
                  </span>
                  {supportConfig.holes?.length > 0 && (
                    <button type="button"
                      onClick={() => { setSupportConfig(prev => ({ ...prev, holes: [] })); setSelectedHoleId(null); }}
                      style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)',
                        border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>
                      ลบทั้งหมด
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Image tab (2D) ── */}
            {activeTab === 'image' && (
              <div style={{ padding: '14px 18px' }}>
                <ImageUploadPanel placement={placement} accentColor={PINK} currentView={view} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === Viewer (full background) === */}
      <div style={{ position: 'absolute', inset: 0, bottom: 56 }}>
        {view === '2d' ? (
          <div style={{ width: '100%', height: '100%', background: '#1a1d23', borderRadius: 0 }}>
            <svg
              ref={svgRef}
              style={{ width: '100%', height: '100%', cursor: placement.selectedImageId ? 'crosshair' : isPanning ? 'grabbing' : 'grab' }}
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              onWheel={handleWheel}
              onMouseDown={(e) => {
                if (placement.selectedImageId) { placement.handleDielinePlace(e); return; }
                handleMouseDown(e);
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {(() => {
                const step = Math.pow(10, Math.floor(Math.log10(vb.w / 5)));
                const lines = [];
                for (let x = Math.floor(vb.x / step) * step; x < vb.x + vb.w; x += step)
                  lines.push(<line key={`gx-${x}`} x1={x} y1={vb.y} x2={x} y2={vb.y + vb.h} stroke={GRID_COLOR} strokeWidth={vb.w * 0.0005} />);
                for (let y = Math.floor(vb.y / step) * step; y < vb.y + vb.h; y += step)
                  lines.push(<line key={`gy-${y}`} x1={vb.x} y1={y} x2={vb.x + vb.w} y2={y} stroke={GRID_COLOR} strokeWidth={vb.w * 0.0005} />);
                return lines;
              })()}
              {panelZones.map(z => (
                <rect key={`z-${z.id}`} x={z.x} y={-(z.y + z.h)} width={z.w} height={z.h}
                  fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={vb.w * 0.0008}
                  strokeDasharray={`${vb.w * 0.004} ${vb.w * 0.003}`} style={{ pointerEvents: 'none' }} />
              ))}
              {dieline.crease.map((pl, i) => (
                <path key={`cr-${i}`} d={polylineToPath(pl)} fill="none" stroke={CREASE_COLOR} strokeWidth={creaseStroke} strokeDasharray={dashPattern} strokeLinejoin="round" />
              ))}
              {dieline.cut.map((pl, i) => (
                <path key={`ct-${i}`} d={polylineToPath(pl)} fill="none" stroke={CUT_COLOR} strokeWidth={cutStroke} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              <DielineImageOverlay placement={placement} viewBox={vb} />
            </svg>

            {/* 2D legend */}
            <div style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(0,0,0,0.5)', borderRadius: 8, backdropFilter: 'blur(8px)',
              padding: '6px 12px', display: 'flex', gap: 14,
              fontSize: 11, fontFamily: MONO, zIndex: 10, color: '#fff',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 14, height: 2, background: CUT_COLOR }} /> Cut
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 14, height: 0, borderTop: `2px dashed ${CREASE_COLOR}` }} /> Crease
              </span>
            </div>
          </div>
        ) : (
          <Canvas camera={{ position: [0, 3, 5], fov: 45 }} style={{ width: '100%', height: '100%' }}>
            <color attach="background" args={['#e8e0da']} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 5]} intensity={0.9} />
            <directionalLight position={[-3, 5, -5]} intensity={0.3} />
            <HeartFoldBox
              length={length}
              height={height}
              shapePct={shapePct}
              tiltDeg={tiltDeg}
              lidOpen={lidOpen}
              boxStyle={boxStyle}
              showSupport={showSupport}
              supportConfig={supportConfig}
            />
            <OrbitControls makeDefault />
            <gridHelper args={[10, 10, '#d4c8c0', '#e0d6d0']} />
          </Canvas>
        )}
      </div>

      {/* === Bottom Bar === */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 56,
        background: '#fff', zIndex: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '0 16px',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
      }}>
        {/* Left: dimension badge */}
        <div style={{ position: 'absolute', left: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: PINK_DARK }}>
            {length} x {height} mm
          </span>
          <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: FONT }}>
            {MATERIAL_PRESETS.find(m => m.id === boxStyle)?.label ?? boxStyle}
          </span>
        </div>

        {/* Center: view toggle + lid slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* View toggle */}
          {['2d', '3d'].map(v => (
            <button key={v} onClick={() => { setView(v); if (v === '2d' && activeTab === 'support') setActiveTab(null); }}
              style={{
                width: 36, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: view === v ? PINK : 'rgba(0,0,0,0.05)',
                color: view === v ? '#fff' : '#6b7280',
                fontSize: 11, fontWeight: 800, fontFamily: MONO,
                transition: 'all 0.2s',
              }}>
              {v.toUpperCase()}
            </button>
          ))}

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.08)' }} />

          {/* Lid slider (3D only) */}
          {view === '3d' && (<>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', fontFamily: FONT, whiteSpace: 'nowrap' }}>Open</span>
            <input type="range" min="0" max="100" step="1" value={Math.round(lidOpen * 100)}
              onChange={e => setLidOpen(+e.target.value / 100)}
              style={{ width: 120, height: 4, accentColor: PINK, cursor: 'pointer' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', fontFamily: FONT, whiteSpace: 'nowrap' }}>Close</span>

            {/* Divider */}
            <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.08)' }} />
          </>)}

          {/* 2D reset view */}
          {view === '2d' && (
            <>
              <button onClick={resetView} style={{
                height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)',
                cursor: 'pointer', background: '#fff', fontFamily: FONT,
                fontSize: 11, fontWeight: 600, color: '#6b7280', transition: 'all 0.15s',
              }}>
                Reset View
              </button>
              <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.08)' }} />
            </>
          )}
        </div>

        {/* Right: Save + Download */}
        <div style={{ position: 'absolute', right: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Save as Project */}
          <button
            onClick={handleSaveProject}
            disabled={saving}
            style={{
              height: 34, padding: '0 14px', borderRadius: 8, border: '1.5px solid ' + PINK, cursor: saving ? 'wait' : 'pointer',
              background: '#fff', color: PINK,
              fontSize: 12, fontWeight: 700, fontFamily: FONT,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: saving ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = 'rgba(233,30,99,0.06)'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? 'Saving...' : 'Save'}
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDlMenu(p => !p)}
              style={{
                height: 34, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: PINK, color: '#fff',
                fontSize: 12, fontWeight: 700, fontFamily: FONT,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = PINK_DARK; }}
              onMouseLeave={e => { e.currentTarget.style.background = PINK; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showDlMenu && (
              <div style={{
                position: 'absolute', bottom: 42, right: 0, width: 160,
                background: '#fff', borderRadius: 12, overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08)',
                zIndex: 50,
              }}>
                {[
                  { fmt: 'dxf', label: 'DXF (CAD)', color: '#7c3aed' },
                  { fmt: 'svg', label: 'SVG', color: '#0d9488' },
                  { fmt: 'pdf', label: 'PDF', color: '#1e40af' },
                ].map(opt => (
                  <button key={opt.fmt}
                    onClick={() => { handleDownload(opt.fmt); setShowDlMenu(false); }}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer',
                      background: 'transparent', textAlign: 'left',
                      fontSize: 12, fontWeight: 600, fontFamily: FONT, color: '#374151',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Chatbot */}
      <FloatingChat />
    </div>
  );
}
