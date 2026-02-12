/**
 * DimensionsForm — Structured input สำหรับ Step 5 (ขนาด + จำนวน)
 *
 * แทนที่การพิมพ์อิสระ ด้วย form 4 ช่อง:
 *   กว้าง (cm) / ยาว (cm) / สูง (cm) / จำนวน (ชิ้น)
 *
 * เมื่อ submit → format เป็น string ที่ extract_dimensions() จับได้:
 *   "กว้าง 20 ยาว 10 สูง 30 จำนวน 500 ชิ้น"
 *
 * Props:
 *   onSubmit(formattedText: string) — เรียก sendMessage ด้วยข้อความที่ format แล้ว
 *   showQuantity — แสดงช่องจำนวนหรือไม่ (false = มี qty ใน partial แล้ว)
 */

import React, { useState, useRef, useEffect } from 'react';

// Validation rules
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 200;
const MIN_QUANTITY = 500;
const MAX_QUANTITY = 100000;

export default function DimensionsForm({ onSubmit, showQuantity = true }) {
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [height, setHeight] = useState('');
  const [quantity, setQuantity] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firstInputRef = useRef(null);

  // Auto-focus ช่องแรกเมื่อ mount
  useEffect(() => {
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, []);

  // --- Validation ---
  const validate = () => {
    const newErrors = {};
    const w = parseFloat(width);
    const l = parseFloat(length);
    const h = parseFloat(height);

    if (!width || isNaN(w) || w < MIN_DIMENSION || w > MAX_DIMENSION) {
      newErrors.width = `${MIN_DIMENSION}-${MAX_DIMENSION} ซม.`;
    }
    if (!length || isNaN(l) || l < MIN_DIMENSION || l > MAX_DIMENSION) {
      newErrors.length = `${MIN_DIMENSION}-${MAX_DIMENSION} ซม.`;
    }
    if (!height || isNaN(h) || h < MIN_DIMENSION || h > MAX_DIMENSION) {
      newErrors.height = `${MIN_DIMENSION}-${MAX_DIMENSION} ซม.`;
    }

    if (showQuantity) {
      const q = parseInt(quantity, 10);
      if (!quantity || isNaN(q) || q < MIN_QUANTITY) {
        newErrors.quantity = `ขั้นต่ำ ${MIN_QUANTITY.toLocaleString()} ชิ้น`;
      } else if (q > MAX_QUANTITY) {
        newErrors.quantity = `สูงสุด ${MAX_QUANTITY.toLocaleString()} ชิ้น`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Submit ---
  const handleSubmit = () => {
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);

    // Format ให้ตรงกับ extract_dimensions Pattern 2 + extract_quantity
    let text = `กว้าง ${width} ยาว ${length} สูง ${height}`;
    if (showQuantity && quantity) {
      text += ` จำนวน ${quantity} ชิ้น`;
    }

    onSubmit(text);
  };

  // --- Enter key → submit ---
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // --- Number-only input handler ---
  const handleNumberChange = (setter) => (e) => {
    const val = e.target.value;
    // อนุญาตเฉพาะตัวเลขและจุดทศนิยม
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setter(val);
      // ล้าง error เมื่อ user เริ่มพิมพ์ใหม่
      if (errors[e.target.name]) {
        setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
      }
    }
  };

  // --- Quantity input (integer only) ---
  const handleQuantityChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^\d*$/.test(val)) {
      setQuantity(val);
      if (errors.quantity) {
        setErrors((prev) => ({ ...prev, quantity: undefined }));
      }
    }
  };

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

        {/* Dimension inputs — 3 columns */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <DimInput
            ref={firstInputRef}
            name="width"
            label="กว้าง"
            unit="ซม."
            value={width}
            error={errors.width}
            onChange={handleNumberChange(setWidth)}
            onKeyDown={handleKeyDown}
          />
          <DimInput
            name="length"
            label="ยาว"
            unit="ซม."
            value={length}
            error={errors.length}
            onChange={handleNumberChange(setLength)}
            onKeyDown={handleKeyDown}
          />
          <DimInput
            name="height"
            label="สูง"
            unit="ซม."
            value={height}
            error={errors.height}
            onChange={handleNumberChange(setHeight)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Quantity input */}
        {showQuantity && (
          <div className="mb-3">
            <DimInput
              name="quantity"
              label="จำนวน"
              unit="ชิ้น"
              value={quantity}
              error={errors.quantity}
              onChange={handleQuantityChange}
              onKeyDown={handleKeyDown}
              placeholder="ขั้นต่ำ 500"
              fullWidth
            />
          </div>
        )}

        {/* Submit button */}
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


// ===================================
// Sub-component: Single input field
// ===================================

const DimInput = React.forwardRef(function DimInput(
  { name, label, unit, value, error, onChange, onKeyDown, placeholder, fullWidth },
  ref
) {
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      <label
        htmlFor={`dim-${name}`}
        className="block text-[11px] text-zinc-500 font-body mb-1"
      >
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