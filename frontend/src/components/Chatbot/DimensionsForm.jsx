/**
 * DimensionsForm — Structured input สำหรับ Step 5 (Teal/Purple Theme)
 */

import React, { useState, useRef, useEffect } from 'react';

// UI accepts mm, but the rest of the app/back-end expects cm.
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

    // Convert mm -> cm for the chatbot/back-end which expects cm.
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
    <div className="ml-9 mb-3 animate-slide-up">
      <div className="bg-white border border-teal-200 rounded-2xl p-5 max-w-sm shadow-sm">

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-base leading-none">📐</span>
          <span className="text-sm font-display font-semibold text-teal-800 tracking-tight">
            กรอกขนาดกล่อง
          </span>
        </div>

        {/* บังคับ: กว้าง / ยาว / สูง */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <DimInput ref={firstInputRef} name="width"  label="กว้าง" unit="mm"
            value={width}  error={errors.width}
            onChange={handleNumberChange(setWidth, 'width')}   onKeyDown={handleKeyDown} />
          <DimInput name="length" label="ยาว" unit="mm"
            value={length} error={errors.length}
            onChange={handleNumberChange(setLength, 'length')} onKeyDown={handleKeyDown} />
          <DimInput name="height" label="สูง" unit="mm"
            value={height} error={errors.height}
            onChange={handleNumberChange(setHeight, 'height')} onKeyDown={handleKeyDown} />
        </div>

        {/* บังคับ: จำนวน */}
        {showQuantity && (
          <div className="mb-4">
            <DimInput name="quantity" label="จำนวน" unit="ชิ้น"
              value={quantity} error={errors.quantity}
              onChange={handleQuantityChange} onKeyDown={handleKeyDown}
              placeholder="ขั้นต่ำ 500" fullWidth />
          </div>
        )}

        {/* Divider: optional section */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-teal-100" />
          <span className="text-[11px] text-teal-400 font-body whitespace-nowrap tracking-wide">
            ไม่บังคับ — ใช้วิเคราะห์ความแข็งแรง
          </span>
          <div className="h-px flex-1 bg-teal-100" />
        </div>

        {/* Optional: น้ำหนัก + ลอนกระดาษ */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <DimInput name="weight" label="น้ำหนักสินค้า" unit="kg"
            value={weight} error={errors.weight}
            onChange={handleNumberChange(setWeight, 'weight')} onKeyDown={handleKeyDown}
            placeholder="เว้นว่างได้" />

          <div>
            <label htmlFor="dim-flute" className="block text-xs text-teal-600 font-body mb-1.5 tracking-wide">
              ลอนกระดาษ
              <span className="text-teal-400 ml-1">(ชั้น)</span>
            </label>
            <select
              id="dim-flute"
              value={flute}
              onChange={(e) => setFlute(e.target.value)}
              className="
                w-full px-3 py-2.5 rounded-xl text-xs font-body text-teal-900
                bg-teal-50/50 border border-teal-200
                focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                transition-colors duration-200 appearance-none cursor-pointer
              "
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
          className={`
            w-full py-3 rounded-xl text-sm font-display font-semibold tracking-wide
            transition-all duration-200 shadow-sm
            ${isSubmitting
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-[0.98]'
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
      <label htmlFor={`dim-${name}`} className="block text-xs text-teal-600 font-body mb-1.5 tracking-wide">
        {label}
        <span className="text-teal-400 ml-1">({unit})</span>
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
          w-full px-3 py-2.5 rounded-xl text-sm font-body text-teal-900
          bg-teal-50/50 border placeholder-teal-300
          focus:outline-none focus:ring-2 focus:border-transparent
          transition-colors duration-200
          ${error
            ? 'border-red-300 focus:ring-red-400'
            : 'border-teal-200 focus:ring-teal-500'
          }
        `}
      />
      {error && (
        <p className="text-xs text-red-500 mt-1 font-body">{error}</p>
      )}
    </div>
  );
});
