/**
 * HeartBoxTestPage — Parametric heart-shaped box test page
 *
 * Architecture: [Icon Rail 64px] → [Flyout Panel 360px floating]
 * Tabs: Shape | Size | Lid (3D only)
 */

import { useState, useMemo, useRef, useCallback, useEffect, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Link, useLocation } from 'react-router-dom';
import FloatingChat from '../components/Chatbot/FloatingChat';
import { useChatbot } from '../contexts/ChatbotContext';
import { parseDxf } from '../engine/dxfParser';
import HeartFoldBox from '../components/Box3D/HeartFoldBox';
import { getScheme } from '../components/Box3D/cardboardColors';
import MaterialPresetPicker, { MATERIAL_PRESETS } from '../components/Box3D/MaterialPresetPicker';
import heartDxfRaw from '../assets/heart-100x40.dxf?raw';

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
function LidIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5v14" />
      <path d="M17 7l-5 5-5-5" />
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
function LogoutIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
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
function SupportSlider({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#111827', fontFamily: MONO }}>{Number(value).toFixed(1)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%', height: 3, accentColor: PINK, cursor: 'pointer' }} />
    </div>
  );
}

function SupportPreviewMini({ config }) {
  const holes = config.holes || [];
  const svgW = 140;
  const svgH = 90;
  const scale = 3.5;
  const cx = svgW / 2;
  const cy = svgH / 2;
  return (
    <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 0', display: 'flex', justifyContent: 'center' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <rect x={4} y={4} width={svgW - 8} height={svgH - 8} rx={6} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={1} />
        {holes.map((hole, i) => {
          const hx = cx + hole.x * scale;
          const hy = cy - hole.y * scale;
          if (hole.type === 'circle') return <circle key={i} cx={hx} cy={hy} r={(hole.r || 2) * scale} fill="#fff" stroke="#6b7280" strokeWidth={1} />;
          if (hole.type === 'rect') {
            const w = (hole.w || 3) * scale;
            const l = (hole.l || 5) * scale;
            return <rect key={i} x={hx - w / 2} y={hy - l / 2} width={w} height={l} rx={2} fill="#fff" stroke="#6b7280" strokeWidth={1} />;
          }
          const w = (hole.w || 3) * scale;
          const l = (hole.l || 5) * scale;
          return <rect key={i} x={hx - w / 2} y={hy - l / 2} width={w} height={l} rx={w / 2} fill="#fce4ec" stroke={PINK} strokeWidth={1} />;
        })}
      </svg>
    </div>
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
  { id: 'lid',   label: 'Lid',   icon: LidIcon },
  { id: 'support', label: 'Support', icon: SupportIcon },
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
    holes: [{ id: 1, type: 'circle', x: 0, y: 0, r: 2.5 }],
  });

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
  }, []);

  // --- Chatbot sync: dimensions, material, support ---
  const { collectedData } = useChatbot();
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

  const [view, setView] = useState('3d');
  const [activeTab, setActiveTab] = useState(null);

  const heartPreviewColor = useMemo(() => getScheme(boxStyle).lidCap, [boxStyle]);

  const addHole = (type) => {
    const newHole = { id: Date.now(), type, x: 0, y: 0 };
    if (type === 'circle') newHole.r = 2.0;
    else { newHole.w = 3.0; newHole.l = 5.0; }
    setSupportConfig(prev => ({ ...prev, holes: [...(prev.holes || []), newHole] }));
  };
  const removeHole = (id) => {
    setSupportConfig(prev => ({ ...prev, holes: prev.holes.filter(h => h.id !== id) }));
  };
  const updateHole = (id, prop, val) => {
    setSupportConfig(prev => ({
      ...prev,
      holes: prev.holes.map(h => (h.id === id ? { ...h, [prop]: val } : h)),
    }));
  };

  // 2D DXF pan/zoom
  const svgRef = useRef(null);
  const [svgVB, setSvgVB] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [svgVBStart, setSvgVBStart] = useState(null);

  const dieline = useMemo(() => {
    const result = parseDxf(heartDxfRaw);
    result.bounds = computeBounds(result);
    return result;
  }, []);

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

  const cutStroke = Math.max(0.8, vb.w * 0.002);
  const creaseStroke = Math.max(0.5, vb.w * 0.0012);
  const dashPattern = `${vb.w * 0.006} ${vb.w * 0.004}`;
  const toggle = (id) => setActiveTab(prev => prev === id ? null : id);

  // Hide Lid / Support in 2D mode
  const visibleTabs = view === '3d' ? TABS : TABS.filter(t => t.id !== 'lid' && t.id !== 'support');

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: FONT, background: '#1a1d23', position: 'relative' }}>

      {/* === Icon Rail (flush left edge) === */}
      <div style={{
        width: RAIL_W, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: '#f3f4f6',
        borderRight: '1px solid rgba(0,0,0,0.06)',
        paddingTop: 16, paddingBottom: 16,
        zIndex: 40,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: `linear-gradient(135deg, ${PINK}, ${PINK_DARK})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: FONT,
          }}>H</div>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#9ca3af', marginTop: 3, fontFamily: FONT, letterSpacing: '0.05em' }}>HEART</span>
        </div>

        <div style={{ width: 32, height: 1, background: 'rgba(0,0,0,0.08)', marginBottom: 8 }} />

        {/* View toggle */}
        {['2d', '3d'].map(v => (
          <button key={v} onClick={() => { setView(v); if (v === '2d' && (activeTab === 'lid' || activeTab === 'support')) setActiveTab(null); }} title={v === '2d' ? '2D Dieline' : '3D View'} style={{
            width: 44, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: view === v ? 'rgba(233,30,99,0.1)' : 'transparent',
            color: view === v ? PINK : '#6b7280',
            fontSize: 12, fontWeight: 800, fontFamily: MONO,
            transition: 'all 0.2s',
          }}>
            {v.toUpperCase()}
          </button>
        ))}

        <div style={{ width: 32, height: 1, background: 'rgba(0,0,0,0.08)', margin: '8px 0' }} />

        {/* Tab buttons */}
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => toggle(tab.id)}
              title={tab.label}
              style={{
                width: 48, height: 48, borderRadius: 12, border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                background: isActive ? 'rgba(233,30,99,0.1)' : 'transparent',
                color: isActive ? PINK : '#374151',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(233,30,99,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(233,30,99,0.1)' : 'transparent'; }}
            >
              {isActive && (
                <div style={{ position: 'absolute', left: 3, top: '50%', transform: 'translateY(-50%)', width: 4, height: 4, borderRadius: '50%', background: PINK }} />
              )}
              <tab.icon size={18} />
              <span style={{ fontSize: 8, fontWeight: 600, lineHeight: 1, fontFamily: FONT, letterSpacing: '0.01em' }}>{tab.label}</span>
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom links */}
        <div style={{ width: 32, height: 1, background: 'rgba(0,0,0,0.08)', margin: '4px 0 8px' }} />

        <Link to="/projects" title="Projects" style={{
          width: 48, height: 48, borderRadius: 12, border: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          color: '#374151', textDecoration: 'none', transition: 'color 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = PINK; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#374151'; }}
        >
          <ProjectsIcon size={18} />
          <span style={{ fontSize: 8, fontWeight: 600, fontFamily: FONT }}>Projects</span>
        </Link>

        <Link to="/login" title="Logout" style={{
          width: 48, height: 48, borderRadius: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          color: '#374151', textDecoration: 'none', transition: 'color 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#374151'; }}
        >
          <LogoutIcon size={18} />
          <span style={{ fontSize: 8, fontWeight: 600, fontFamily: FONT }}>Logout</span>
        </Link>
      </div>

      {/* === Flyout Panel (floating, overlaid on viewer) === */}
      <div style={{
        position: 'absolute', top: 12, left: RAIL_W + 12, bottom: 12, zIndex: 35,
        width: activeTab ? PANEL_W : 0,
        opacity: activeTab ? 1 : 0,
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
        pointerEvents: activeTab ? 'auto' : 'none',
      }}>
        <div style={{
          width: PANEL_W, height: '100%',
          background: '#f3f4f6', borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
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

            {/* ── Lid tab (3D only) ── */}
            {activeTab === 'lid' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Section label="Lid animation">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16 }}>
                    <SliderField label="Lid open" value={Math.round(lidOpen * 100)} min={0} max={100} step={1} unit="%" onChange={e => { setLidOpen(+e.target.value / 100); if (view !== '3d') setView('3d'); }} />
                  </div>
                </Section>

                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FONT }}>
                  Drag slider to animate lid opening in the 3D view.
                </div>
              </div>
            )}

            {/* ── Support tab (3D) ── */}
            {activeTab === 'support' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 14,
                  padding: '12px 16px',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: FONT }}>แสดงชั้นซัพพอร์ต</div>
                    <div style={{ fontSize: 10, color: '#6b7280', fontFamily: FONT, marginTop: 2 }}>ถาดรองสินค้าภายใน (ครอบคลุมพื้นที่โดยประมาณ)</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowSupport(p => !p); if (view !== '3d') setView('3d'); }}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      border: 'none',
                      cursor: 'pointer',
                      background: showSupport ? PINK : '#d1d5db',
                      transition: 'background 0.2s',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: 3,
                      left: showSupport ? 23 : 3,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>

                <Section label={`ความสูงขอบ — ${Math.round((supportConfig.wallHeight || 0.78) * 100)}%`}>
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16 }}>
                    <input
                      type="range"
                      min="40"
                      max="95"
                      value={Math.round((supportConfig.wallHeight || 0.78) * 100)}
                      onChange={e => setSupportConfig(prev => ({ ...prev, wallHeight: parseInt(e.target.value, 10) / 100 }))}
                      style={{ width: '100%', height: 4, accentColor: PINK, cursor: 'pointer' }}
                    />
                  </div>
                </Section>

                <Section label="เจาะรู">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { type: 'circle', label: 'วงกลม', icon: '○' },
                      { type: 'rect', label: 'สี่เหลี่ยม', icon: '□' },
                      { type: 'capsule', label: 'แคปซูล', icon: '⬭' },
                    ].map(opt => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => addHole(opt.type)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: 10,
                          border: '1px solid rgba(0,0,0,0.1)',
                          background: 'rgba(255,255,255,0.6)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{opt.icon}</span>
                        <span style={{ fontSize: 9, color: '#111827', fontWeight: 600 }}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </Section>

                {supportConfig.holes.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px 10px',
                    color: '#6b7280',
                    fontSize: 11,
                    background: 'rgba(0,0,0,0.03)',
                    borderRadius: 10,
                  }}>
                    ยังไม่มีรู — เพิ่มด้านบน
                  </div>
                )}

                {supportConfig.holes.map((hole, idx) => {
                  const typeLabel = hole.type === 'circle' ? '○ วงกลม' : hole.type === 'rect' ? '□ สี่เหลี่ยม' : '⬭ แคปซูล';
                  return (
                    <div key={hole.id} style={{
                      background: '#fff',
                      borderRadius: 12,
                      padding: '10px 12px',
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', fontFamily: FONT }}>
                          #{idx + 1} {typeLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeHole(hole.id)}
                          style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: 'none',
                            borderRadius: 6,
                            color: '#ef4444',
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '3px 8px',
                          }}
                        >
                          ลบ
                        </button>
                      </div>
                      <SupportSlider label="X" value={hole.x} min={-15} max={15} step={0.5} onChange={v => updateHole(hole.id, 'x', v)} />
                      <SupportSlider label="Y" value={hole.y} min={-15} max={15} step={0.5} onChange={v => updateHole(hole.id, 'y', v)} />
                      {hole.type === 'circle' ? (
                        <SupportSlider label="รัศมี" value={hole.r || 2} min={0.5} max={10} step={0.1} onChange={v => updateHole(hole.id, 'r', v)} />
                      ) : (
                        <>
                          <SupportSlider label="กว้าง" value={hole.w || 3} min={1} max={15} step={0.1} onChange={v => updateHole(hole.id, 'w', v)} />
                          <SupportSlider label="ยาว" value={hole.l || 5} min={1} max={20} step={0.1} onChange={v => updateHole(hole.id, 'l', v)} />
                        </>
                      )}
                    </div>
                  );
                })}

                <Section label="ตัวอย่างรูบนแผ่น">
                  <SupportPreviewMini config={supportConfig} />
                </Section>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === Viewer (fills remaining space) === */}
      <div style={{ flex: 1, position: 'relative' }}>
        {view === '2d' ? (
          <div style={{ width: '100%', height: '100%', background: '#1a1d23' }}>
            <svg
              ref={svgRef}
              style={{ width: '100%', height: '100%', cursor: isPanning ? 'grabbing' : 'grab' }}
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
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
              {dieline.crease.map((pl, i) => (
                <path key={`cr-${i}`} d={polylineToPath(pl)} fill="none" stroke={CREASE_COLOR} strokeWidth={creaseStroke} strokeDasharray={dashPattern} strokeLinejoin="round" />
              ))}
              {dieline.cut.map((pl, i) => (
                <path key={`ct-${i}`} d={polylineToPath(pl)} fill="none" stroke={CUT_COLOR} strokeWidth={cutStroke} strokeLinejoin="round" strokeLinecap="round" />
              ))}
            </svg>
          </div>
        ) : (
          <Canvas camera={{ position: [0, 3, 5], fov: 45 }} style={{ width: '100%', height: '100%' }}>
            <color attach="background" args={['#fff5f7']} />
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
            <gridHelper args={[10, 10, '#f8bbd0', '#fce4ec']} />
          </Canvas>
        )}

        {/* Dimension badge */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          background: 'rgba(255,255,255,0.9)', borderRadius: 8,
          padding: '4px 10px', fontSize: 11, fontFamily: MONO,
          color: PINK_DARK, zIndex: 10,
        }}>
          {length} x {height} mm | {MATERIAL_PRESETS.find(m => m.id === boxStyle)?.label ?? boxStyle} | Shape {shapePct}% | Tilt {tiltDeg}deg
        </div>

        {view === '2d' && (
          <div style={{
            position: 'absolute', bottom: 12, right: 12,
            background: 'rgba(255,255,255,0.9)', borderRadius: 8,
            padding: '4px 10px', display: 'flex', gap: 12,
            fontSize: 11, fontFamily: MONO, zIndex: 10,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 14, height: 2, background: CUT_COLOR }} /> Cut
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 14, height: 0, borderTop: `2px dashed ${CREASE_COLOR}` }} /> Crease
            </span>
          </div>
        )}
      </div>

      {/* Floating Chatbot */}
      <FloatingChat />
    </div>
  );
}
