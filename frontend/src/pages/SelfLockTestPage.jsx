/**
 * SelfLockTestPage — Self-locking box DXF dieline
 *
 * Reference DXF: 400x250x80mm-self-locking-box.dxf
 * Tabs: Design | Size | Fold | Support | Strength
 */

import { useState, useMemo, useRef, useCallback, useEffect, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Link } from 'react-router-dom';
import FloatingChat from '../components/Chatbot/FloatingChat';
import { parseDxf } from '../engine/dxfParser';
import SelfLockFoldBox from '../components/Box3D/SelfLockFoldBox';
import selfLockDxfRaw from '../assets/400x250x80mm-self-locking-box.dxf?raw';

/* ── Reference box dimensions ── */
const REF_W = 400;
const REF_H = 250;
const REF_D = 80;

/* ── Design tokens ── */
const FONT = "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', monospace";
const PURPLE = '#7c3aed';
const PURPLE_DARK = '#6d28d9';
const RAIL_W = 64;
const PANEL_W = 360;
const T = 3;

const CUT_COLOR = '#cc2222';
const CREASE_COLOR = '#22aa44';
const GRID_COLOR = 'rgba(255,255,255,0.04)';

function ease(p, s, e) {
  if (p <= s) return 0;
  if (p >= e) return 1;
  const t = (p - s) / (e - s);
  return t * t * (3 - 2 * t);
}

/* ── McKee Strength Analysis ── */
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

/* ── Self-lock scaling function ──
 * Reference: 400x250x80mm
 * Panel layout X: lockBump | lockPanel | lockStrip | depthL | face(W+9) | depthR | tabEar | topStrip(W-6) | gap | extension
 * Panel layout Y: bottomFlap(D) | face(H+6) | topFlap(D)
 */
function scaleSelfLock(raw, W, H, D) {
  if (W === REF_W && H === REF_H && D === REF_D) return { ...raw, bounds: computeBounds(raw) };

  const faceW_ref = REF_W + 9; // 409
  const faceW_new = W + 9;
  const depthW_ref = REF_D + T; // 83
  const depthW_new = D + T;
  const faceH_ref = REF_H + 2 * T; // 256
  const faceH_new = H + 2 * T;
  const lockStrip = 6; // 2T = 6
  const lockPanelW_ref = REF_D + 1.5; // 81.5
  const lockPanelW_new = D + 1.5;
  const lockBump = 4.5;
  const tabEar = 4.5;
  const topStripW_ref = REF_W - 2 * T; // 394
  const topStripW_new = W - 2 * T;

  // X breakpoints (reference)
  const rX = [
    -(lockBump + lockPanelW_ref + lockStrip + depthW_ref),  // -175
    -(lockStrip + depthW_ref),                                // -89
    -depthW_ref,                                              // -83
    0,
    faceW_ref,                                                // 409
    faceW_ref + depthW_ref,                                   // 492
    faceW_ref + depthW_ref + tabEar,                          // 496.5
    faceW_ref + depthW_ref + tabEar + topStripW_ref,          // 890.5
    faceW_ref + depthW_ref + tabEar + topStripW_ref + 1.5,    // 892
    faceW_ref + depthW_ref + tabEar + topStripW_ref + 1.5 + 68.5, // 960.5
    faceW_ref + depthW_ref + tabEar + topStripW_ref + 1.5 + 78.5, // 970.5
  ];
  const tX = [
    -(lockBump + lockPanelW_new + lockStrip + depthW_new),
    -(lockStrip + depthW_new),
    -depthW_new,
    0,
    faceW_new,
    faceW_new + depthW_new,
    faceW_new + depthW_new + tabEar,
    faceW_new + depthW_new + tabEar + topStripW_new,
    faceW_new + depthW_new + tabEar + topStripW_new + 1.5,
    faceW_new + depthW_new + tabEar + topStripW_new + 1.5 + 68.5,
    faceW_new + depthW_new + tabEar + topStripW_new + 1.5 + 78.5,
  ];

  // Y breakpoints (reference)
  const rY = [
    -REF_D,        // -80
    0,
    faceH_ref,     // 256
    faceH_ref + REF_D, // 336
  ];
  const tY = [
    -D,
    0,
    faceH_new,
    faceH_new + D,
  ];

  const pw = (v, rb, tb) => {
    if (v <= rb[0]) return tb[0] + (v - rb[0]) * ((tb[1] - tb[0]) / (rb[1] - rb[0]));
    if (v >= rb[rb.length - 1]) { const n = rb.length - 1; return tb[n] + (v - rb[n]) * ((tb[n] - tb[n - 1]) / (rb[n] - rb[n - 1])); }
    for (let i = 0; i < rb.length - 1; i++) if (v <= rb[i + 1]) { const t = (v - rb[i]) / (rb[i + 1] - rb[i]); return tb[i] + t * (tb[i + 1] - tb[i]); }
    return v;
  };
  const mX = x => pw(x, rX, tX);
  const mY = y => pw(y, rY, tY);
  const mp = pls => pls.map(pl => pl.map(([x, y]) => [mX(x), mY(y)]));
  const s = { cut: mp(raw.cut || []), crease: mp(raw.crease || []) };
  s.bounds = computeBounds(s);
  return s;
}

