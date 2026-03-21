/**
 * DielineTestPage — Die-cut folding box DXF dieline
 *
 * DUAL MODE:
 *   1. Embedded (showControls=false): Used by App.jsx as center panel
 *   2. Standalone (showControls=true): Icon rail + flyout + self-contained SVG viewer
 *
 * Tabs: Design | Size | Fold | Strength
 */

import { useState, useMemo, useRef, useCallback, useEffect, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { Link, useLocation } from 'react-router-dom';
import FloatingChat from '../components/Chatbot/FloatingChat';
import { useChatbot } from '../contexts/ChatbotContext';
import { parseDxf } from '../engine/dxfParser';
import DxfFoldBox from '../components/Box3D/DxfFoldBox';
import MaterialPresetPicker, { MATERIAL_PRESETS } from '../components/Box3D/MaterialPresetPicker';
import { MATERIAL_PRESETS_STANDARD } from '../components/Box3D/cardboardColors';
import DielineViewer from '../components/Dieline/DielineViewer';
import useImagePlacement from '../hooks/useImagePlacement';
import ImageUploadPanel from '../components/DesignOverlay/ImageUploadPanel';
import DielineImageOverlay from '../components/DesignOverlay/DielineImageOverlay';
import { generatePanelTextures } from '../utils/textureGenerator';
import ExportButtons from '../components/ExportButtons';
import diecutDxfRaw from '../assets/500x300x80mm-folding-box.dxf?raw';

/* ── Reference box dimensions ── */
const REF_W = 500;
const REF_H = 300;
const REF_D = 80;

/* ── Design tokens ── */
const FONT = "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', monospace";
const PURPLE = '#7c3aed';
const PURPLE_DARK = '#6d28d9';
const RAIL_W = 64;
const PANEL_W = 360;

const T = 3;

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

/* ── Die-cut scaling function ── */
function scaleDieCut(raw, W, H, D) {
  if (W === REF_W && H === REF_H && D === REF_D) return { ...raw, bounds: computeBounds(raw) };

  const tabW = 3.5 * T; // 10.5
  const faceW_ref = REF_W + 2 * tabW;
  const faceW_new = W + 2 * tabW;
  const depthW_ref = REF_D + T;
  const depthW_new = D + T;
  const glueTransW = 3 * T; // 9
  const glueFlapW_ref = REF_D + T / 2;
  const glueFlapW_new = D + T / 2;
  const earBump = 1.5 * T; // 4.5

  const faceH_ref = REF_H + 2 * T;
  const faceH_new = H + 2 * T;
  const backGap = 2 * T; // 6
  const tongueGap = 2 * T; // 6

  const rX = [
    -(earBump + glueFlapW_ref + glueTransW + depthW_ref),
    -(depthW_ref + glueTransW),
    -depthW_ref,
    0,
    faceW_ref,
    faceW_ref + depthW_ref,
    faceW_ref + depthW_ref + glueTransW,
    faceW_ref + depthW_ref + glueTransW + glueFlapW_ref + earBump,
  ];
  const tX = [
    -(earBump + glueFlapW_new + glueTransW + depthW_new),
    -(depthW_new + glueTransW),
    -depthW_new,
    0,
    faceW_new,
    faceW_new + depthW_new,
    faceW_new + depthW_new + glueTransW,
    faceW_new + depthW_new + glueTransW + glueFlapW_new + earBump,
  ];

  const rY = [
    -REF_D,
    0,
    faceH_ref,
    faceH_ref + REF_D,
    faceH_ref + REF_D + backGap,
    faceH_ref + REF_D + backGap + REF_H,
    faceH_ref + REF_D + backGap + REF_H + tongueGap,
    faceH_ref + REF_D + backGap + REF_H + tongueGap + REF_D,
  ];
  const tY = [
    -D,
    0,
    faceH_new,
    faceH_new + D,
    faceH_new + D + backGap,
    faceH_new + D + backGap + H,
    faceH_new + D + backGap + H + tongueGap,
    faceH_new + D + backGap + H + tongueGap + D,
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

/* ── Fold info table ── */
const FOLD_TABLE = [
  { panel: '1', name: 'Bottom flap', zones: 'bottom', range: '0–22%', code: 'RotX(-bottom)', desc: 'พับขึ้น 90°' },
  { panel: '1', name: 'Top strip',   zones: 'topStrip', range: '0–22%', code: 'RotX(+top)', desc: 'พับขึ้น 90°' },
  { panel: '2', name: 'Lock tabs',   zones: 'bottom*Tab, top*Tab', range: '8–25%', code: 'parent + RotZ(tab)', desc: 'พับเข้าด้านใน' },
  { panel: '3', name: 'Side walls',  zones: 'leftSide, rightSide', range: '18–38%', code: 'RotZ(±side)', desc: 'พับขึ้น 90°' },
  { panel: '4', name: 'Transition',  zones: 'glueTrans', range: '30–45%', code: 'side + RotZ(trans)', desc: 'พับเชื่อม' },
  { panel: '5', name: 'Glue flaps',  zones: 'leftGlue, rightGlue', range: '38–52%', code: 'side + RotZ(±glue)', desc: 'พับเข้าหา face' },
  { panel: '6', name: 'Back panel',  zones: 'back', range: '48–68%', code: 'top + RotX(+back)', desc: 'พับปิดกล่อง' },
  { panel: '7', name: 'Back flaps',  zones: 'backFlaps', range: '58–72%', code: 'top+back + RotZ(±backFlap)', desc: 'พับเข้าด้านใน' },
  { panel: '8', name: 'Tongue',      zones: 'tongue', range: '58–72%', code: 'top+back + RotX(+tongue)', desc: 'สอดเข้ากล่อง' },
];

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
function MaterialIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
      <path d="M12 22a10 10 0 0010-10h-4a6 6 0 01-6 6v4z" />
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

const TABS = [
  { id: 'design',   label: 'Design',   icon: DesignIcon },
  { id: 'material', label: 'Material', icon: MaterialIcon },
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

/* ── Support slider (smaller, for hole controls) ── */
function SupportSlider({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#111827', fontFamily: MONO }}>
          {Number(value).toFixed(1)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: 3, accentColor: PURPLE, cursor: 'pointer' }}
      />
    </div>
  );
}

/* ── Support preview mini SVG ── */
function SupportPreviewMini({ config }) {
  const holes = config.holes || [];
  const svgW = 140, svgH = 90, scale = 3.5;
  const cx = svgW / 2, cy = svgH / 2;

  return (
    <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 0', display: 'flex', justifyContent: 'center' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <rect x={4} y={4} width={svgW - 8} height={svgH - 8} rx={6} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={1} />
        {holes.map((hole, i) => {
          const hx = cx + hole.x * scale;
          const hy = cy - hole.y * scale;
          if (hole.type === 'circle') {
            return <circle key={i} cx={hx} cy={hy} r={(hole.r || 2) * scale} fill="#fff" stroke="#6b7280" strokeWidth={1} />;
          }
          if (hole.type === 'rect' || hole.type === 'rectangle') {
            const w = (hole.w || 3) * scale, l = (hole.l || 5) * scale;
            return <rect key={i} x={hx - w / 2} y={hy - l / 2} width={w} height={l} rx={2} fill="#fff" stroke="#6b7280" strokeWidth={1} />;
          }
          const w = (hole.w || 3) * scale, l = (hole.l || 5) * scale;
          return <rect key={i} x={hx - w / 2} y={hy - l / 2} width={w} height={l} rx={w / 2} fill="#faf5ff" stroke="#a78bfa" strokeWidth={1} />;
        })}
      </svg>
    </div>
  );
}

/* ── Error Boundary ── */
class DielineErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: FONT, color: '#c00' }}>
        <h2>DielineTestPage Error:</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
      </div>
    );
    return this.props.children;
  }
}

