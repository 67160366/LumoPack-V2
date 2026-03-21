/**
 * Shared 3D cardboard material picker (Kraft / White / Heart red)
 */
import { getScheme, MATERIAL_PRESETS } from './cardboardColors';

const FONT = "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif";

export default function MaterialPresetPicker({
  value,
  onChange,
  accentColor = '#7c3aed',
  sectionLabel = 'กระดาษ / สีกล่อง',
  hint,
  presets,
}) {
  const items = presets || MATERIAL_PRESETS;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 8, fontFamily: FONT }}>{sectionLabel}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((m) => {
          const sch = getScheme(m.id);
          const sel = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 14,
                border: sel ? `2px solid ${accentColor}` : '1px solid rgba(0,0,0,0.08)',
                background: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${sch.base}, ${sch.wall})`,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontFamily: FONT }}>{m.label}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, fontFamily: FONT }}>{m.hint}</div>
              </div>
              {sel && <span style={{ fontSize: 11, fontWeight: 800, color: accentColor, fontFamily: 'JetBrains Mono, monospace' }}>✓</span>}
            </button>
          );
        })}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FONT, marginTop: 12 }}>{hint}</div>
      )}
    </div>
  );
}

export { MATERIAL_PRESETS };