/* ── Icons ── */
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
function FoldIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M2 12h20" />
      <path d="M17 7l-5 5-5-5" />
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
function StrengthIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
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
  { id: 'size',     label: 'Size',     icon: DimensionsIcon },
  { id: 'fold',     label: 'Fold',     icon: FoldIcon },
  { id: 'support',  label: 'Support',  icon: SupportIcon },
  { id: 'strength', label: 'Strength', icon: StrengthIcon },
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

function SupportSlider({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#111827', fontFamily: MONO }}>{Number(value).toFixed(1)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%', height: 3, accentColor: PURPLE, cursor: 'pointer' }} />
    </div>
  );
}

function SupportPreviewMini({ config }) {
  const holes = config.holes || [];
  const svgW = 140, svgH = 90, scale = 3.5;
  const cx = svgW / 2, cy = svgH / 2;
  return (
    <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 0', display: 'flex', justifyContent: 'center' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <rect x={4} y={4} width={svgW - 8} height={svgH - 8} rx={6} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={1} />
        {holes.map((hole, i) => {
          const hx = cx + hole.x * scale, hy = cy - hole.y * scale;
          if (hole.type === 'circle') return <circle key={i} cx={hx} cy={hy} r={(hole.r || 2) * scale} fill="#fff" stroke="#6b7280" strokeWidth={1} />;
          if (hole.type === 'rect') { const w = (hole.w || 3) * scale, l = (hole.l || 5) * scale; return <rect key={i} x={hx - w / 2} y={hy - l / 2} width={w} height={l} rx={2} fill="#fff" stroke="#6b7280" strokeWidth={1} />; }
          const w = (hole.w || 3) * scale, l = (hole.l || 5) * scale;
          return <rect key={i} x={hx - w / 2} y={hy - l / 2} width={w} height={l} rx={w / 2} fill="#faf5ff" stroke="#a78bfa" strokeWidth={1} />;
        })}
      </svg>
    </div>
  );
}

/* ── Error Boundary ── */
class SelfLockErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: FONT, color: '#c00' }}>
        <h2>SelfLockTestPage Error:</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
      </div>
    );
    return this.props.children;
  }
}

/* ================================================================
 * Main export
 * ============================================================== */
export default function SelfLockTestPage() {
  return (
    <SelfLockErrorBoundary>
      <SelfLockStandalone />
    </SelfLockErrorBoundary>
  );
}

/* ================================================================
 * Standalone Component
 * ============================================================== */
