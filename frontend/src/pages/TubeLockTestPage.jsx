/**
 * TubeLockTestPage — Test page for the tube-lock / tuck-end DXF dieline
 *
 * Architecture matches StudioPanel:
 *   [Icon Rail 64px flush left] → [Flyout Panel 340px floating]
 *
 * Tabs: Design | Material | Dimensions | Strength
 */

import { useState, useMemo, useRef, useCallback, useEffect, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Link } from 'react-router-dom';
import FloatingChat from '../components/Chatbot/FloatingChat';
import { parseDxf } from '../engine/dxfParser';
import TubeLockFoldBox from '../components/Box3D/TubeLockFoldBox';
import MaterialPresetPicker, { MATERIAL_PRESETS } from '../components/Box3D/MaterialPresetPicker';
import useImagePlacement from '../hooks/useImagePlacement';
import ImageUploadPanel from '../components/DesignOverlay/ImageUploadPanel';
import DielineImageOverlay from '../components/DesignOverlay/DielineImageOverlay';
import { generatePanelTextures } from '../utils/textureGenerator';
import tubeDxfRaw from '../assets/500x150x120-tube-lock-box.dxf?raw';

/* ── Reference box dimensions ── */
const REF_W = 150;
const REF_L = 500;
const REF_D = 120;

/* ── Design tokens ── */
const FONT = "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', monospace";
const PURPLE = '#7c3aed';
const PURPLE_DARK = '#6d28d9';
const RAIL_W = 64;
const PANEL_W = 360;

function ease(p, s, e) {
  if (p <= s) return 0;
  if (p >= e) return 1;
  const t = (p - s) / (e - s);
  return t * t * (3 - 2 * t);
}

const CUT_COLOR = '#cc2222';
const CREASE_COLOR = '#22aa44';
const GRID_COLOR = 'rgba(255,255,255,0.04)';

/* ── McKee Strength Analysis v2 ── */
const FLUTE_SPECS = {
  A:  { ect: 6.0,  caliper: 4.5, name: 'ลอน A (หนาสุด)' },
  B:  { ect: 5.2,  caliper: 2.5, name: 'ลอน B (บาง)' },
  C:  { ect: 5.6,  caliper: 3.6, name: 'ลอน C (มาตรฐาน)' },
  E:  { ect: 3.8,  caliper: 1.5, name: 'ลอน E (จิ๋ว)' },
  BC: { ect: 10.8, caliper: 6.1, name: 'ลอน BC (2 ชั้น)' },
};
const HUMIDITY_OPTIONS = [
  { key: 'dry',    label: 'แห้ง (<50% RH)',        factor: 1.0 },
  { key: 'normal', label: 'ปกติ (50-70% RH)',      factor: 0.85 },
  { key: 'humid',  label: 'ชื้น (70-85% RH)',      factor: 0.65 },
  { key: 'wet',    label: 'เปียกชื้นมาก (>85% RH)', factor: 0.50 },
];
const STORAGE_OPTIONS = [
  { key: 'short',  label: 'ระยะสั้น (<10 วัน)',   factor: 1.0 },
  { key: 'medium', label: 'ปานกลาง (10-30 วัน)',  factor: 0.85 },
  { key: 'long',   label: 'ระยะยาว (30-90 วัน)',  factor: 0.70 },
  { key: 'vlong',  label: 'นานมาก (>90 วัน)',      factor: 0.55 },
];

