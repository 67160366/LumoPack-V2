/**
 * DimensionsForm — Structured input สำหรับ Step 5
 *
 * ช่องบังคับ: กว้าง / ยาว / สูง / จำนวน
 * ช่อง optional: น้ำหนักสินค้า (kg) / ลอนกระดาษ (A/B/C/E/BC)
 *
 * format output: "กว้าง 20 ยาว 10 สูง 30 จำนวน 500 ชิ้น น้ำหนัก 2 kg ลอน C"
 *
 * Props:
 *   onSubmit(formattedText: string)
 *   showQuantity — แสดงช่องจำนวนหรือไม่
 */

import React, { useState, useRef, useEffect } from 'react';

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 200;
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
  const [weight,   setWeight]   = useState('');   // optional
  const [flute,    setFlute]    = useState('');    // optional
  const [errors,   setErrors]   = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firstInputRef = useRef(null);
  useEffect(() => { firstInputRef.current?.focus(); }, []);

  // =====================
  // Validation
  // =====================
  const validate = () => {
    const newErrors = {};
    const w = parseFloat(width);
    const l = parseFloat(length);
    const h = parseFloat(height);

    if (!width  || isNaN(w) || w < MIN_DIMENSION || w > MAX_DIMENSION)
      newErrors.width  = `${MIN_DIMENSION}–${MAX_DIMENSION} ซม.`;
    if (!length || isNaN(l) || l < MIN_DIMENSION || l > MAX_DIMENSION)
      newErrors.length = `${MIN_DIMENSION}–${MAX_DIMENSION} ซม.`;
    if (!height || isNaN(h) || h < MIN_DIMENSION || h > MAX_DIMENSION)
      newErrors.height = `${MIN_DIMENSION}–${MAX_DIMENSION} ซม.`;

    if (showQuantity) {
      const q = parseInt(quantity, 10);
      if (!quantity || isNaN(q) || q < MIN_QUANTITY)
        newErrors.quantity = `ขั้นต่ำ ${MIN_QUANTITY.toLocaleString()} ชิ้น`;
      else if (q > MAX_QUANTITY)
        newErrors.quantity = `สูงสุด ${MAX_QUANTITY.toLocaleString()} ชิ้น`;
    }

    // weight optional — validate เฉพาะถ้ากรอกมา
    if (weight !== '') {
      const wt = parseFloat(weight);
      if (isNaN(wt) || wt <= 0 || wt > 9999)
        newErrors.weight = '0.1–9999 kg';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // =====================
  // Submit
  // =====================
  const handleSubmit = () => {
    if (isSubmitting) return;
    if (!validate()) return;
    setIsSubmitting(true);

    let text = `กว้าง ${width} ยาว ${length} สูง ${height}`;
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

  // =====================
  // Render
  // =====================
  return (
    <div className="ml-9 mb-3 animate-slide-up">
      <div className="bg-panel-surface border border-panel-border rounded-2xl p-4 max-w-sm">

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">📐</span>
          <span className="text-xs font-display font-semibold text-zinc-300">
            กรอกขนาดกล่อง
          </span>
        </div>

        {/* ── บังคับ: กว้าง / ยาว / สูง ── */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <DimInput ref={firstInputRef} name="width"  label="กว้าง" unit="ซม."
            value={width}  error={errors.width}
            onChange={handleNumberChange(setWidth, 'width')}   onKeyDown={handleKeyDown} />
          <DimInput name="length" label="ยาว" unit="ซม."
            value={length} error={errors.length}
            onChange={handleNumberChange(setLength, 'length')} onKeyDown={handleKeyDown} />
          <DimInput name="height" label="สูง" unit="ซม."
            value={height} error={errors.height}
            onChange={handleNumberChange(setHeight, 'height')} onKeyDown={handleKeyDown} />
        </div>

        {/* ── บังคับ: จำนวน ── */}
        {showQuantity && (
          <div className="mb-3">
            <DimInput name="quantity" label="จำนวน" unit="ชิ้น"
              value={quantity} error={errors.quantity}
              onChange={handleQuantityChange} onKeyDown={handleKeyDown}
              placeholder="ขั้นต่ำ 500" fullWidth />
          </div>
        )}

        {/* ── Divider: optional section ── */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-panel-border" />
          <span className="text-[10px] text-zinc-600 font-body whitespace-nowrap">
            ไม่บังคับ — ใช้วิเคราะห์ความแข็งแรง
          </span>
          <div className="h-px flex-1 bg-panel-border" />
        </div>

        {/* ── Optional: น้ำหนัก + ลอนกระดาษ ── */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* น้ำหนักสินค้า */}
          <DimInput name="weight" label="น้ำหนักสินค้า" unit="kg"
            value={weight} error={errors.weight}
            onChange={handleNumberChange(setWeight, 'weight')} onKeyDown={handleKeyDown}
            placeholder="เว้นว่างได้" />

          {/* ลอนกระดาษ */}
          <div>
            <label htmlFor="dim-flute" className="block text-[11px] text-zinc-500 font-body mb-1">
              ลอนกระดาษ
              <span className="text-zinc-600 ml-0.5">(ชั้น)</span>
            </label>
            <select
              id="dim-flute"
              value={flute}
              onChange={(e) => setFlute(e.target.value)}
              className="
                w-full px-2 py-2 rounded-lg text-xs font-body text-zinc-200
                bg-panel-darker border border-panel-border
                focus:outline-none focus:ring-1 focus:border-lumo-400/50 focus:ring-lumo-400/20
                transition-colors duration-150 appearance-none cursor-pointer
              "
            >
              {FLUTE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-panel-darker">
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
          className={`
            w-full py-2.5 rounded-xl text-xs font-display font-semibold
            transition-all duration-200
            ${isSubmitting
              ? 'bg-panel-border text-zinc-500 cursor-not-allowed'
              : 'bg-lumo-400 text-panel-darker hover:bg-lumo-300 active:scale-[0.98]'
            }
          `}
        >
          {isSubmitting ? 'กำลังส่ง...' : '✓ ยืนยันขนาด'}
        </button>
      </div>
    </div>
  );
}


// =============================================
// Sub-component: DimInput
// =============================================
const DimInput = React.forwardRef(function DimInput(
  { name, label, unit, value, error, onChange, onKeyDown, placeholder, fullWidth },
  ref
) {
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      <label htmlFor={`dim-${name}`} className="block text-[11px] text-zinc-500 font-body mb-1">
        {label}
        <span className="text-zinc-600 ml-0.5">({unit})</span>
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
        placeholder={placeholder || '0'}
        autoComplete="off"
        className={`
          w-full px-2.5 py-2 rounded-lg text-sm font-body text-zinc-200
          bg-panel-darker border placeholder-zinc-600
          focus:outline-none focus:ring-1
          transition-colors duration-150
          ${error
            ? 'border-red-500/60 focus:border-red-400 focus:ring-red-400/20'
            : 'border-panel-border focus:border-lumo-400/50 focus:ring-lumo-400/20'
          }
        `}
      />
      {error && (
        <p className="text-[10px] text-red-400 mt-0.5 font-body">{error}</p>
      )}
    </div>
  );
});