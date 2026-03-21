/**
 * HeartBoxTestPage — Parametric heart-shaped box test page
 *
 * Architecture: [Icon Rail 64px] → [Flyout Panel 360px floating]
 * Tabs: Shape | Size | Lid (3D only)
 */

import { useState, useMemo, useRef, useCallback, useEffect, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Link } from 'react-router-dom';
import FloatingChat from '../components/Chatbot/FloatingChat';
import { parseDxf } from '../engine/dxfParser';
import HeartFoldBox from '../components/Box3D/HeartFoldBox';
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
  { id: 'size',  label: 'Size',  icon: SizeIcon },
  { id: 'lid',   label: 'Lid',   icon: LidIcon },
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
  const [view, setView] = useState('3d');
  const [activeTab, setActiveTab] = useState(null);

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

  // Hide Lid tab in 2D mode
  const visibleTabs = view === '3d' ? TABS : TABS.filter(t => t.id !== 'lid');

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
          <button key={v} onClick={() => { setView(v); if (v === '2d' && activeTab === 'lid') setActiveTab(null); }} title={v === '2d' ? '2D Dieline' : '3D View'} style={{
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
                      <MiniHeart shapePct={shapePct} tiltDeg={tiltDeg} size={64} active color={PINK} />
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
                                  color={PINK}
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
          {length} x {height} mm | Shape {shapePct}% | Tilt {tiltDeg}deg
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