/* ================================================================
 * Main export — handles both embedded and standalone modes
 * ============================================================== */
export default function DielineTestPage({
  width = 500,
  height = 300,
  depth = 80,
  defaultView = '2d',
  showControls = true,
} = {}) {
  const [W, setW] = useState(width);
  const [H, setH] = useState(height);
  const [D, setD] = useState(depth);
  const [fold, setFold] = useState(0);
  const [view, setView] = useState(defaultView);
  const [selectedZone, setSelectedZone] = useState(null);

  useEffect(() => { setW(width); setH(height); setD(depth); }, [width, height, depth]);
  useEffect(() => { setView(defaultView); }, [defaultView]);

  const embeddedDieline = useMemo(() => {
    const raw = parseDxf(diecutDxfRaw);
    return scaleDieCut(raw, W, H, D);
  }, [W, H, D]);

  /* ═══════════════════════════════════════════════════════════════
   * EMBEDDED MODE — keep exact same behavior
   * ═══════════════════════════════════════════════════════════════ */
  if (!showControls) {
    return (
      <div className="w-full h-full relative" style={{ background: view === '2d' ? '#1a1d23' : '#5c5c5c' }}>
        {view === '2d' ? (
          <DielineViewer width={W} height={H} depth={D} />
        ) : (
          <Canvas camera={{ position: [8, 6, 8], fov: 45 }}>
            <color attach="background" args={['#5c5c5c']} />
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={0.5} />
            <Environment preset="studio" />
            <DxfFoldBox width={W} height={H} depth={D} foldProgress={fold} dieline={embeddedDieline} onZoneClick={setSelectedZone} selectedZone={selectedZone} boxStyle="kraft" />
            <ContactShadows opacity={0.4} scale={20} blur={2.5} />
            <OrbitControls makeDefault />
            <gridHelper args={[20, 20, '#e9d5ff', '#f3e8ff']} />
          </Canvas>
        )}

        {/* View toggle (top-right) */}
        <div className="absolute top-3 right-3 z-10 flex rounded-lg overflow-hidden border border-purple-200 bg-white/80 backdrop-blur-sm shadow-sm">
          <button
            onClick={() => setView('2d')}
            className={`px-3 py-1.5 text-xs font-mono transition-colors ${
              view === '2d' ? 'text-purple-700 bg-purple-50' : 'text-purple-400 hover:text-purple-600'
            }`}
          >
            2D Dieline
          </button>
          <button
            onClick={() => setView('3d')}
            className={`px-3 py-1.5 text-xs font-mono transition-colors ${
              view === '3d' ? 'text-purple-700 bg-purple-50' : 'text-purple-400 hover:text-purple-600'
            }`}
          >
            3D
          </button>
        </div>

        {/* Fold slider (bottom bar, 3D mode only) */}
        {view === '3d' && (
          <div
            style={{
              position: 'absolute',
              bottom: 56,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(12px)',
              borderRadius: 16,
              padding: '12px 24px',
              border: '1px solid rgba(147,51,234,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              minWidth: 380,
              maxWidth: '90%',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              zIndex: 10,
            }}
          >
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#7c3aed', whiteSpace: 'nowrap' }}>
              Fold
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={fold * 100}
              onChange={(e) => setFold(parseFloat(e.target.value) / 100)}
              style={{ flex: 1, height: 6, accentColor: '#7c3aed', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b21a8', fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
              {Math.round(fold * 100)}%
            </span>
          </div>
        )}

        {/* Selected zone label */}
        {view === '3d' && selectedZone && (
          <div style={{
            position: 'absolute', top: 56, right: 12, zIndex: 10,
            background: 'rgba(124,58,237,0.9)', color: '#fff', padding: '6px 14px',
            borderRadius: 10, fontSize: 12, fontFamily: 'monospace',
          }}>
            Selected: {selectedZone}
            <button onClick={() => setSelectedZone(null)} style={{ marginLeft: 8, opacity: 0.7, cursor: 'pointer', background: 'none', border: 'none', color: '#fff', fontSize: 14 }}>&times;</button>
          </div>
        )}

        {/* Dimension label */}
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-purple-200 shadow-sm z-10">
          <span className="text-[11px] font-mono text-purple-500">
            {W} × {D} × {H} mm
          </span>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
   * STANDALONE MODE — Icon Rail + Flyout
   * ═══════════════════════════════════════════════════════════════ */
  return (
    <DielineErrorBoundary>
      <DielineStandalone />
    </DielineErrorBoundary>
  );
}

/* ================================================================
 * Standalone Component
 * ============================================================== */
function DielineStandalone() {
  const [W, setW] = useState(REF_W);
  const [H, setH] = useState(REF_H);
  const [D, setD] = useState(REF_D);
  const [view, setView] = useState('2d');
  const [fold, setFold] = useState(0);
  const [activeTab, setActiveTab] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [boxStyle, setBoxStyle] = useState('kraft');

  // --- Load project from navigation state ---
  const location = useLocation();
  useEffect(() => {
    const proj = location.state?.loadProject;
    if (!proj) return;
    window.history.replaceState({}, '');
    if (proj.dimensions) {
      if (proj.dimensions.width)  setW(proj.dimensions.width * 10);
      if (proj.dimensions.length) setH(proj.dimensions.length * 10);
      if (proj.dimensions.height) setD(proj.dimensions.height * 10);
    }
    if (proj.material) {
      const v = proj.material.toLowerCase();
      setBoxStyle(v === 'white' || v.includes('ขาว') ? 'white' : 'kraft');
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
    if (dims.width)  setW(dims.width * 10);   // cm → mm
    if (dims.length) setH(dims.length * 10);
    if (dims.height) setD(dims.height * 10);
  }, [collectedData?.dimensions]);
  useEffect(() => {
    const mat = collectedData?.material;
    if (!mat) return;
    const v = mat.toLowerCase();
    if (v === 'white' || v.includes('ขาว')) setBoxStyle('white');
    else setBoxStyle('kraft');
  }, [collectedData?.material]);
  useEffect(() => {
    if (collectedData?.support_required != null) {
      setShowSupport(!!collectedData.support_required);
    }
  }, [collectedData?.support_required]);

  // Strength
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

  // Derived structural values
  const tabW = 3.5 * T;
  const faceW = W + 2 * tabW;
  const depthW = D + T;
  const backGap = 2 * T;
  const tongueGap = 2 * T;
  const faceH = H + 2 * T;
  const backInset = tabW + T / 2;
  const backW = faceW - 2 * backInset;
  const tongueW = faceW - 2 * T;

  // Image placement
  const [panelTextureUrls, setPanelTextureUrls] = useState({});
  const placement = useImagePlacement({ svgRef, viewBox: svgVB, defaultPlaceWidth: Math.min(300, W) });

  const panelZones = useMemo(() => [
    { id: 'face', label: 'หน้าหลัก', x: 0, y: 0, w: faceW, h: faceH },
    { id: 'bottom', label: 'ฝาล่าง', x: tabW, y: -D, w: faceW - 2 * T, h: D },
    { id: 'topStrip', label: 'ฝาบน', x: tabW, y: faceH, w: faceW - 2 * T, h: D },
    { id: 'leftSide', label: 'ข้างซ้าย', x: -depthW, y: 0, w: depthW, h: faceH },
    { id: 'rightSide', label: 'ข้างขวา', x: faceW, y: 0, w: depthW, h: faceH },
    { id: 'back', label: 'แผ่นหลัง', x: backInset, y: faceH + D + backGap, w: backW, h: H },
    { id: 'tongue', label: 'ลิ้น', x: T, y: faceH + D + backGap + H + tongueGap, w: tongueW, h: D },
  ], [W, H, D, faceW, faceH, depthW, backInset, backW, tongueW, backGap, tongueGap, tabW]);
  const panelZonesRef = useRef(panelZones);
  panelZonesRef.current = panelZones;

  const regenerateTextures = useCallback(async () => {
    if (placement.placedImages.length === 0) { setPanelTextureUrls({}); return; }
    const bounds = { minX: -depthW - 100, maxX: faceW + depthW + 100, minY: -D - 50, maxY: faceH + D + backGap + H + tongueGap + D + 50 };
    const textures = await generatePanelTextures(placement.placedImages, panelZonesRef.current, bounds);
    setPanelTextureUrls(textures);
  }, [placement.placedImages, W, H, D, faceW, faceH, depthW, backGap, tongueGap]);

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
  const strength = useMemo(() => analyzeStrength(W, D, H, weightKg, fluteType, analysisOpts), [W, D, H, weightKg, fluteType, analysisOpts]);
  const fluteComparison = useMemo(() => Object.entries(FLUTE_SPECS).map(([k]) => ({ key: k, ...analyzeStrength(W, D, H, weightKg, k, analysisOpts) })), [W, D, H, weightKg, analysisOpts]);

  const rawDieline = useMemo(() => parseDxf(diecutDxfRaw), []);
  const dieline = useMemo(() => scaleDieCut(rawDieline, W, H, D), [rawDieline, W, H, D]);
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

  const glueFlapW = D + T / 2;
  const glueTransW = 3 * T;

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
          <img src="/logo.png" alt="LumoPack" style={{ width: 36, height: 36, objectFit: 'contain' }} />
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
          width: 48, height: 44, borderRadius: 12, border: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          color: '#374151', textDecoration: 'none', transition: 'color 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = PURPLE; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#374151'; }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          <span style={{ fontSize: 8, fontWeight: 600, fontFamily: FONT }}>Home</span>
        </Link>

        <Link to="/projects" title="Projects" style={{
          width: 48, height: 44, borderRadius: 12, border: 'none',
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
            {/* ── Design tab ── */}
            {activeTab === 'design' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ImageUploadPanel placement={placement} onViewIn3D={handleViewIn3D} currentView={view} />
              </div>
            )}

            {activeTab === 'material' && (
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: 16 }}>
                  <MaterialPresetPicker value={boxStyle} onChange={setBoxStyle} accentColor={PURPLE} hint="สีกระดาษในมุมมอง 3D" presets={MATERIAL_PRESETS_STANDARD} />
                </div>
              </div>
            )}

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
                      {W} x {H} x {D} mm (Die-Cut)
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
                        { flex: D, label: `glue ${Math.round(glueFlapW)}`, bg: '#f59e0b' },
                        { flex: 9, label: `3T`, bg: '#94a3b8' },
                        { flex: D + T, label: `D+T=${Math.round(depthW)}`, bg: '#10b981' },
                        { flex: W + 2 * tabW, label: `W+2tab=${Math.round(faceW)}`, bg: '#6366f1' },
                        { flex: D + T, label: `D+T=${Math.round(depthW)}`, bg: '#10b981' },
                        { flex: 9, label: `3T`, bg: '#94a3b8' },
                        { flex: D, label: `glue ${Math.round(glueFlapW)}`, bg: '#f59e0b' },
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
                        { h: 32, label: `face H+2T=${Math.round(faceH)}`, bg: '#6366f1' },
                        { h: 18, label: `top D=${D}`, bg: '#f43f5e' },
                        { h: 6, label: 'gap', bg: '#94a3b8' },
                        { h: 28, label: `back H=${H}`, bg: '#10b981' },
                        { h: 6, label: 'gap', bg: '#94a3b8' },
                        { h: 16, label: `tongue D=${D}`, bg: '#f59e0b' },
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

                {/* Total info */}
                <div style={{ fontSize: 11, color: '#6b7280', fontFamily: MONO }}>
                  Total: {Math.round(2 * glueFlapW + 2 * glueTransW + 2 * depthW + faceW + 2 * 4.5)} x {Math.round(D + faceH + D + backGap + H + tongueGap + D)} mm
                </div>
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
                        ['Lock tabs',      '8-25%',  ease(fold, 0.08, 0.25) * 90],
                        ['Side walls',     '18-38%', ease(fold, 0.18, 0.38) * 90],
                        ['Transition',     '30-45%', ease(fold, 0.30, 0.45) * 90],
                        ['Glue flaps',     '38-52%', ease(fold, 0.38, 0.52) * 90],
                        ['Top strip',      '0-22%',  ease(fold, 0.00, 0.22) * 90],
                        ['Back panel',     '48-68%', ease(fold, 0.48, 0.68) * 90],
                        ['Back flaps',     '58-72%', ease(fold, 0.58, 0.72) * 90],
                        ['Tongue',         '58-72%', ease(fold, 0.58, 0.72) * 90],
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

                {/* Panel reference table */}
                <Section label="Panel map">
                  <div style={{ fontSize: 9, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '6px 14px', background: '#333', color: '#fff', fontWeight: 700, fontSize: 10 }}>
                      Panel Map (DxfFoldBox.jsx)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                          <th style={{ padding: '4px 6px', textAlign: 'left', fontFamily: FONT, fontWeight: 700, color: '#6b7280' }}>#</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', fontFamily: FONT, fontWeight: 700, color: '#6b7280' }}>Name</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', fontFamily: FONT, fontWeight: 700, color: '#6b7280' }}>Range</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left', fontFamily: FONT, fontWeight: 700, color: '#6b7280' }}>Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {FOLD_TABLE.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                            <td style={{ padding: '3px 6px', fontWeight: 700, color: PURPLE }}>{row.panel}</td>
                            <td style={{ padding: '3px 6px', color: '#374151' }}>{row.name}</td>
                            <td style={{ padding: '3px 6px', color: '#6b7280' }}>{row.range}</td>
                            <td style={{ padding: '3px 6px', fontSize: 8, color: '#9ca3af' }}>{row.code}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                    onClick={() => { setShowSupport(p => !p); if (view !== '3d') { switchTo3D(); } }}
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

                      {/* Position X */}
                      <SupportSlider label="X" value={hole.x} min={-15} max={15} step={0.5} onChange={v => updateHole(hole.id, 'x', v)} />
                      {/* Position Y */}
                      <SupportSlider label="Y" value={hole.y} min={-15} max={15} step={0.5} onChange={v => updateHole(hole.id, 'y', v)} />

                      {/* Size controls */}
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

                {/* Mini preview */}
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
          <Canvas camera={{ position: [8, 6, 8], fov: 45 }} style={{ width: '100%', height: '100%' }}>
            <color attach="background" args={['#5c5c5c']} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} />
            <DxfFoldBox width={W} height={H} depth={D} foldProgress={fold} panelImages={panelTextureUrls} dieline={dieline} onZoneClick={setSelectedZone} selectedZone={selectedZone} showSupport={showSupport} supportConfig={supportConfig} boxStyle={boxStyle} />
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
          {W} x {H} x {D} mm (Die-Cut) · {MATERIAL_PRESETS.find(m => m.id === boxStyle)?.label ?? boxStyle}
        </div>

        <ExportButtons dieline={dieline} W={W} H={H} D={D} prefix="die-cut" />

        {view === '2d' && (
          <div style={{
            position: 'absolute', bottom: 116, right: 16, zIndex: 10,
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
