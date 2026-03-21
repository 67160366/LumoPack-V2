/**
 * HeartDimensionsForm — Shape slider + Tilt slider + matrix + size fields
 * Matches the panel's heart shape editor (same algorithm as HeartBoxTestPage)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';

const SHAPE_OPTIONS = [35, 45, 55, 65, 75];
const TILT_OPTIONS  = [25, 35, 45, 55, 65];
const PINK = '#e91e63';

const MIN_DIM = 10;
const MAX_DIM = 2000;
const MIN_QTY = 500;
const MAX_QTY = 100000;

/* ── Heart outline generator (same algo as HeartBoxTestPage) ── */
function generateHeartOutline(shapePct, tiltDeg) {
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
}

function heartSvgPath(outline, size) {
  return outline.map(([x, y], i) =>
    `${i === 0 ? 'M' : 'L'}${(x * size * 0.8 + size / 2).toFixed(1)},${(-y * size * 0.8 + size / 2).toFixed(1)}`
  ).join(' ') + 'Z';
}

/* ── MiniHeart for matrix ── */
function MiniHeart({ shapePct, tiltDeg, size = 26, active = false, opacity = 0.25 }) {
  const d = useMemo(() => {
    const outline = generateHeartOutline(shapePct, tiltDeg);
    return heartSvgPath(outline, size);
  }, [shapePct, tiltDeg, size]);
  return (
    <svg width={size} height={size} style={{ opacity: active ? 1 : opacity, display: 'block' }}>
      <path d={d} fill={PINK} />
    </svg>
  );
}

/* ── Larger heart preview ── */
function HeartPreview({ shapePct, tiltDeg, size = 60 }) {
  const d = useMemo(() => {
    const outline = generateHeartOutline(shapePct, tiltDeg);
    return heartSvgPath(outline, size);
  }, [shapePct, tiltDeg, size]);
  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      <path d={d} fill={PINK} opacity={0.7} />
    </svg>
  );
}

