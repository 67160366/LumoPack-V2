/**
 * StudioPanel — Floating icon-rail + flyout panel (Pacdora-inspired)
 *
 * Architecture:
 *   [Icon Rail 56px] → [Flyout Panel 288px] overlaid on 3D viewer
 *
 * Tabs: Edit | Models | Testing | Support | Projects | Summary
 */

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import SummaryPanel from './SummaryPanel';

/* ─── constants ─── */
const RAIL_W = 64;
const PANEL_W = 340;

const BOX_TYPES = [
  { id: 'rsc',     label: 'RSC',       thai: 'กล่องลูกฟูก' },
  { id: 'die_cut', label: 'Die-cut',   thai: 'ฝาเสียบ' },
  { id: 'tube_lock', label: 'Tube Lock', thai: 'ทรงยาว' },
  { id: 'self_lock', label: 'Self-Lock', thai: 'ล็อกอัตโนมัติ' },
  { id: 'heart',   label: 'Heart',     thai: 'หัวใจ' },
];

const SUPPORT_TYPES = ['die_cut', 'self_lock', 'heart'];

/* ─── Tab definitions ─── */
const TABS = [
  { id: 'edit',    label: 'Edit',     icon: EditIcon },
  { id: 'models',  label: 'Models',   icon: ModelsIcon },
  { id: 'support', label: 'Support',  icon: SupportIcon },
  { id: 'test',    label: 'Test',     icon: TestIcon },
  { id: 'summary', label: 'Summary',  icon: SummaryIcon },
];

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
  supportConfig,
  onSupportConfigChange,
  /* new props from App.jsx */
  onSignOut,
  isComplete,
  collectedData,
  onCheckout,
}) {
  const [activeTab, setActiveTab] = useState(null); // null = closed
  const panelRef = useRef(null);
  const isDanger = analysis?.status === 'DANGER';

  // Show all tabs — support is always visible but disabled for non-support types
  const visibleTabs = TABS;
  const supportDisabled = !SUPPORT_TYPES.includes(boxType);

  const toggle = (id) => setActiveTab(prev => (prev === id ? null : id));

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute', top: 12, left: 20, bottom: 12, zIndex: 30,
        display: 'flex', gap: 8, pointerEvents: 'none',
      }}
    >
      {/* ═══ Icon Rail (floating pill, hugs content) ═══ */}
      <div
        style={{
          width: RAIL_W,
          flexShrink: 0,
          alignSelf: 'flex-start',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          paddingTop: 12,
          paddingBottom: 12,
          background: '#f3f4f6',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
          pointerEvents: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 800,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            L
          </div>
        </div>

        <div style={{ width: 28, height: 1, background: 'rgba(0,0,0,0.08)', marginBottom: 4 }} />

        {/* Tab buttons */}
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id;
          const isDisabled = tab.id === 'support' && supportDisabled;
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && toggle(tab.id)}
              title={isDisabled ? 'ไม่รองรับกล่องประเภทนี้' : tab.label}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                background: isActive ? 'rgba(124,58,237,0.1)' : 'transparent',
                color: isDisabled ? '#d1d5db' : isActive ? '#7c3aed' : '#374151',
                opacity: isDisabled ? 0.5 : 1,
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive && !isDisabled) e.currentTarget.style.background = 'rgba(124,58,237,0.05)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Active dot indicator */}
              {isActive && (
                <div style={{
                  position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: '#7c3aed',
                }} />
              )}
              <tab.icon size={20} />
              <span style={{
                fontSize: 9, fontWeight: 600, lineHeight: 1,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                letterSpacing: '0.01em',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* ── Link icons (no flyout) ── */}
        <Link
          to="/projects"
          title="Projects"
          style={{
            width: 44, height: 44, borderRadius: 12, border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            color: '#374151', textDecoration: 'none', transition: 'color 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#7c3aed'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#374151'; }}
        >
          <ProjectsIcon size={20} />
          <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Projects</span>
        </Link>

        {onSignOut ? (
          <button
            onClick={onSignOut}
            title="Logout"
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none', background: 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              color: '#374151', cursor: 'pointer', transition: 'color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#374151'; }}
          >
            <LogoutIcon size={20} />
            <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Logout</span>
          </button>
        ) : (
          <Link
            to="/login"
            title="Login"
            style={{
              width: 44, height: 44, borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              color: '#7c3aed', textDecoration: 'none',
            }}
          >
            <LogoutIcon size={20} />
            <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Login</span>
          </Link>
        )}
      </div>

      {/* ═══ Flyout Panel (floating card) ═══ */}
      <div
        style={{
          width: activeTab ? PANEL_W : 0,
          opacity: activeTab ? 1 : 0,
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
          pointerEvents: activeTab ? 'auto' : 'none',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: PANEL_W,
            height: '100%',
            background: '#f3f4f6',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <div style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{
              fontSize: 13, fontWeight: 700, color: '#111827',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              margin: 0,
            }}>
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

          {/* Panel content (scrollable) */}
          <div className="scrollbar-thin" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {activeTab === 'edit' && (
              <EditPanel
                formData={formData}
                onFormChange={onFormChange}
                image={image}
                onImageUpload={onImageUpload}
                onGeneratePDF={onGeneratePDF}
                analysis={analysis}
              />
            )}
            {activeTab === 'models' && (
              <ModelsPanel boxType={boxType} onBoxTypeChange={onBoxTypeChange} />
            )}
            {activeTab === 'test' && (
              <TestPanel
                formData={formData}
                onFormChange={onFormChange}
                analysis={analysis}
                onAnalyze={onAnalyze}
                loading={loading}
                isDanger={isDanger}
              />
            )}
            {activeTab === 'support' && (
              <SupportPanel config={supportConfig} onChange={onSupportConfigChange} />
            )}
            {activeTab === 'summary' && (
              <div style={{ height: '100%' }}>
                <SummaryPanel />
              </div>
            )}
          </div>

          {/* Checkout CTA (when complete) */}
          {isComplete && collectedData?.pricing && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <button
                onClick={onCheckout}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 12, border: 'none',
                  background: '#7c3aed', color: '#fff', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#6d28d9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#7c3aed'; }}
              >
                Checkout — ฿{collectedData.pricing.grand_total?.toLocaleString()}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ============================================================
 * Tab Panels
 * ========================================================== */

/* ─── Edit Panel ─── */
function EditPanel({ formData, onFormChange, image, onImageUpload, onGeneratePDF, analysis }) {
  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Upload */}
      <Section label="Upload images">
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <div style={{
            border: '2px dashed rgba(0,0,0,0.12)',
            borderRadius: 14,
            padding: image ? '16px' : '28px 16px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.6)',
            transition: 'border-color 0.2s',
          }}>
            {image ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
                <span style={{ fontSize: 11, color: '#111827', fontWeight: 500 }}>Uploaded (click to change)</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <div style={{
                  background: '#7c3aed', color: '#fff', borderRadius: 10,
                  padding: '7px 18px', fontSize: 12, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload
                </div>
              </div>
            )}
          </div>
          <input type="file" accept="image/*" onChange={onImageUpload} style={{ display: 'none' }} />
        </label>
        {analysis && (
          <button
            onClick={onGeneratePDF}
            style={{
              marginTop: 8, background: 'none', border: 'none', width: '100%',
              color: '#111827', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              textDecoration: 'underline', textAlign: 'center',
            }}
          >
            Download dieline (AI, PDF)
          </button>
        )}
      </Section>

      {/* Flute */}
      <Section label="Custom material">
        <RowButton>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 1 }}>Flute</div>
            <select
              name="flute_type"
              value={formData.flute_type}
              onChange={onFormChange}
              style={{
                background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
                color: '#111827', cursor: 'pointer', outline: 'none', padding: 0,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <option value="A">A (4.5mm)</option>
              <option value="C">C (3.6mm)</option>
              <option value="B">B (2.5mm)</option>
              <option value="E">E (1.5mm)</option>
              <option value="BC">BC (2 ชั้น)</option>
            </select>
          </div>
          <Chevron />
        </RowButton>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ fontSize: 10, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Material
            <select
              name="box_style"
              value={formData.box_style || 'kraft'}
              onChange={onFormChange}
              style={{
                background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.06)',
                fontSize: 12, borderRadius: 10, color: '#111827', padding: '7px 10px',
                outline: 'none', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <option value="kraft">Kraft</option>
              <option value="white">White cardboard</option>
              <option value="heart_red">Heart red</option>
            </select>
          </label>
          <label style={{ fontSize: 10, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Support
            <select
              name="support_required"
              value={formData.support_required ? 'yes' : 'no'}
              onChange={(e) => onFormChange({ target: { name: 'support_required', value: e.target.value === 'yes' } })}
              style={{
                background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.06)',
                fontSize: 12, borderRadius: 10, color: '#111827', padding: '7px 10px',
                outline: 'none', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <option value="no">No support</option>
              <option value="yes">With support</option>
            </select>
          </label>
        </div>
      </Section>

      {/* Dimensions */}
      <Section label="Custom size">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <DimSlider label="L" name="length" value={formData.length} max={Math.max(60, Number(formData.length) + 10)} onChange={onFormChange} />
          <DimSlider label="W" name="width"  value={formData.width}  max={Math.max(60, Number(formData.width) + 10)}  onChange={onFormChange} />
          <DimSlider label="H" name="height" value={formData.height} max={Math.max(50, Number(formData.height) + 10)} onChange={onFormChange} />
        </div>
        <div style={{
          marginTop: 12, background: 'rgba(0,0,0,0.04)', borderRadius: 10,
          padding: '7px 0', textAlign: 'center',
          fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#111827',
        }}>
          {(Number(formData.length) * 10).toFixed(0)} × {(Number(formData.width) * 10).toFixed(0)} × {(Number(formData.height) * 10).toFixed(0)} mm
        </div>
      </Section>
    </div>
  );
}

/* ─── Models Panel ─── */
function ModelsPanel({ boxType, onBoxTypeChange }) {
  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
      }}>
        {BOX_TYPES.map(bt => {
          const isActive = boxType === bt.id;
          return (
            <button
              key={bt.id}
              onClick={() => onBoxTypeChange({ target: { value: bt.id } })}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '14px 8px 10px',
                borderRadius: 14,
                border: isActive ? '2px solid #7c3aed' : '1px solid rgba(0,0,0,0.08)',
                background: isActive ? 'rgba(124,58,237,0.04)' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = isActive ? '#7c3aed' : 'rgba(0,0,0,0.08)'; }}
            >
              <BoxPreviewSVG type={bt.id} active={isActive} />
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: isActive ? '#7c3aed' : '#111827',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  {bt.label}
                </div>
                <div style={{ fontSize: 9, color: isActive ? '#7c3aed' : '#6b7280', fontWeight: 500 }}>
                  {bt.thai}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Test Panel ─── */
function TestPanel({ formData, onFormChange, analysis, onAnalyze, loading, isDanger }) {
  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section label="Product weight">
        <input
          type="number"
          name="weight"
          placeholder="kg"
          value={formData.weight}
          onChange={onFormChange}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#111827', outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </Section>

      <Section label="Flute type">
        <RowButton>
          <div>
            <select
              name="flute_type"
              value={formData.flute_type}
              onChange={onFormChange}
              style={{
                background: 'none', border: 'none', fontSize: 13, fontWeight: 600,
                color: '#111827', cursor: 'pointer', outline: 'none', padding: 0,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <option value="A">ลอน A (หนา 4.5mm)</option>
              <option value="C">ลอน C (มาตรฐาน 3.6mm)</option>
              <option value="B">ลอน B (บาง 2.5mm)</option>
              <option value="E">ลอน E (จิ๋ว 1.5mm)</option>
              <option value="BC">ลอน BC (2 ชั้น หนักมาก)</option>
            </select>
          </div>
          <Chevron />
        </RowButton>
      </Section>

      <button
        onClick={onAnalyze}
        disabled={loading}
        style={{
          width: '100%', padding: '11px 0', borderRadius: 12, border: 'none',
          fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          background: isDanger ? '#dc2626' : '#7c3aed', color: '#fff',
          opacity: loading ? 0.5 : 1, transition: 'all 0.2s',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {loading ? 'AI Analyzing...' : 'Analyze Strength'}
      </button>

      {analysis && (
        <div style={{
          padding: '12px 14px', borderRadius: 12, fontSize: 12,
          background: isDanger ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${isDanger ? '#fecaca' : '#bbf7d0'}`,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: isDanger ? '#dc2626' : '#16a34a', fontSize: 13 }}>
            {analysis.status}
          </div>
          <div style={{ color: '#374151', lineHeight: 1.6 }}>
            Safety: {analysis.safety_score} / 100<br />
            Max load: {analysis.max_load_kg} kg
          </div>
          {analysis.recommendation && (
            <div style={{ marginTop: 6, color: '#6b7280', fontSize: 11, fontStyle: 'italic' }}>
              {analysis.recommendation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Support Panel ─── */
function SupportPanel({ config, onChange }) {
  const holes = config.holes || [];

  const addHole = (type) => {
    const newHole = { id: Date.now(), type, x: 0, y: 0 };
    if (type === 'circle') newHole.r = 2.0;
    else { newHole.w = 3.0; newHole.l = 5.0; }
    onChange(prev => ({ ...prev, holes: [...(prev.holes || []), newHole] }));
  };

  const removeHole = (id) => {
    onChange(prev => ({ ...prev, holes: prev.holes.filter(h => h.id !== id) }));
  };

  const updateHole = (id, prop, val) => {
    onChange(prev => ({
      ...prev,
      holes: prev.holes.map(h => h.id === id ? { ...h, [prop]: val } : h),
    }));
  };

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Wall height */}
      <Section label={`Wall height — ${Math.round((config.wallHeight || 0.78) * 100)}%`}>
        <input
          type="range" min="40" max="95"
          value={Math.round((config.wallHeight || 0.78) * 100)}
          onChange={e => onChange(prev => ({ ...prev, wallHeight: parseInt(e.target.value) / 100 }))}
          style={{ width: '100%', height: 4, accentColor: '#7c3aed', cursor: 'pointer' }}
        />
      </Section>

      {/* Add hole buttons */}
      <Section label="Add holes">
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { type: 'circle',  label: 'Circle',  icon: '○' },
            { type: 'rect',    label: 'Rect',     icon: '□' },
            { type: 'capsule', label: 'Capsule',  icon: '⬭' },
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

      {/* Individual hole controls */}
      {holes.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '20px 10px', color: '#6b7280', fontSize: 11,
          background: 'rgba(0,0,0,0.03)', borderRadius: 10,
        }}>
          No holes yet — add one above
        </div>
      )}

      {holes.map((hole, idx) => {
        const typeLabel = hole.type === 'circle' ? '○ Circle' : hole.type === 'rect' ? '□ Rect' : '⬭ Capsule';
        return (
          <div key={hole.id} style={{
            background: 'rgba(255,255,255,0.5)', borderRadius: 10, padding: '10px 12px',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>
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
            <HoleSlider
              label="X" value={hole.x} min={-15} max={15} step={0.5}
              onChange={v => updateHole(hole.id, 'x', v)}
            />
            {/* Position Y */}
            <HoleSlider
              label="Y" value={hole.y} min={-15} max={15} step={0.5}
              onChange={v => updateHole(hole.id, 'y', v)}
            />

            {/* Size controls per type */}
            {hole.type === 'circle' ? (
              <HoleSlider
                label="Radius" value={hole.r || 2} min={0.5} max={10} step={0.1}
                onChange={v => updateHole(hole.id, 'r', v)}
              />
            ) : (
              <>
                <HoleSlider
                  label="W" value={hole.w || 3} min={1} max={15} step={0.1}
                  onChange={v => updateHole(hole.id, 'w', v)}
                />
                <HoleSlider
                  label="L" value={hole.l || 5} min={1} max={20} step={0.1}
                  onChange={v => updateHole(hole.id, 'l', v)}
                />
              </>
            )}
          </div>
        );
      })}

      {/* Mini preview */}
      <SupportPreview config={config} />
    </div>
  );
}

/** Small labeled slider for hole properties */
function HoleSlider({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#111827', fontFamily: "'JetBrains Mono', monospace" }}>
          {Number(value).toFixed(1)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: 3, accentColor: '#7c3aed', cursor: 'pointer' }}
      />
    </div>
  );
}


/* ============================================================
 * Shared UI Primitives
 * ========================================================== */

function Section({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
        color: '#6b7280', marginBottom: 8,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function RowButton({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: 12, padding: '10px 14px',
    }}>
      {children}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
  );
}

function DimSlider({ label, name, value, max, onChange }) {
  // UI in mm, internal state stays in cm (App.jsx expects cm for calculations).
  const mmValue = Number(value) * 10;
  const mmMax = Number(max) * 10;
  const mmMin = 10;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <input
            type="number"
            name={name}
            value={Number.isFinite(mmValue) ? mmValue : 0}
            min={mmMin}
            max={mmMax}
            step={1}
            onChange={(e) => {
              const nextMm = Number(e.target.value);
              const nextCm = (Number.isFinite(nextMm) ? nextMm : 0) / 10;
              onChange({ target: { name, value: nextCm } });
            }}
            style={{
              width: 48, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 8, padding: '4px 6px', fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#111827',
              textAlign: 'center', outline: 'none',
            }}
          />
          <span style={{ fontSize: 10, color: '#6b7280', fontFamily: "'JetBrains Mono', monospace" }}>mm</span>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
 * Box Type SVG Previews
 * ========================================================== */
function BoxPreviewSVG({ type, active }) {
  const c = active ? '#7c3aed' : '#c4b5fd';
  const fill = active ? 'rgba(124,58,237,0.06)' : 'rgba(139,92,246,0.03)';
  const s = 44; // viewBox size

  const previews = {
    rsc: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        {/* Simple RSC box — front face + top flap */}
        <rect x="8" y="16" width="28" height="20" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <path d="M8 16 L14 8 L36 8 L36 16" fill={fill} stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="36" y1="8" x2="36" y2="16" stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    die_cut: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        {/* Tuck-end style */}
        <rect x="9" y="10" width="26" height="28" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <line x1="9" y1="17" x2="35" y2="17" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <path d="M16 10 L16 6 Q22 3 28 6 L28 10" fill={fill} stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    tube_lock: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="9" y="9" width="26" height="26" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <line x1="16" y1="9" x2="16" y2="35" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <line x1="28" y1="9" x2="28" y2="35" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
      </svg>
    ),
    self_lock: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="8" y="12" width="28" height="20" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <path d="M8 12 L14 7 L30 7 L36 12" fill={fill} stroke={c} strokeWidth="1.5" />
        <path d="M8 32 L14 37 L30 37 L36 32" fill={fill} stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    heart: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <path d="M22 36 C8 26 4 18 10 12 C14 8 20 10 22 14 C24 10 30 8 34 12 C40 18 36 26 22 36Z" fill={fill} stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    star: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <path d="M22 6 L26 16 L37 17 L29 24 L31 35 L22 29 L13 35 L15 24 L7 17 L18 16Z" fill={fill} stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    bear: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        {/* Ears */}
        <circle cx="13" cy="12" r="5" fill={fill} stroke={c} strokeWidth="1.5" />
        <circle cx="31" cy="12" r="5" fill={fill} stroke={c} strokeWidth="1.5" />
        {/* Head */}
        <circle cx="22" cy="24" r="13" fill={fill} stroke={c} strokeWidth="1.5" />
        {/* Eyes */}
        <circle cx="17" cy="22" r="1.5" fill={c} />
        <circle cx="27" cy="22" r="1.5" fill={c} />
        {/* Nose */}
        <ellipse cx="22" cy="27" rx="2.5" ry="1.5" fill={c} />
      </svg>
    ),
    circle: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <circle cx="22" cy="22" r="16" fill={fill} stroke={c} strokeWidth="1.5" />
        <ellipse cx="22" cy="22" rx="16" ry="5" fill="none" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
      </svg>
    ),
    bow: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        {/* Box */}
        <rect x="8" y="18" width="28" height="18" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        {/* Bow ribbon */}
        <path d="M22 18 Q14 12 10 8 Q14 14 22 14 Q30 14 34 8 Q30 12 22 18Z" fill={fill} stroke={c} strokeWidth="1.5" />
        <circle cx="22" cy="17" r="2.5" fill={c} opacity="0.3" stroke={c} strokeWidth="1" />
      </svg>
    ),
  };

  return previews[type] || previews.rsc;
}


/* ============================================================
 * Support Preview (mini SVG)
 * ========================================================== */
function SupportPreview({ config }) {
  const holes = config.holes || [];
  const svgW = 140, svgH = 90;
  // Scale: map hole coords (cm, centered at 0,0) to SVG coords
  const scale = 3.5;
  const cx = svgW / 2, cy = svgH / 2;

  return (
    <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 0', display: 'flex', justifyContent: 'center' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        {/* Plate outline */}
        <rect x={4} y={4} width={svgW - 8} height={svgH - 8} rx={6} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={1} />
        {/* Holes */}
        {holes.map((hole, i) => {
          const hx = cx + hole.x * scale;
          const hy = cy - hole.y * scale;
          if (hole.type === 'circle') {
            const r = (hole.r || 2) * scale;
            return <circle key={i} cx={hx} cy={hy} r={r} fill="#fff" stroke="#6b7280" strokeWidth={1} />;
          }
          if (hole.type === 'rect' || hole.type === 'rectangle') {
            const w = (hole.w || 3) * scale;
            const l = (hole.l || 5) * scale;
            return <rect key={i} x={hx - w / 2} y={hy - l / 2} width={w} height={l} rx={2} fill="#fff" stroke="#6b7280" strokeWidth={1} />;
          }
          // capsule
          const w = (hole.w || 3) * scale;
          const l = (hole.l || 5) * scale;
          const cr = w / 2;
          return <rect key={i} x={hx - w / 2} y={hy - l / 2} width={w} height={l} rx={cr} fill="#faf5ff" stroke="#a78bfa" strokeWidth={1} />;
        })}
      </svg>
    </div>
  );
}


/* ============================================================
 * Icons (inline SVGs — no dependencies)
 * ========================================================== */
function EditIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ModelsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function TestIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function SupportIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function SummaryIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function ProjectsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function LogoutIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