function mckeeBCT(ectKnM, caliperMm, perimeterMm) {
  const ectLbfIn = ectKnM * 5.71015;
  const zIn = perimeterMm / 25.4;
  const hIn = caliperMm / 25.4;
  return 5.87 * ectLbfIn * Math.sqrt(hIn * zIn) * 0.453592;
}
function heightCorrection(l, w, h) {
  const r = h / Math.sqrt(l * w);
  return r <= 1.5 ? 1.0 : 1.5 / r;
}
function analyzeStrength(l, w, h, wt, ft, opts = {}) {
  const { humidity = 'normal', storage = 'short', stackingLayers = 3, printCoverage = 0 } = opts;
  const flute = FLUTE_SPECS[ft] || FLUTE_SPECS.C;
  const peri = 2 * (l + w);
  const base = mckeeBCT(flute.ect, flute.caliper, peri);
  const hC = heightCorrection(l, w, h);
  const huF = (HUMIDITY_OPTIONS.find(x => x.key === humidity) || HUMIDITY_OPTIONS[1]).factor;
  const stF = (STORAGE_OPTIONS.find(x => x.key === storage) || STORAGE_OPTIONS[0]).factor;
  const prF = 1 - (printCoverage / 100) * 0.20;
  const tF = hC * huF * stF * prF;
  const adj = base * tF;
  const max = adj / stackingLayers;
  const sf = wt > 0 ? max / wt : 999;
  let score;
  if (sf >= 5) score = 100;
  else if (sf >= 3) score = Math.round(70 + (sf - 3) * 15);
  else if (sf >= 2) score = Math.round(50 + (sf - 2) * 20);
  else if (sf >= 1.5) score = Math.round(30 + (sf - 1.5) * 40);
  else if (sf >= 1) score = Math.round(10 + (sf - 1) * 40);
  else score = Math.max(0, Math.round(sf * 10));
  score = Math.max(0, Math.min(100, score));
  let status, statusColor, statusIcon;
  if (score >= 70) { status = 'ปลอดภัย'; statusColor = '#43a047'; statusIcon = '✅'; }
  else if (score >= 40) { status = 'เสี่ยง'; statusColor = '#ff9800'; statusIcon = '⚠️'; }
  else { status = 'อันตราย'; statusColor = '#ef5350'; statusIcon = '🚨'; }
  return {
    status, statusColor, statusIcon, score,
    baseBCT: Math.round(base * 100) / 100, adjustedBCT: Math.round(adj * 100) / 100,
    maxLoadKg: Math.round(max * 100) / 100, safetyFactor: Math.round(sf * 100) / 100,
    fluteName: flute.name, perimeterMm: peri,
    corrections: { height: Math.round(hC * 100), humidity: Math.round(huF * 100), storage: Math.round(stF * 100), print: Math.round(prF * 100), total: Math.round(tF * 100) },
  };
}

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
function scaleTubeLock(raw, W, L, D) {
  if (W === REF_W && L === REF_L && D === REF_D) return { ...raw, bounds: computeBounds(raw) };
  const rX = [-REF_D, 0, REF_W, REF_W + REF_D, REF_W + REF_D + REF_W], tX = [-D, 0, W, W + D, W + D + W];
  const rG = 40, tG = rG * (D / REF_D);
  const rT = REF_D - 3, tT = D - 3, rTn = 25, tTn = 25;
  const rY = [-(rT + rTn), -rT, 0, REF_L, REF_L + rT, REF_L + rT + rTn], tY = [-(tT + tTn), -tT, 0, L, L + tT, L + tT + tTn];
  const pw = (v, rb, tb) => {
    if (v <= rb[0]) return tb[0] + (v - rb[0]) * ((tb[1] - tb[0]) / (rb[1] - rb[0]));
    if (v >= rb[rb.length - 1]) { const n = rb.length - 1; return tb[n] + (v - rb[n]) * ((tb[n] - tb[n - 1]) / (rb[n] - rb[n - 1])); }
    for (let i = 0; i < rb.length - 1; i++) if (v <= rb[i + 1]) { const t = (v - rb[i]) / (rb[i + 1] - rb[i]); return tb[i] + t * (tb[i + 1] - tb[i]); }
    return v;
  };
  const mX = x => x < rX[0] ? tX[0] + (x - rX[0]) * (tG / rG) : pw(x, rX, tX);
  const mY = y => pw(y, rY, tY);
  const mp = pls => pls.map(pl => pl.map(([x, y]) => [mX(x), mY(y)]));
  const s = { cut: mp(raw.cut || []), crease: mp(raw.crease || []) };
  s.bounds = computeBounds(s);
  return s;
}

/* ── Icons ── */
function MaterialIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
      <path d="M12 22a10 10 0 0010-10h-4a6 6 0 01-6 6v4z" />
    </svg>
  );
}
function DesignIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
function DimensionsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 3H3v18h18V3z" />
      <path d="M9 3v18M3 9h18" />
    </svg>
  );
}
function StrengthIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
function FoldIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M2 12h20" />
      <path d="M17 7l-5 5-5-5" />
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