/* ── Slider component (matches panel style) ── */
function PinkSlider({ label, value, min, max, step, unit, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{ fontSize: 12, color: '#475569', fontFamily: "'Sarabun', sans-serif" }}>
          {label}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: '#0f172a',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {value}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        {/* Track background */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3,
          background: '#e2e8f0',
        }} />
        {/* Track fill */}
        <div style={{
          position: 'absolute', left: 0, height: 6, borderRadius: 3,
          width: `${pct}%`, background: `linear-gradient(90deg, ${PINK}, #f06292)`,
        }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', left: 0, right: 0, width: '100%',
            height: 20, opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
        {/* Thumb indicator */}
        <div style={{
          position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', border: `3px solid ${PINK}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}


export default function HeartDimensionsForm({ onSubmit }) {
  const [shapePct, setShapePct] = useState(55);
  const [tiltDeg, setTiltDeg]   = useState(45);
  const [length, setLength]     = useState('');
  const [height, setHeight]     = useState('');
  const [quantity, setQuantity] = useState('');
  const [errors, setErrors]     = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const validate = () => {
    const e = {};
    const l = parseFloat(length);
    const h = parseFloat(height);
    const q = parseInt(quantity, 10);
    if (!length || isNaN(l) || l < MIN_DIM || l > MAX_DIM) e.length = `${MIN_DIM}–${MAX_DIM} mm`;
    if (!height || isNaN(h) || h < MIN_DIM || h > MAX_DIM) e.height = `${MIN_DIM}–${MAX_DIM} mm`;
    if (!quantity || isNaN(q) || q < MIN_QTY) e.quantity = `ขั้นต่ำ ${MIN_QTY.toLocaleString()} ชิ้น`;
    else if (q > MAX_QTY) e.quantity = `สูงสุด ${MAX_QTY.toLocaleString()} ชิ้น`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    if (!validate()) return;
    setIsSubmitting(true);
    const lCm = (parseFloat(length) || 0) / 10;
    const hCm = (parseFloat(height) || 0) / 10;
    const text = `ยาว ${lCm} สูง ${hCm} ซม. shape ${shapePct}% tilt ${tiltDeg}° จำนวน ${quantity} ชิ้น`;
    onSubmit(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  };

  const numChange = (setter, field) => (e) => {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) {
      setter(v);
      if (errors[field]) setErrors(p => ({ ...p, [field]: undefined }));
    }
  };

  const qtyChange = (e) => {
    const v = e.target.value;
    if (v === '' || /^\d*$/.test(v)) {
      setQuantity(v);
      if (errors.quantity) setErrors(p => ({ ...p, quantity: undefined }));
    }
  };

  return (
    <div className="ml-11 mb-4 animate-slide-up">
      <div style={{
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: 16, padding: '20px 20px 16px', maxWidth: 380,
      }}>
        {/* Header */}
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#0f172a',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          marginBottom: 14, letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: PINK, fontSize: 16 }}>♥</span>
          กรอกขนาดกล่องหัวใจ
        </div>

        {/* ── HEART SHAPE section ── */}
        <div style={{
          background: '#fff', border: '1px solid #f1f5f9',
          borderRadius: 12, padding: 14, marginBottom: 14,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 10,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Heart Shape
          </div>

          {/* Sliders */}
          <PinkSlider label="Shape" value={shapePct} min={20} max={90} step={1} unit="%" onChange={setShapePct} />
          <PinkSlider label="Tilt" value={tiltDeg} min={10} max={80} step={1} unit=" deg" onChange={setTiltDeg} />

          {/* Heart preview */}
          <div style={{ padding: '8px 0 4px' }}>
            <HeartPreview shapePct={shapePct} tiltDeg={tiltDeg} size={64} />
          </div>
        </div>

        {/* ── SHAPE x TILT MATRIX ── */}
        <div style={{
          background: '#fff', border: '1px solid #f1f5f9',
          borderRadius: 12, padding: 10, marginBottom: 14,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Shape x Tilt Matrix
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: 2, fontSize: 9, color: '#94a3b8' }}></th>
                {SHAPE_OPTIONS.map(s => (
                  <th key={s} style={{
                    padding: 2, fontSize: 9, color: PINK, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>{s}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TILT_OPTIONS.map(t => (
                <tr key={t}>
                  <td style={{
                    padding: 2, fontSize: 9, color: PINK, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>{t}</td>
                  {SHAPE_OPTIONS.map(s => (
                    <td key={s} style={{
                      padding: 1, textAlign: 'center', cursor: 'pointer',
                      borderRadius: 6,
                      background: s === shapePct && t === tiltDeg ? 'rgba(233,30,99,0.08)' : 'transparent',
                    }}
                      onClick={() => { setShapePct(s); setTiltDeg(t); }}
                    >
                      <MiniHeart
                        shapePct={s} tiltDeg={t} size={28}
                        active={s === shapePct && t === tiltDeg}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Length / Height ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <Field ref={firstRef} label="ยาว" unit="mm" value={length} error={errors.length}
            onChange={numChange(setLength, 'length')} onKeyDown={handleKeyDown}
            accentColor={PINK} />
          <Field label="สูง" unit="mm" value={height} error={errors.height}
            onChange={numChange(setHeight, 'height')} onKeyDown={handleKeyDown}
            accentColor={PINK} />
        </div>

        {/* ── Quantity ── */}
        <div style={{ marginBottom: 16 }}>
          <Field label="จำนวน" unit="ชิ้น" value={quantity} error={errors.quantity}
            onChange={qtyChange} onKeyDown={handleKeyDown}
            placeholder="ขั้นต่ำ 500" fullWidth accentColor={PINK} />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12,
            fontSize: 13, fontWeight: 700, border: 'none',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            ...(isSubmitting
              ? { background: '#e2e8f0', color: '#94a3b8' }
              : { background: `linear-gradient(135deg, ${PINK}, #c2185b)`, color: '#fff',
                  boxShadow: '0 2px 8px rgba(233,30,99,0.25)' }
            ),
          }}
          onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          {isSubmitting ? 'กำลังส่ง...' : 'ยืนยันขนาด'}
        </button>
      </div>
    </div>
  );
}


/* ── Reusable input field ── */
const Field = React.forwardRef(function Field(
  { label, unit, value, error, onChange, onKeyDown, placeholder, fullWidth, accentColor = '#475569' },
  ref
) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ width: fullWidth ? '100%' : undefined }}>
      <label style={{
        display: 'block', fontSize: 12, color: '#475569',
        fontFamily: "'Sarabun', sans-serif", marginBottom: 6,
      }}>
        {label} <span style={{ color: '#94a3b8' }}>({unit})</span>
      </label>
      <input
        ref={ref}
        type="text" inputMode="decimal" value={value}
        onChange={onChange} onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={placeholder || '0'} autoComplete="off"
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          fontSize: 14, fontFamily: "'Sarabun', sans-serif", color: '#0f172a',
          background: '#fff', outline: 'none', transition: 'border-color 0.2s',
          boxSizing: 'border-box',
          border: `1.5px solid ${error ? '#fca5a5' : focused ? accentColor : '#e2e8f0'}`,
        }}
      />
      {error && (
        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontFamily: "'Sarabun', sans-serif" }}>
          {error}
        </p>
      )}
    </div>
  );
});