function SelfLockStandalone() {
  const [W, setW] = useState(REF_W);
  const [H, setH] = useState(REF_H);
  const [D, setD] = useState(REF_D);
  const [view, setView] = useState('2d');
  const [fold, setFold] = useState(0);
  const [activeTab, setActiveTab] = useState(null);

  // Support insert
  const [showSupport, setShowSupport] = useState(false);
  const [supportConfig, setSupportConfig] = useState({
    wallHeight: 0.78,
    holes: [{ id: 1, type: 'circle', x: 0, y: 0, r: 2.5 }],
  });

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
      holes: prev.holes.map(h => h.id === id ? { ...h, [prop]: val } : h),
    }));
  };

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

  const analysisOpts = useMemo(() => ({ humidity, storage, stackingLayers, printCoverage }), [humidity, storage, stackingLayers, printCoverage]);
  const strength = useMemo(() => analyzeStrength(W, D, H, weightKg, fluteType, analysisOpts), [W, D, H, weightKg, fluteType, analysisOpts]);
  const fluteComparison = useMemo(() => Object.entries(FLUTE_SPECS).map(([k]) => ({ key: k, ...analyzeStrength(W, D, H, weightKg, k, analysisOpts) })), [W, D, H, weightKg, analysisOpts]);

  const rawDieline = useMemo(() => parseDxf(selfLockDxfRaw), []);
  const dieline = useMemo(() => scaleSelfLock(rawDieline, W, H, D), [rawDieline, W, H, D]);

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

  // Derived values for layout diagram
  const faceW = W + 9;
  const faceH = H + 2 * T;
  const depthW = D + T;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: FONT, background: '#1a1d23', position: 'relative' }}>

      {/* ═══ Icon Rail ═══ */}
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
            color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: FONT,
          }}>SL</div>
          <span style={{ fontSize: 7, fontWeight: 700, color: '#9ca3af', marginTop: 3, fontFamily: FONT, letterSpacing: '0.05em' }}>SELF-LOCK</span>
        </div>

        <div style={{ width: 32, height: 1, background: 'rgba(0,0,0,0.08)', marginBottom: 8 }} />

        {/* View toggle */}
        {['2d', '3d'].map(v => (
          <button key={v} onClick={() => setView(v)} title={v === '2d' ? '2D Dieline' : '3D Fold'} style={{
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
              onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(124,58,237,0.1)' : 'transparent'; }}
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

        <Link to="/" title="Home" style={{
          width: 48, height: 48, borderRadius: 12, border: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          color: '#374151', textDecoration: 'none', transition: 'color 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = PURPLE; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#374151'; }}
        >
          <ProjectsIcon size={18} />
          <span style={{ fontSize: 8, fontWeight: 600, fontFamily: FONT }}>Home</span>
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

      {/* ═══ Flyout Panel ═══ */}
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

            {/* ── Size tab ── */}
            {activeTab === 'size' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Section label="Box dimensions">
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SliderField label="Width (W)" value={W} min={100} max={800} step={5} onChange={e => setW(+e.target.value)} />
                    <SliderField label="Height (H)" value={H} min={100} max={600} step={5} onChange={e => setH(+e.target.value)} />
                    <SliderField label="Depth (D)" value={D} min={20} max={200} step={1} onChange={e => setD(+e.target.value)} />
                    <div style={{
                      background: 'rgba(124,58,237,0.04)', borderRadius: 10,
                      padding: '8px 0', textAlign: 'center',
                      fontSize: 14, fontFamily: MONO, fontWeight: 700, color: PURPLE,
                    }}>
                      {W} x {H} x {D} mm (Self-Lock)
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
                        { flex: D + 1.5, label: `lock`, bg: '#f59e0b' },
                        { flex: 6, label: `strip`, bg: '#94a3b8' },
                        { flex: D + T, label: `D+T=${Math.round(depthW)}`, bg: '#10b981' },
                        { flex: W + 9, label: `W+9=${Math.round(faceW)}`, bg: '#6366f1' },
                        { flex: D + T, label: `D+T=${Math.round(depthW)}`, bg: '#10b981' },
                        { flex: W - 6, label: `strip`, bg: '#f43f5e' },
                      ].map((p, i) => (
                        <div key={i} style={{
                          flex: Math.max(p.flex, 8), background: p.bg, borderRadius: 6,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: 8, fontFamily: MONO,
                          overflow: 'hidden', whiteSpace: 'nowrap',
                        }}>{p.label}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 8, fontFamily: FONT }}>Y axis</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 140 }}>
                      {[
                        { h: 18, label: `bottom D=${D}`, bg: '#f43f5e' },
                        { h: 32, label: `face H+6=${Math.round(faceH)}`, bg: '#6366f1' },
                        { h: 18, label: `top D=${D}`, bg: '#f43f5e' },
                      ].map((p, i) => (
                        <div key={i} style={{
                          height: p.h, background: p.bg, borderRadius: 6,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8, color: '#fff', fontWeight: 600, fontFamily: MONO,
                        }}>{p.label}</div>
                      ))}
                    </div>
                  </div>
                </Section>
              </div>
            )}

            {/* ── Fold tab ── */}
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
                        ['Bottom flap',    '0-22%',  ease(fold, 0.00, 0.22) * 90],
                        ['Side walls',     '18-38%', ease(fold, 0.18, 0.38) * 90],
                        ['Lock panels',    '30-50%', ease(fold, 0.30, 0.50) * 90],
                        ['Top strip',      '0-22%',  ease(fold, 0.00, 0.22) * 90],
                        ['Back panel',     '48-68%', ease(fold, 0.48, 0.68) * 90],
                        ['Tongue/lock',    '58-75%', ease(fold, 0.58, 0.75) * 90],
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

            {/* ── Support tab ── */}
            {activeTab === 'support' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Toggle */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: '12px 16px',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: FONT }}>Show Support Insert</div>
                    <div style={{ fontSize: 10, color: '#6b7280', fontFamily: FONT, marginTop: 2 }}>ชั้นรองสินค้าภายในกล่อง</div>
                  </div>
                  <button
                    onClick={() => { setShowSupport(p => !p); if (view !== '3d') setView('3d'); }}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: showSupport ? PURPLE : '#d1d5db', transition: 'background 0.2s',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: showSupport ? 23 : 3,
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>

                {/* Wall height */}
                <Section label={`Wall height — ${Math.round((supportConfig.wallHeight || 0.78) * 100)}%`}>
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16 }}>
                    <input
                      type="range" min="40" max="95"
                      value={Math.round((supportConfig.wallHeight || 0.78) * 100)}
                      onChange={e => setSupportConfig(prev => ({ ...prev, wallHeight: parseInt(e.target.value) / 100 }))}
                      style={{ width: '100%', height: 4, accentColor: PURPLE, cursor: 'pointer' }}
                    />
                  </div>
                </Section>

                {/* Add hole buttons */}
                <Section label="Add holes">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { type: 'circle',  label: 'Circle',  icon: '○' },
                      { type: 'rect',    label: 'Rect',    icon: '□' },
                      { type: 'capsule', label: 'Capsule', icon: '⬭' },
                    ].map(opt => (
                      <button
                        key={opt.type}
                        onClick={() => addHole(opt.type)}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: 10,
                          border: '1px solid rgba(0,0,0,0.1)',
                          background: 'rgba(255,255,255,0.6)',
                          cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; }}
                      >
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{opt.icon}</span>
                        <span style={{ fontSize: 9, color: '#111827', fontWeight: 600 }}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Hole list */}
                {supportConfig.holes.length === 0 && (
                  <div style={{
                    textAlign: 'center', padding: '20px 10px', color: '#6b7280', fontSize: 11,
                    background: 'rgba(0,0,0,0.03)', borderRadius: 10,
                  }}>
                    No holes yet — add one above
                  </div>
                )}

                {supportConfig.holes.map((hole, idx) => {
                  const typeLabel = hole.type === 'circle' ? '○ Circle' : hole.type === 'rect' ? '□ Rect' : '⬭ Capsule';
                  return (
                    <div key={hole.id} style={{
                      background: '#fff', borderRadius: 12, padding: '10px 12px',
                      border: '1px solid rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', fontFamily: FONT }}>
                          #{idx + 1} {typeLabel}
                        </span>
                        <button
                          onClick={() => removeHole(hole.id)}
                          style={{
                            background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: 6,
                            color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                            padding: '3px 8px', transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                        >
                          Remove
                        </button>
                      </div>
                      <SupportSlider label="X" value={hole.x} min={-15} max={15} step={0.5} onChange={v => updateHole(hole.id, 'x', v)} />
                      <SupportSlider label="Y" value={hole.y} min={-15} max={15} step={0.5} onChange={v => updateHole(hole.id, 'y', v)} />
                      {hole.type === 'circle' ? (
                        <SupportSlider label="Radius" value={hole.r || 2} min={0.5} max={10} step={0.1} onChange={v => updateHole(hole.id, 'r', v)} />
                      ) : (
                        <>
                          <SupportSlider label="W" value={hole.w || 3} min={1} max={15} step={0.1} onChange={v => updateHole(hole.id, 'w', v)} />
                          <SupportSlider label="L" value={hole.l || 5} min={1} max={20} step={0.1} onChange={v => updateHole(hole.id, 'l', v)} />
                        </>
                      )}
                    </div>
                  );
                })}

                <Section label="Preview">
                  <SupportPreviewMini config={supportConfig} />
                </Section>
              </div>
            )}

            {/* ── Strength tab ── */}
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
                    <div style={{ fontSize: 10, color: '#374151', marginTop: 6, fontFamily: FONT }}>{strength.fluteName}</div>
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
                    <div style={{ height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: 8, borderRadius: 4, width: `${strength.score}%`, background: strength.statusColor, transition: 'width 0.3s ease' }} />
                    </div>
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

      {/* ═══ Viewer ═══ */}
      <div style={{ flex: 1, position: 'relative' }}>
        {view === '2d' ? (
          <div style={{ width: '100%', height: '100%', background: '#1a1d23' }}>
            <svg
              ref={svgRef}
              style={{ width: '100%', height: '100%', overflow: 'visible', cursor: isPanning ? 'grabbing' : 'grab' }}
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
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
              {dieline.crease.map((pl, i) => <path key={`cr-${i}`} d={polylineToPath(pl)} fill="none" stroke={CREASE_COLOR} strokeWidth={creaseStroke} strokeDasharray={dashPattern} strokeLinejoin="round" />)}
              {dieline.cut.map((pl, i) => <path key={`ct-${i}`} d={polylineToPath(pl)} fill="none" stroke={CUT_COLOR} strokeWidth={cutStroke} strokeLinejoin="round" strokeLinecap="round" />)}
            </svg>
          </div>
        ) : (
          <Canvas camera={{ position: [8, 6, 8], fov: 45 }} style={{ width: '100%', height: '100%' }}>
            <color attach="background" args={['#5c5c5c']} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} />
            <SelfLockFoldBox width={W} height={H} depth={D} foldProgress={fold} showSupport={showSupport} supportConfig={supportConfig} />
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
          {W} x {H} x {D} mm (Self-Lock)
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
