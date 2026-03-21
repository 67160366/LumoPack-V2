/**
 * HomePage — Main landing page after login (Pacdora-inspired)
 *
 * Shows model gallery in center, floating chatbot bubble bottom-right,
 * simplified rail (Projects, Models, Logout) on left.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import FloatingChat from '../components/Chatbot/FloatingChat';

/* ─── Box type definitions (linked to test pages) ─── */
const BOX_TYPES = [
  { id: 'rsc',       label: 'RSC',       thai: 'กล่องลูกฟูก',  desc: 'กล่องลูกฟูกมาตรฐาน เหมาะสำหรับการขนส่ง',         path: '/rsc-test' },
  { id: 'die_cut',   label: 'Die-cut',   thai: 'ฝาเสียบ',     desc: 'กล่องฝาเสียบ ดีไซน์สวยงาม',                       path: '/dieline-test' },
  { id: 'tube_lock', label: 'Tube Lock', thai: 'ท่อล็อค',     desc: 'กล่องท่อล็อค แข็งแรง ใช้งานง่าย',                 path: '/tube-lock-test' },
  { id: 'heart',     label: 'Heart',     thai: 'หัวใจ',        desc: 'กล่องรูปหัวใจ สำหรับของขวัญ',                     path: '/heart-box-test' },
  { id: 'self_lock', label: 'Self-Lock', thai: 'ล็อคอัตโนมัติ', desc: 'กล่องล็อคตัวเอง ประกอบง่าย แข็งแรง',              path: '/self-lock-test' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [hoveredModel, setHoveredModel] = useState(null);
  const [railOpen, setRailOpen] = useState(null); // null | 'models'

  const handleSelectModel = (path) => {
    navigate(path);
  };

  return (
    <div className="flex w-screen h-screen bg-gray-50 overflow-hidden">

      {/* ═══ Simplified Rail ═══ */}
      <div
        style={{
          position: 'fixed', top: 12, left: 20, bottom: 12, zIndex: 40,
          display: 'flex', gap: 8, pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 64, flexShrink: 0, alignSelf: 'flex-start',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, paddingTop: 12, paddingBottom: 12,
            background: '#f3f4f6', borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
            pointerEvents: 'auto',
          }}
        >
          {/* Logo */}
          <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img
              src="/logo.png"
              alt="LumoPack"
            />
          </div>

          <div style={{ width: 28, height: 1, background: 'rgba(0,0,0,0.08)', marginBottom: 4 }} />

          {/* Models */}
          <button
            onClick={() => setRailOpen(railOpen === 'models' ? null : 'models')}
            title="Models"
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
              background: railOpen === 'models' ? 'rgba(124,58,237,0.1)' : 'transparent',
              color: railOpen === 'models' ? '#7c3aed' : '#374151',
              position: 'relative',
            }}
            onMouseEnter={e => { if (railOpen !== 'models') e.currentTarget.style.background = 'rgba(124,58,237,0.05)'; }}
            onMouseLeave={e => { if (railOpen !== 'models') e.currentTarget.style.background = 'transparent'; }}
          >
            {railOpen === 'models' && (
              <div style={{
                position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                width: 4, height: 4, borderRadius: '50%', background: '#7c3aed',
              }} />
            )}
            <ModelsIcon size={20} />
            <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Models</span>
          </button>

          {/* Projects */}
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

          {/* Logout */}
          <button
            onClick={signOut}
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
        </div>

        {/* ═══ Rail Flyout: Models ═══ */}
        <div
          style={{
            width: railOpen === 'models' ? 340 : 0,
            opacity: railOpen === 'models' ? 1 : 0,
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
            pointerEvents: railOpen === 'models' ? 'auto' : 'none',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 340, height: '100%',
              background: '#f3f4f6', borderRadius: 16,
              boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '14px 16px 12px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{
                fontSize: 13, fontWeight: 700, color: '#111827',
                fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0,
              }}>
                Models
              </h2>
              <button
                onClick={() => setRailOpen(null)}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: 'rgba(0,0,0,0.04)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {BOX_TYPES.map(bt => (
                  <button
                    key={bt.id}
                    onClick={() => handleSelectModel(bt.path)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '14px 8px 10px', borderRadius: 14,
                      border: '1px solid rgba(0,0,0,0.08)', background: '#fff',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = 'rgba(124,58,237,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.background = '#fff'; }}
                  >
                    <BoxPreviewSVG type={bt.id} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{bt.label}</div>
                      <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 500 }}>{bt.thai}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* Hero Section */}
        <div
          style={{
            background: 'linear-gradient(135deg, #faf5ff 0%, #f0e7fe 40%, #e8dff5 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Grid pattern overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />

          <div style={{
            position: 'relative', zIndex: 1,
            maxWidth: 900, margin: '0 auto',
            padding: '36px 40px 28px',
            textAlign: 'center',
          }}>
            {/* Logo badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(124,58,237,0.08)', borderRadius: 20, padding: '5px 14px',
              marginBottom: 14,
            }}>
              <img src="/logo.png" alt="LumoPack" style={{ width: 22, height: 22, objectFit: 'contain' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                LumoPack Studio
              </span>
            </div>

            <h1 style={{
              fontSize: 30, fontWeight: 800, color: '#1a1a2e',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              lineHeight: 1.25, margin: '0 0 10px',
            }}>
              ออกแบบบรรจุภัณฑ์
              <span style={{ color: '#7c3aed' }}> ของคุณ</span>
            </h1>

            <p style={{
              fontSize: 14, color: '#6b7280', maxWidth: 460, margin: '0 auto 20px',
              fontFamily: "'Sarabun', sans-serif", lineHeight: 1.6,
            }}>
              เลือกโมเดลกล่องที่ต้องการ แล้วปรับแต่งขนาด วัสดุ และดีไซน์ ได้ตามใจชอบ
            </p>

            <button
              onClick={() => {
                document.getElementById('models-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '10px 28px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
                boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,58,237,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,58,237,0.3)'; }}
            >
              เริ่มออกแบบกล่อง
            </button>
          </div>
        </div>

        {/* Models Grid Section */}
        <div
          id="models-section"
          style={{
            maxWidth: 1000, margin: '0 auto', width: '100%',
            padding: '28px 40px 60px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{
              fontSize: 20, fontWeight: 800, color: '#1a1a2e',
              fontFamily: "'Plus Jakarta Sans', sans-serif", margin: '0 0 6px',
            }}>
              เลือกโมเดลกล่อง
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', fontFamily: "'Sarabun', sans-serif" }}>
              คลิกเลือกแบบกล่องเพื่อเริ่มออกแบบ
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}>
            {BOX_TYPES.map(bt => {
              const isHovered = hoveredModel === bt.id;
              return (
                <button
                  key={bt.id}
                  onClick={() => handleSelectModel(bt.path)}
                  onMouseEnter={() => setHoveredModel(bt.id)}
                  onMouseLeave={() => setHoveredModel(null)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 10, padding: '20px 14px 16px',
                    borderRadius: 18, cursor: 'pointer',
                    border: isHovered ? '2px solid #7c3aed' : '1px solid rgba(0,0,0,0.08)',
                    background: isHovered ? 'rgba(124,58,237,0.03)' : '#fff',
                    boxShadow: isHovered
                      ? '0 8px 30px rgba(124,58,237,0.15)'
                      : '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                  }}
                >
                  <div style={{
                    width: 64, height: 64, borderRadius: 14,
                    background: isHovered ? 'rgba(124,58,237,0.06)' : '#f9fafb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s',
                  }}>
                    <BoxPreviewSVGLarge type={bt.id} active={isHovered} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700,
                      color: isHovered ? '#7c3aed' : '#111827',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: 'color 0.2s',
                    }}>
                      {bt.label}
                    </div>
                    <div style={{
                      fontSize: 11, color: isHovered ? '#7c3aed' : '#6b7280',
                      fontWeight: 500, marginTop: 1,
                    }}>
                      {bt.thai}
                    </div>
                    <div style={{
                      fontSize: 10, color: '#9ca3af', marginTop: 4,
                      fontFamily: "'Sarabun', sans-serif", lineHeight: 1.4,
                    }}>
                      {bt.desc}
                    </div>
                  </div>

                  {/* Arrow button */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: isHovered ? '#7c3aed' : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', marginTop: 4,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke={isHovered ? '#fff' : '#9ca3af'} strokeWidth="2" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Floating Chatbot Bubble ═══ */}
      <FloatingChat />

    </div>
  );
}


/* ════════════════════════════════════════
 * Large Box Preview SVGs (for main cards)
 * ════════════════════════════════════════ */
function BoxPreviewSVGLarge({ type, active }) {
  const c = active ? '#7c3aed' : '#a78bfa';
  const fill = active ? 'rgba(124,58,237,0.08)' : 'rgba(139,92,246,0.04)';
  const s = 56;

  const previews = {
    rsc: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="8" y="16" width="28" height="20" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <path d="M8 16 L14 8 L36 8 L36 16" fill={fill} stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="36" y1="8" x2="36" y2="16" stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    die_cut: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="9" y="10" width="26" height="28" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <line x1="9" y1="17" x2="35" y2="17" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <path d="M16 10 L16 6 Q22 3 28 6 L28 10" fill={fill} stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    tube_lock: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="8" y="8" width="28" height="28" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <line x1="8" y1="14" x2="36" y2="14" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <line x1="8" y1="30" x2="36" y2="30" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <rect x="14" y="30" width="6" height="6" rx="0.5" fill={fill} stroke={c} strokeWidth="1" />
        <rect x="24" y="30" width="6" height="6" rx="0.5" fill={fill} stroke={c} strokeWidth="1" />
      </svg>
    ),
    heart: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <path d="M22 36 C8 26 4 18 10 12 C14 8 20 10 22 14 C24 10 30 8 34 12 C40 18 36 26 22 36Z" fill={fill} stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    self_lock: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="8" y="10" width="28" height="24" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <line x1="8" y1="16" x2="36" y2="16" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <path d="M14 10 L14 6 L30 6 L30 10" fill={fill} stroke={c} strokeWidth="1.5" />
        <rect x="18" y="6" width="8" height="4" rx="1" fill={fill} stroke={c} strokeWidth="1" />
      </svg>
    ),
  };

  return previews[type] || previews.rsc;
}

/* Small preview for rail flyout */
function BoxPreviewSVG({ type }) {
  const c = '#a78bfa';
  const fill = 'rgba(139,92,246,0.04)';
  const s = 44;

  const previews = {
    rsc: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="8" y="16" width="28" height="20" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <path d="M8 16 L14 8 L36 8 L36 16" fill={fill} stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="36" y1="8" x2="36" y2="16" stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    die_cut: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="9" y="10" width="26" height="28" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <line x1="9" y1="17" x2="35" y2="17" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <path d="M16 10 L16 6 Q22 3 28 6 L28 10" fill={fill} stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    tube_lock: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="8" y="8" width="28" height="28" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <line x1="8" y1="14" x2="36" y2="14" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <line x1="8" y1="30" x2="36" y2="30" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <rect x="14" y="30" width="6" height="6" rx="0.5" fill={fill} stroke={c} strokeWidth="1" />
        <rect x="24" y="30" width="6" height="6" rx="0.5" fill={fill} stroke={c} strokeWidth="1" />
      </svg>
    ),
    heart: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <path d="M22 36 C8 26 4 18 10 12 C14 8 20 10 22 14 C24 10 30 8 34 12 C40 18 36 26 22 36Z" fill={fill} stroke={c} strokeWidth="1.5" />
      </svg>
    ),
    self_lock: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="8" y="10" width="28" height="24" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <line x1="8" y1="16" x2="36" y2="16" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <path d="M14 10 L14 6 L30 6 L30 10" fill={fill} stroke={c} strokeWidth="1.5" />
        <rect x="18" y="6" width="8" height="4" rx="1" fill={fill} stroke={c} strokeWidth="1" />
      </svg>
    ),
  };

  return previews[type] || previews.rsc;
}


/* ════════════════════════════════════════
 * Rail Icons
 * ════════════════════════════════════════ */
function ModelsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
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
