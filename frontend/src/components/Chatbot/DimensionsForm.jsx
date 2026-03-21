/**
 * DimensionsForm — Structured input สำหรับ Step 5 (Navy/Slate Theme)
 */

import React, { useState, useRef, useEffect } from 'react';

const MIN_DIMENSION_MM = 10;
const MAX_DIMENSION_MM = 2000;
const MIN_QUANTITY  = 500;
const MAX_QUANTITY  = 100000;

const FLUTE_OPTIONS = [
  { value: '',   label: 'ไม่ระบุ (ค่าเริ่มต้น C)' },
  { value: 'A',  label: 'ลอน A — หนาสุด' },
  { value: 'B',  label: 'ลอน B — บาง' },
  { value: 'C',  label: 'ลอน C — มาตรฐาน' },
  { value: 'E',  label: 'ลอน E — จิ๋ว (กล่องเล็ก)' },
  { value: 'BC', label: 'ลอน BC — 2 ชั้น (หนักมาก)' },
];

export default function DimensionsForm({ onSubmit, showQuantity = true }) {
  const [width,    setWidth]    = useState('');
  const [length,   setLength]   = useState('');
  const [height,   setHeight]   = useState('');
  const [quantity, setQuantity] = useState('');
  const [weight,   setWeight]   = useState('');
  const [flute,    setFlute]    = useState('');
  const [errors,   setErrors]   = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firstInputRef = useRef(null);
  useEffect(() => { firstInputRef.current?.focus(); }, []);

  const validate = () => {
    const newErrors = {};
    const w = parseFloat(width);
    const l = parseFloat(length);
    const h = parseFloat(height);

    if (!width  || isNaN(w) || w < MIN_DIMENSION_MM || w > MAX_DIMENSION_MM)
      newErrors.width  = `${MIN_DIMENSION_MM}–${MAX_DIMENSION_MM} mm`;
    if (!length || isNaN(l) || l < MIN_DIMENSION_MM || l > MAX_DIMENSION_MM)
      newErrors.length = `${MIN_DIMENSION_MM}–${MAX_DIMENSION_MM} mm`;
    if (!height || isNaN(h) || h < MIN_DIMENSION_MM || h > MAX_DIMENSION_MM)
      newErrors.height = `${MIN_DIMENSION_MM}–${MAX_DIMENSION_MM} mm`;

    if (showQuantity) {
      const q = parseInt(quantity, 10);
      if (!quantity || isNaN(q) || q < MIN_QUANTITY)
        newErrors.quantity = `ขั้นต่ำ ${MIN_QUANTITY.toLocaleString()} ชิ้น`;
      else if (q > MAX_QUANTITY)
        newErrors.quantity = `สูงสุด ${MAX_QUANTITY.toLocaleString()} ชิ้น`;
    }

    if (weight !== '') {
      const wt = parseFloat(weight);
      if (isNaN(wt) || wt <= 0 || wt > 9999)
        newErrors.weight = '0.1–9999 kg';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    if (!validate()) return;
    setIsSubmitting(true);

    const wCm = (parseFloat(width) || 0) / 10;
    const lCm = (parseFloat(length) || 0) / 10;
    const hCm = (parseFloat(height) || 0) / 10;

    let text = `กว้าง ${wCm} ยาว ${lCm} สูง ${hCm} ซม.`;
    if (showQuantity && quantity) text += ` จำนวน ${quantity} ชิ้น`;
    if (weight)                   text += ` น้ำหนัก ${weight} kg`;
    if (flute)                    text += ` ลอน ${flute}`;

    onSubmit(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  };

  const handleNumberChange = (setter, fieldName) => (e) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setter(val);
      if (errors[fieldName]) setErrors(prev => ({ ...prev, [fieldName]: undefined }));
    }
  };

  const handleQuantityChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^\d*$/.test(val)) {
      setQuantity(val);
      if (errors.quantity) setErrors(prev => ({ ...prev, quantity: undefined }));
    }
  };

  return (
    <div className="ml-11 mr-3 mb-4 animate-slide-up">
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: '20px 20px 16px',
        }}
      >
        {/* Header */}
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#0f172a',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          marginBottom: 16,
          letterSpacing: '-0.01em',
        }}>
          กรอกขนาดกล่อง
        </div>

        {/* W / L / H */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <DimInput ref={firstInputRef} name="width" label="กว้าง" unit="mm"
            value={width} error={errors.width}
            onChange={handleNumberChange(setWidth, 'width')} onKeyDown={handleKeyDown} />
          <DimInput name="length" label="ยาว" unit="mm"
            value={length} error={errors.length}
            onChange={handleNumberChange(setLength, 'length')} onKeyDown={handleKeyDown} />
          <DimInput name="height" label="สูง" unit="mm"
            value={height} error={errors.height}
            onChange={handleNumberChange(setHeight, 'height')} onKeyDown={handleKeyDown} />
        </div>

        {/* Quantity */}
        {showQuantity && (
          <div style={{ marginBottom: 16 }}>
            <DimInput name="quantity" label="จำนวน" unit="ชิ้น"
              value={quantity} error={errors.quantity}
              onChange={handleQuantityChange} onKeyDown={handleKeyDown}
              placeholder="ขั้นต่ำ 500" fullWidth />
          </div>
        )}

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 16,
        }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{
            fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap',
            fontFamily: "'Sarabun', sans-serif",
          }}>
            ไม่บังคับ — ใช้วิเคราะห์ความแข็งแรง
          </span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        {/* Weight + Flute */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <DimInput name="weight" label="น้ำหนักสินค้า" unit="kg"
            value={weight} error={errors.weight}
            onChange={handleNumberChange(setWeight, 'weight')} onKeyDown={handleKeyDown}
            placeholder="เว้นว่างได้" />

          <div>
            <label
              htmlFor="dim-flute"
              style={{
                display: 'block', fontSize: 12, color: '#475569',
                fontFamily: "'Sarabun', sans-serif",
                marginBottom: 6,
              }}
            >
              ลอนกระดาษ <span style={{ color: '#94a3b8' }}>(ชั้น)</span>
            </label>
            <select
              id="dim-flute"
              value={flute}
              onChange={(e) => setFlute(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 13,
                fontFamily: "'Sarabun', sans-serif",
                color: '#0f172a',
                background: '#fff',
                border: '1px solid #e2e8f0',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
              }}
            >
              {FLUTE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: '0.01em',
            border: 'none',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            ...(isSubmitting
              ? { background: '#e2e8f0', color: '#94a3b8' }
              : {
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(15,23,42,0.18)',
                }
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


const DimInput = React.forwardRef(function DimInput(
  { name, label, unit, value, error, onChange, onKeyDown, placeholder, fullWidth },
  ref
) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ width: fullWidth ? '100%' : undefined }}>
      <label
        htmlFor={`dim-${name}`}
        style={{
          display: 'block',
          fontSize: 12,
          color: '#475569',
          fontFamily: "'Sarabun', sans-serif",
          marginBottom: 6,
        }}
      >
        {label} <span style={{ color: '#94a3b8' }}>({unit})</span>
      </label>
      <input
        ref={ref}
        id={`dim-${name}`}
        name={name}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder || '0'}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          fontSize: 14,
          fontFamily: "'Sarabun', sans-serif",
          color: '#0f172a',
          background: '#fff',
          border: `1.5px solid ${error ? '#fca5a5' : focused ? '#475569' : '#e2e8f0'}`,
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <p style={{
          fontSize: 11, color: '#ef4444', marginTop: 4,
          fontFamily: "'Sarabun', sans-serif",
        }}>{error}</p>
      )}
    </div>
  );
});
