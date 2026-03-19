/**
 * StudioPanel — Floating card sidebar (Pacdora-inspired)
 */

import { Link } from 'react-router-dom';

/* ============================================================
 * Shared inline styles
 * ========================================================== */
const card = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #f3e8ff',
  padding: '20px 20px',
  boxShadow: '0 2px 12px rgba(124,58,237,0.06)',
};

const sectionTitle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#a855f7',
  marginBottom: 14,
};

const inputBase = {
  width: '100%',
  background: '#faf5ff',
  border: '1px solid #e9d5ff',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 13,
  color: '#581c87',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const selectStyle = {
  ...inputBase,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a855f7' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 36,
};

/* ============================================================
 * Main Component
 * ========================================================== */
export default function StudioPanel({
  formData,
  onFormChange,
  analysis,
  onAnalyze,
  loading,
  image,
  onImageUpload,
  onGeneratePDF,
  boxType,
  onBoxTypeChange,
}) {
  const isDanger = analysis?.status === 'DANGER';

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14, background: '#fbf8ff' }}>

      {/* ---- Box Type ---- */}
      <div style={card}>
        <div style={sectionTitle}>ประเภทกล่อง</div>
        <select
          value={boxType}
          onChange={onBoxTypeChange}
          style={selectStyle}
        >
          <option value="rsc">RSC (กล่องลูกฟูก)</option>
          <option value="die_cut">Die-cut (ฝาเสียบ)</option>
          <option value="heart">Heart Box (หัวใจ)</option>
          <option value="star">Star Box (ดาว)</option>
          <option value="bear">Bear Box (หมี)</option>
          <option value="circle">Circle Box (ทรงกลม)</option>
          <option value="bow">Bow Box (กล่อง+ซัพพอร์ท)</option>
        </select>
      </div>

      {/* ---- Custom Size ---- */}
      <div style={card}>
        <div style={sectionTitle}>ขนาดกล่อง</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SliderField label="ยาว (L)" name="length" value={formData.length} min={1} max={Math.max(60, Number(formData.length) + 10)} unit="cm" onChange={onFormChange} />
          <SliderField label="กว้าง (W)" name="width" value={formData.width} min={1} max={Math.max(60, Number(formData.width) + 10)} unit="cm" onChange={onFormChange} />
          <SliderField label="สูง (H)" name="height" value={formData.height} min={1} max={Math.max(50, Number(formData.height) + 10)} unit="cm" onChange={onFormChange} />
        </div>

        {/* Size summary chip */}
        <div style={{ marginTop: 14, background: '#f3e8ff', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
          <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: '#7c3aed' }}>
            {formData.length} × {formData.width} × {formData.height} cm
          </span>
        </div>
      </div>

      {/* ---- Upload Images ---- */}
      <div style={card}>
        <div style={sectionTitle}>อัปโหลดภาพ</div>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <div style={{
            border: '2px dashed #e9d5ff',
            borderRadius: 14,
            padding: '28px 16px',
            textAlign: 'center',
            transition: 'border-color 0.2s',
            background: '#faf5ff',
          }}>
            {image ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 500 }}>อัปโหลดแล้ว (คลิกเพื่อเปลี่ยน)</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                {/* Upload icon */}
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <div style={{
                  background: '#7c3aed',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload
                </div>
              </div>
            )}
          </div>
          <input type="file" accept="image/*" onChange={onImageUpload} style={{ display: 'none' }} />
        </label>

        {/* Download dieline link */}
        {analysis && (
          <button
            onClick={onGeneratePDF}
            style={{
              width: '100%',
              marginTop: 12,
              background: 'none',
              border: 'none',
              color: '#7c3aed',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'underline',
              textAlign: 'center',
            }}
          >
            Download dieline (PDF)
          </button>
        )}
      </div>

      {/* ---- Custom Material (AI Simulation) ---- */}
      <div style={card}>
        <div style={sectionTitle}>วัสดุ & การทดสอบ</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Flute selector — looks like pacdora's material row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#faf5ff',
            border: '1px solid #f3e8ff',
            borderRadius: 12,
            padding: '10px 14px',
            cursor: 'pointer',
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#a855f7', marginBottom: 2 }}>Custom material</div>
              <select
                name="flute_type"
                value={formData.flute_type}
                onChange={onFormChange}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#581c87',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: 0,
                }}
              >
                <option value="A">ลอน A (หนา 4.5mm)</option>
                <option value="C">ลอน C (มาตรฐาน 3.6mm)</option>
                <option value="B">ลอน B (บาง 2.5mm)</option>
                <option value="E">ลอน E (จิ๋ว 1.5mm)</option>
                <option value="BC">ลอน BC (2 ชั้น หนักมาก)</option>
              </select>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {/* Weight input */}
          <input
            type="number"
            name="weight"
            placeholder="น้ำหนักสินค้า (kg)"
            value={formData.weight}
            onChange={onFormChange}
            style={inputBase}
          />

          {/* Analyze button */}
          <button
            onClick={onAnalyze}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: isDanger ? '#dc2626' : '#7c3aed',
              color: '#fff',
              opacity: loading ? 0.5 : 1,
              transition: 'background 0.2s, opacity 0.2s',
            }}
          >
            {loading ? 'AI กำลังคิด...' : 'วิเคราะห์ความแข็งแรง'}
          </button>
        </div>

        {/* Analysis result */}
        {analysis && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 12,
            background: isDanger ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${isDanger ? '#fecaca' : '#bbf7d0'}`,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: isDanger ? '#dc2626' : '#16a34a' }}>
              Status: {analysis.status}
            </div>
            <div style={{ color: '#6b7280' }}>
              Score: {analysis.safety_score} | Max: {analysis.max_load_kg}kg
            </div>
          </div>
        )}
      </div>

      {/* ---- My Projects ---- */}
      <Link
        to="/projects"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 0',
          borderRadius: 14,
          background: '#fff',
          border: '1px solid #f3e8ff',
          color: '#7c3aed',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 2px 12px rgba(124,58,237,0.06)',
          transition: 'border-color 0.2s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        My Projects
      </Link>

    </div>
  );
}


/* ============================================================
 * Sub-component: Slider Field
 * ========================================================== */
function SliderField({ label, name, value, min, max, unit, onChange }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#7c3aed' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            name={name}
            value={value}
            min={min}
            max={max}
            onChange={onChange}
            style={{
              width: 56,
              background: '#faf5ff',
              border: '1px solid #e9d5ff',
              borderRadius: 8,
              padding: '5px 8px',
              fontSize: 13,
              fontFamily: 'monospace',
              fontWeight: 600,
              color: '#6b21a8',
              textAlign: 'center',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: '#a855f7', fontFamily: 'monospace' }}>{unit}</span>
        </div>
      </div>
      <div style={{ padding: '0 2px' }}>
        <input
          type="range"
          name={name}
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          style={{ width: '100%', height: 6, accentColor: '#7c3aed', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}
