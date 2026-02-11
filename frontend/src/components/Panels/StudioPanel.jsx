/**
 * StudioPanel — Panel เดิมจาก App.jsx
 * 
 * Features:
 * - Sliders: ยาว, กว้าง, สูง
 * - AI Simulation: น้ำหนัก, ลอน, analyze
 * - Image upload
 * - PDF download
 * 
 * Props:
 * - formData       : {length, width, height, weight, flute_type}
 * - onFormChange   : (e) => void
 * - analysis       : AI analysis result | null
 * - onAnalyze      : () => void
 * - loading        : boolean
 * - image          : string (URL) | null
 * - onImageUpload  : (e) => void
 * - onGeneratePDF  : () => void
 */

import React from 'react';

export default function StudioPanel({
  formData,
  onFormChange,
  analysis,
  onAnalyze,
  loading,
  image,
  onImageUpload,
  onGeneratePDF,
}) {
  const isDanger = analysis?.status === 'DANGER';

  return (
    <div className="h-full overflow-y-auto scrollbar-thin space-y-5" style={{ padding: '20px 24px' }}>
      {/* ---- Dimension Sliders ---- */}
      <div>
        <h4 className="text-xs font-display font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          ขนาดกล่อง
        </h4>
        <div className="space-y-3">
          <SliderField label="ยาว" name="length" value={formData.length} min={10} max={60} unit="cm" onChange={onFormChange} />
          <SliderField label="กว้าง" name="width" value={formData.width} min={10} max={60} unit="cm" onChange={onFormChange} />
          <SliderField label="สูง" name="height" value={formData.height} min={5} max={50} unit="cm" onChange={onFormChange} />
        </div>
      </div>

      <hr className="border-panel-border" />

      {/* ---- AI Simulation ---- */}
      <div className="bg-panel-surface rounded-xl p-4 border border-panel-border">
        <h4 className="text-xs font-display font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span>🤖</span> AI Simulation
        </h4>

        <div className="space-y-2.5">
          <input
            type="number"
            name="weight"
            placeholder="น้ำหนักสินค้า (kg)"
            value={formData.weight}
            onChange={onFormChange}
            className="w-full bg-panel-dark border border-panel-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-lumo-400/50"
          />

          <select
            name="flute_type"
            value={formData.flute_type}
            onChange={onFormChange}
            className="w-full bg-panel-dark border border-panel-border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-lumo-400/50"
          >
            <option value="A">ลอน A (หนา 4.5mm)</option>
            <option value="C">ลอน C (มาตรฐาน 3.6mm)</option>
            <option value="B">ลอน B (บาง 2.5mm)</option>
            <option value="E">ลอน E (จิ๋ว 1.5mm)</option>
          </select>

          <button
            onClick={onAnalyze}
            disabled={loading}
            className={`
              w-full py-2.5 rounded-lg text-sm font-display font-semibold transition-all duration-200
              ${isDanger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-lumo-400 hover:bg-lumo-300 text-panel-darker'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
              active:scale-[0.98]
            `}
          >
            {loading ? '⏳ AI กำลังคิด...' : '⚡ วิเคราะห์ความแข็งแรง'}
          </button>
        </div>

        {/* Analysis result */}
        {analysis && (
          <div className={`mt-3 p-3 rounded-lg text-xs ${isDanger ? 'bg-red-900/30 border border-red-800/40' : 'bg-emerald-900/20 border border-emerald-800/30'}`}>
            <div className={`font-semibold mb-1 ${isDanger ? 'text-red-300' : 'text-emerald-300'}`}>
              Status: {analysis.status}
            </div>
            <div className="text-zinc-400">
              Score: {analysis.safety_score} | Max: {analysis.max_load_kg}kg
            </div>
          </div>
        )}
      </div>

      <hr className="border-panel-border" />

      {/* ---- Image Upload ---- */}
      <div>
        <h4 className="text-xs font-display font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>🎨</span> ออกแบบลายกล่อง
        </h4>
        <label className="block w-full cursor-pointer">
          <div className="border border-dashed border-panel-border rounded-lg p-4 text-center hover:border-lumo-400/40 transition-colors">
            <div className="text-zinc-500 text-xs">
              {image ? '✅ อัปโหลดแล้ว (คลิกเพื่อเปลี่ยน)' : 'คลิกเพื่ออัปโหลดรูป'}
            </div>
          </div>
          <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
        </label>
      </div>

      {/* ---- PDF Download ---- */}
      {analysis && (
        <button
          onClick={onGeneratePDF}
          className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-display font-semibold transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          📄 ดาวน์โหลดใบเสนอราคา (PDF)
        </button>
      )}
    </div>
  );
}


// ===================================
// Sub-component: Slider Field
// ===================================

function SliderField({ label, name, value, min, max, unit, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-zinc-400 font-body">{label}</span>
        <span className="text-lumo-400 font-mono font-medium">{value} {unit}</span>
      </div>
      <div className="px-1">
        <input
          type="range"
          name={name}
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          className="w-full h-1.5 bg-panel-border rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-lumo-400
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:bg-lumo-400
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer
          "
        />
      </div>
    </div>
  );
}