const TABS = [
  { id: 'design',     label: 'Design',     icon: DesignIcon },
  { id: 'material',   label: 'Material',   icon: MaterialIcon },
  { id: 'dimensions', label: 'Size',       icon: DimensionsIcon },
  { id: 'fold',       label: 'Fold',       icon: FoldIcon },
  { id: 'strength',   label: 'Strength',   icon: StrengthIcon },
];

/* ── Shared UI primitives ── */
function Section({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 8, fontFamily: FONT }}>{label}</div>
      {children}
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
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} style={{ width: '100%', height: 4, accentColor: PURPLE, cursor: 'pointer' }} />
    </div>
  );
}

/* ── Error Boundary ── */
class TubeErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: FONT, color: '#c00' }}>
        <h2>TubeLockTestPage Error:</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
      </div>
    );
    return this.props.children;
  }
}

export default function TubeLockTestPage() {
  return <TubeErrorBoundary><TubeLockTestPageInner /></TubeErrorBoundary>;
}

/* ================================================================
 * Main Component
 * ============================================================== */
function TubeLockTestPageInner() {
  const [W, setW] = useState(REF_W);
  const [L, setL] = useState(REF_L);
  const [D, setD] = useState(REF_D);
  const [view, setView] = useState('2d');
  const [fold, setFold] = useState(0);
  const [activeTab, setActiveTab] = useState(null);
  const [boxStyle, setBoxStyle] = useState('kraft');

  // Strength
  const [weightKg, setWeightKg] = useState(10);
  const [fluteType, setFluteType] = useState('C');
  const [humidity, setHumidity] = useState('normal');
  const [storage, setStorage] = useState('short');
  const [stackingLayers, setStackingLayers] = useState(3);
  const [printCoverage, setPrintCoverage] = useState(0);

  // SVG pan/zoom
  const svgRef = useRef(null);
  const [svgVB, setSvgVB] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [svgVBStart, setSvgVBStart] = useState(null);

  // Image placement
  const [panelTextureUrls, setPanelTextureUrls] = useState({});
  const placement = useImagePlacement({ svgRef, viewBox: svgVB, defaultPlaceWidth: Math.min(300, W) });

  const tuckH = D - 3;
  const panelZones = useMemo(() => [
    { id: 'face1', label: 'หน้า 1', x: 0, y: 0, w: W, h: L },
    { id: 'side1', label: 'ข้าง 1', x: W, y: 0, w: D, h: L },
    { id: 'face2', label: 'หน้า 2', x: W + D, y: 0, w: W, h: L },
    { id: 'side2', label: 'ข้าง 2', x: -D, y: 0, w: D, h: L },
    { id: 'face2_tuck_bot', label: 'ฝาล่าง', x: W + D, y: -tuckH, w: W, h: tuckH },
    { id: 'face2_tuck_top', label: 'ฝาบน', x: W + D, y: L, w: W, h: tuckH },
    { id: 'side1_dust_bot', label: 'Dust S1 B', x: W, y: -tuckH, w: D, h: tuckH },
    { id: 'side1_dust_top', label: 'Dust S1 T', x: W, y: L, w: D, h: tuckH },
    { id: 'side2_dust_bot', label: 'Dust S2 B', x: -D, y: -tuckH, w: D, h: tuckH },
    { id: 'side2_dust_top', label: 'Dust S2 T', x: -D, y: L, w: D, h: tuckH },
  ], [W, L, D, tuckH]);
  const panelZonesRef = useRef(panelZones);
  panelZonesRef.current = panelZones;

  const regenerateTextures = useCallback(async () => {
    if (placement.placedImages.length === 0) { setPanelTextureUrls({}); return; }
    const bounds = { minX: -D - 50, maxX: 2 * W + D + 50, minY: -tuckH - 50, maxY: L + tuckH + 50 };
    const textures = await generatePanelTextures(placement.placedImages, panelZonesRef.current, bounds);
    setPanelTextureUrls(textures);
  }, [placement.placedImages, W, L, D, tuckH]);

  const handleViewIn3D = useCallback(async () => {
    await regenerateTextures();
    setView('3d');
    setFold(1);
  }, [regenerateTextures]);

  const switchTo3D = useCallback(async () => {
    await regenerateTextures();
    setView('3d');
  }, [regenerateTextures]);

  const analysisOpts = useMemo(() => ({ humidity, storage, stackingLayers, printCoverage }), [humidity, storage, stackingLayers, printCoverage]);
  const strength = useMemo(() => analyzeStrength(W, D, L, weightKg, fluteType, analysisOpts), [W, D, L, weightKg, fluteType, analysisOpts]);
  const fluteComparison = useMemo(() => Object.entries(FLUTE_SPECS).map(([k]) => ({ key: k, ...analyzeStrength(W, D, L, weightKg, k, analysisOpts) })), [W, D, L, weightKg, analysisOpts]);

  const rawDieline = useMemo(() => parseDxf(tubeDxfRaw), []);
  const dieline = useMemo(() => scaleTubeLock(rawDieline, W, L, D), [rawDieline, W, L, D]);
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

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: FONT, background: '#1a1d23', position: 'relative' }}>

      {/* ═══ Icon Rail (flush left edge) ═══ */}
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
            background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: FONT,
          }}>T</div>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#9ca3af', marginTop: 3, fontFamily: FONT, letterSpacing: '0.05em' }}>TUBE</span>
        </div>

        <div style={{ width: 32, height: 1, background: 'rgba(0,0,0,0.08)', marginBottom: 8 }} />

        {/* View toggle */}
        {['2d', '3d'].map(v => (
          <button key={v} onClick={() => v === '3d' ? switchTo3D() : setView('2d')} title={v === '2d' ? '2D Dieline' : '3D Fold'} style={{
            width: 44, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: view === v ? 'rgba(124,58,237,0.1)' : 'transparent',
            color: view === v ? PURPLE : '#6b7280',
            fontSize: 12, fontWeight: 800, fontFamily: MONO,
            transition: 'all 0.2s',
          }}>
            {v.toUpperCase()}
          </button>
        ))}

        <div style={{ width: 32, height: 1, background: 'rgba(0,0,0,0.08)', margin: '8px 0' }} />

        {/* Tab buttons */}
        {TABS.map(tab => {
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
                background: isActive ? 'rgba(124,58,237,0.1)' : 'transparent',
                color: isActive ? PURPLE : '#374151',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(124,58,237,0.05)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(124,58,237,0.1)' : 'transparent'; }}
            >
              {isActive && (
                <div style={{ position: 'absolute', left: 3, top: '50%', transform: 'translateY(-50%)', width: 4, height: 4, borderRadius: '50%', background: PURPLE }} />
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
          onMouseEnter={e => { e.currentTarget.style.color = PURPLE; }}
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

      {/* ═══ Flyout Panel (floating, overlaid on viewer) ═══ */}
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
            {activeTab === 'design' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ImageUploadPanel placement={placement} onViewIn3D={handleViewIn3D} currentView={view} />
              </div>
            )}

            {activeTab === 'material' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16 }}>
                  <MaterialPresetPicker value={boxStyle} onChange={setBoxStyle} accentColor={PURPLE} hint="สีกระดาษในมุมมอง 3D" />
                </div>
              </div>
            )}

            {activeTab === 'dimensions' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Section label="Box dimensions">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SliderField label="Face Width (W)" value={W} min={50} max={400} step={5} onChange={e => setW(+e.target.value)} />
                    <SliderField label="Body Length (L)" value={L} min={100} max={800} step={5} onChange={e => setL(+e.target.value)} />
                    <SliderField label="Side Depth (D)" value={D} min={30} max={300} step={5} onChange={e => setD(+e.target.value)} />
                    <div style={{
                      background: 'rgba(124,58,237,0.04)', borderRadius: 10,
                      padding: '8px 0', textAlign: 'center',
                      fontSize: 14, fontFamily: MONO, fontWeight: 700, color: PURPLE,
                    }}>
                      {W} x {D} x {L} mm
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

                {/* Layout diagram */}
                <Section label="Panel layout">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 8, fontFamily: FONT }}>X axis</div>
                    <div style={{ display: 'flex', gap: 3, height: 36, marginBottom: 14 }}>
                      {[
                        { flex: D, label: `D=${D}`, bg: '#10b981' },
                        { flex: W, label: `W=${W}`, bg: '#6366f1' },
                        { flex: D, label: `D=${D}`, bg: '#10b981' },
                        { flex: W, label: `W=${W}`, bg: '#6366f1' },
                      ].map((p, i) => (
                        <div key={i} style={{
                          flex: p.flex, background: p.bg, borderRadius: 6,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: 9, fontFamily: MONO,
                        }}>{p.label}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 8, fontFamily: FONT }}>Y axis</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 120 }}>
                      <div style={{ height: 18, background: '#f43f5e', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, fontFamily: MONO }}>Tuck {tuckH}+25</div>
                      <div style={{ height: 32, background: '#6366f1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700, fontFamily: MONO }}>Body L={L}</div>
                      <div style={{ height: 18, background: '#f43f5e', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, fontFamily: MONO }}>Tuck {tuckH}+25</div>
                    </div>
                  </div>
                </Section>

                {/* Total info */}
                <div style={{ fontSize: 11, color: '#6b7280', fontFamily: MONO }}>
                  Total: {2 * W + 2 * D} x {L + 2 * tuckH + 50} mm
                </div>
              </div>
            )}

            {activeTab === 'fold' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Section label="Fold animation">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16 }}>
                    <SliderField label="Fold progress" value={Math.round(fold * 100)} min={0} max={100} step={1} unit="%" onChange={e => { setFold(+e.target.value / 100); if (view !== '3d') setView('3d'); }} />
                  </div>
                </Section>

                <Section label="Fold phases">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', background: PURPLE, color: '#fff', fontWeight: 700, fontSize: 11, fontFamily: FONT, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Phase</span>
                      <span>{Math.round(fold * 100)}%</span>
                    </div>
                    <div>
                      {[
                        ['Sides up',       '0-30%',  ease(fold, 0.00, 0.30) * 90],
                        ['Back over',      '20-45%', ease(fold, 0.20, 0.45) * 90],
                        ['Dust flaps (B)', '40-58%', ease(fold, 0.40, 0.58) * 90],
                        ['Tuck panel (B)', '52-70%', ease(fold, 0.52, 0.70) * 90],
                        ['Tongue (B)',     '62-78%', ease(fold, 0.62, 0.78) * 90],
                        ['Dust flaps (T)', '65-80%', ease(fold, 0.65, 0.80) * 90],
                        ['Tuck panel (T)', '75-90%', ease(fold, 0.75, 0.90) * 90],
                        ['Tongue (T)',     '82-95%', ease(fold, 0.82, 0.95) * 90],
                      ].map(([name, range, deg]) => (
                        <div key={name} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)',
                          fontSize: 11, fontFamily: FONT,
                        }}>
                          <span style={{ flex: 1, fontWeight: 600, color: '#111827' }}>{name}</span>
                          <span style={{ fontSize: 10, color: '#6b7280', fontFamily: MONO, width: 44 }}>{range}</span>
                          <span style={{ fontWeight: 700, color: deg > 0 ? PURPLE : '#6b7280', fontFamily: MONO, width: 42, textAlign: 'right' }}>{deg.toFixed(1)}°</span>
                          <div style={{ width: 48, height: 5, background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>
                            <div style={{ height: 5, background: PURPLE, borderRadius: 3, width: `${(deg / 90) * 100}%`, transition: 'width 0.2s' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>
              </div>
            )}

            {activeTab === 'strength' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Score header */}
                <div style={{
                  background: strength.statusColor, borderRadius: 14, padding: '14px 18px',
                  color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT }}>{strength.statusIcon} McKee v2</div>
                    <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, fontFamily: FONT }}>{strength.status}</div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO }}>{strength.score}</div>
                </div>

                <Section label="Product weight">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16 }}>
                    <SliderField label="น้ำหนักสินค้า" value={weightKg} min={0} max={80} step={0.5} unit="kg" onChange={e => setWeightKg(+e.target.value)} />
                  </div>
                </Section>

                <Section label="Flute type">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 14 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {Object.entries(FLUTE_SPECS).map(([k]) => (
                        <button key={k} onClick={() => setFluteType(k)} style={{
                          flex: 1, padding: '7px 0', border: 'none', borderRadius: 8,
                          cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: MONO,
                          background: fluteType === k ? PURPLE : 'rgba(0,0,0,0.04)',
                          color: fluteType === k ? '#fff' : '#6b7280', transition: 'all 0.15s',
                        }}>{k}</button>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 6, fontFamily: FONT }}>{strength.fluteName}</div>
                  </div>
                </Section>

                <Section label="Environment">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 4, fontFamily: FONT }}>ความชื้น</div>
                        <select value={humidity} onChange={e => setHumidity(e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', fontFamily: FONT, color: '#111827', background: '#fff', outline: 'none' }}>
                          {HUMIDITY_OPTIONS.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 4, fontFamily: FONT }}>ระยะเก็บ</div>
                        <select value={storage} onChange={e => setStorage(e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', fontFamily: FONT, color: '#111827', background: '#fff', outline: 'none' }}>
                          {STORAGE_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <SliderField label="ชั้นซ้อน" value={stackingLayers} min={1} max={8} step={1} unit="ชั้น" onChange={e => setStackingLayers(+e.target.value)} />
                      <SliderField label="พื้นที่พิมพ์" value={printCoverage} min={0} max={100} step={5} unit="%" onChange={e => setPrintCoverage(+e.target.value)} />
                    </div>
                  </div>
                </Section>

                {/* Results */}
                <Section label="Results">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 11, fontFamily: FONT }}>
                      <span style={{ color: '#6b7280' }}>BCT (ดิบ)</span>
                      <span style={{ fontWeight: 600, textAlign: 'right', fontFamily: MONO }}>{strength.baseBCT} kgf</span>
                      <span style={{ color: '#6b7280' }}>BCT (ปรับแล้ว)</span>
                      <span style={{ fontWeight: 700, textAlign: 'right', color: strength.statusColor, fontFamily: MONO }}>{strength.adjustedBCT} kgf</span>
                      <span style={{ color: '#6b7280' }}>รับได้สูงสุด</span>
                      <span style={{ fontWeight: 700, textAlign: 'right', fontFamily: MONO }}>{strength.maxLoadKg} kg</span>
                      <span style={{ color: '#6b7280' }}>Safety Factor</span>
                      <span style={{ fontWeight: 700, textAlign: 'right', color: strength.statusColor, fontFamily: MONO }}>x{strength.safetyFactor}</span>
                    </div>

                    {/* Score bar */}
                    <div style={{ height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: 8, borderRadius: 4, width: `${strength.score}%`, background: strength.statusColor, transition: 'width 0.3s ease' }} />
                    </div>

                    {/* Correction pills */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 10, fontFamily: MONO }}>
                      {[['ความสูง', strength.corrections.height], ['ความชื้น', strength.corrections.humidity], ['เก็บนาน', strength.corrections.storage], ['พิมพ์', strength.corrections.print]].map(([lb, pc]) => (
                        <span key={lb} style={{ padding: '2px 8px', borderRadius: 6, background: pc < 100 ? 'rgba(234,88,12,0.08)' : 'rgba(34,197,94,0.08)', color: pc < 100 ? '#ea580c' : '#16a34a', fontWeight: 600 }}>{lb} {pc}%</span>
                      ))}
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.06)', fontWeight: 700, color: '#111827' }}>รวม {strength.corrections.total}%</span>
                    </div>
                  </div>
                </Section>

                {/* Flute comparison */}
                <Section label="Compare flutes">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: MONO }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                          <th style={{ textAlign: 'left', padding: '7px 12px', fontFamily: FONT, fontWeight: 700, color: '#6b7280' }}>ลอน</th>
                          <th style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700, color: '#6b7280' }}>BCT</th>
                          <th style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700, color: '#6b7280' }}>Max</th>
                          <th style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700, color: '#6b7280' }}>SF</th>
                          <th style={{ width: 28 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {fluteComparison.map(f => (
                          <tr key={f.key} style={{ borderTop: '1px solid rgba(0,0,0,0.04)', background: f.key === fluteType ? 'rgba(124,58,237,0.04)' : 'transparent' }}>
                            <td style={{ padding: '6px 12px', fontWeight: f.key === fluteType ? 800 : 500, color: f.key === fluteType ? PURPLE : '#111827' }}>{f.key}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{f.adjustedBCT}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{f.maxLoadKg}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: f.statusColor, fontWeight: 700 }}>x{f.safetyFactor}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{f.statusIcon}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Viewer (full remaining space) ═══ */}
      <div style={{ flex: 1, position: 'relative' }}>
        {view === '2d' ? (
          <div style={{ width: '100%', height: '100%', background: '#1a1d23' }}>
            <svg
              ref={svgRef}
              style={{ width: '100%', height: '100%', overflow: 'visible', cursor: placement.selectedImageId ? 'crosshair' : (isPanning ? 'grabbing' : 'grab') }}
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              onWheel={handleWheel}
              onMouseDown={e => { if (placement.selectedImageId) placement.handleDielinePlace(e); else { placement.setActiveImgId(null); handleMouseDown(e); } }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {(() => {
                const step = Math.pow(10, Math.floor(Math.log10(vb.w / 5))), lines = [];
                for (let x = Math.floor(vb.x / step) * step; x < vb.x + vb.w; x += step) lines.push(<line key={`gx-${x}`} x1={x} y1={vb.y} x2={x} y2={vb.y + vb.h} stroke={GRID_COLOR} strokeWidth={vb.w * 0.0005} />);
                for (let y = Math.floor(vb.y / step) * step; y < vb.y + vb.h; y += step) lines.push(<line key={`gy-${y}`} x1={vb.x} y1={y} x2={vb.x + vb.w} y2={y} stroke={GRID_COLOR} strokeWidth={vb.w * 0.0005} />);
                return lines;
              })()}
              {panelZones.map(z => <rect key={`z-${z.id}`} x={z.x} y={-(z.y + z.h)} width={z.w} height={z.h} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={vb.w * 0.0008} strokeDasharray={`${vb.w * 0.004} ${vb.w * 0.003}`} style={{ pointerEvents: 'none' }} />)}
              {dieline.crease.map((pl, i) => <path key={`cr-${i}`} d={polylineToPath(pl)} fill="none" stroke={CREASE_COLOR} strokeWidth={creaseStroke} strokeDasharray={dashPattern} strokeLinejoin="round" />)}
              {dieline.cut.map((pl, i) => <path key={`ct-${i}`} d={polylineToPath(pl)} fill="none" stroke={CUT_COLOR} strokeWidth={cutStroke} strokeLinejoin="round" strokeLinecap="round" />)}
              <DielineImageOverlay placement={placement} viewBox={vb} />
            </svg>
          </div>
        ) : (
          <Canvas camera={{ position: [6, 5, 6], fov: 45 }} style={{ width: '100%', height: '100%' }}>
            <color attach="background" args={['#5c5c5c']} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} />
            <TubeLockFoldBox width={W} length={L} depth={D} foldProgress={fold} panelImages={panelTextureUrls} boxStyle={boxStyle} />
            <OrbitControls makeDefault />
            <gridHelper args={[20, 20, '#e9d5ff', '#f3e8ff']} />
          </Canvas>
        )}

        {/* Dimension badge */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 10,
          background: 'rgba(255,255,255,0.95)', borderRadius: 10,
          padding: '6px 14px', fontSize: 12, fontFamily: MONO, fontWeight: 600,
          color: '#111827', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          {W} x {D} x {L} mm (Tube-Lock) · {MATERIAL_PRESETS.find(m => m.id === boxStyle)?.label ?? boxStyle}
        </div>

        {view === '2d' && (
          <div style={{
            position: 'absolute', bottom: 16, right: 16, zIndex: 10,
            background: 'rgba(255,255,255,0.95)', borderRadius: 10,
            padding: '6px 14px', display: 'flex', gap: 16, fontSize: 11,
            fontFamily: FONT, fontWeight: 600, color: '#111827',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 16, height: 2.5, background: CUT_COLOR, borderRadius: 1 }} /> Cut
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 16, height: 0, borderTop: `2.5px dashed ${CREASE_COLOR}` }} /> Crease
            </span>
          </div>
        )}
      </div>

      {/* Floating Chatbot */}
      <FloatingChat />
    </div>
  );
}
