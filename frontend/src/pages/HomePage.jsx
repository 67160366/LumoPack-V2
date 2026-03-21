/**
 * HomePage — Fullscreen scroll-based landing page
 *
 * Section 1: Hero (100vh) — light purple bg with pexels image, bold typography
 * Section 2: Box models reveal on scroll with smooth animation
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView as useMotionInView, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import FloatingChat from '../components/Chatbot/FloatingChat';

/* ─── Box type definitions (6 items → 2 rows x 3 cols) ─── */
const BOX_TYPES = [
  { id: 'rsc',       label: 'Heavy Duty Box', thai: 'กล่องลูกฟูก',           desc: 'กล่องลูกฟูกมาตรฐาน เหมาะสำหรับการขนส่ง',       path: '/rsc-test' },
  { id: 'die_cut',   label: 'Folding Box',   thai: 'กล่องไดคัท',           desc: 'กล่องฝาเสียบ ดีไซน์สวยงาม',                     path: '/dieline-test' },
  { id: 'tube_lock', label: 'Tube Lock', thai: 'กล่องทับล็อค',         desc: 'กล่องทับล็อค แข็งแรง ใช้งานง่าย',                path: '/tube-lock-test' },
  { id: 'heart',     label: 'Heart',     thai: 'กล่องหัวใจ',            desc: 'กล่องรูปหัวใจ สำหรับของขวัญ',                   path: '/heart-box-test' },
  { id: 'self_lock', label: 'Self-Lock', thai: 'กล่องล็อคก้นอัตโนมัติ',  desc: 'กล่องล็อคตัวเอง ประกอบง่าย แข็งแรง',            path: '/self-lock-test' },
  { id: 'display',   label: 'Display Box', thai: 'กล่องดิสเพลย์',       desc: 'กล่องโชว์สินค้า เปิดหน้าได้',                   path: null, dummy: true },
];


export default function HomePage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef(null);

  // scrollY is updated via onScroll on the container div

  const handleSelectModel = (path) => navigate(path);

  // Parallax values for hero
  const heroOpacity = Math.max(0, 1 - scrollY / 600);
  const heroTranslate = scrollY * 0.3;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', inset: 0,
        background: '#fff',
        overflowX: 'hidden',
        overflowY: 'auto',
        zIndex: 0,
      }}
      onScroll={(e) => setScrollY(e.currentTarget.scrollTop)}
    >

      {/* ═══ Fixed Navbar ═══ */}
      <nav
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          background: scrollY > 80
            ? 'rgba(255,255,255,0.85)'
            : 'transparent',
          backdropFilter: scrollY > 80 ? 'blur(20px)' : 'none',
          borderBottom: scrollY > 80 ? '1px solid rgba(124,58,237,0.08)' : 'none',
          transition: 'background 0.4s, backdrop-filter 0.4s, border-bottom 0.4s',
        }}
      >
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '16px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="LumoPack" style={{ width: 96, height: 96, objectFit: 'contain' }} />
            <span style={{
              fontSize: 18, fontWeight: 800,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              color: scrollY > 80 ? '#1a1a2e' : '#fff',
              transition: 'color 0.4s',
            }}>
              LumoPack
            </span>
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <NavLink
              label="Projects"
              onClick={() => navigate('/projects')}
              light={scrollY <= 80}
            />
            <NavLink
              label="Orders"
              onClick={() => navigate('/orders')}
              light={scrollY <= 80}
            />
            <button
              onClick={signOut}
              style={{
                background: scrollY > 80
                  ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                  : 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: scrollY > 80 ? 'none' : '1px solid rgba(255,255,255,0.3)',
                borderRadius: 10, padding: '8px 20px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: 'all 0.4s',
                backdropFilter: scrollY <= 80 ? 'blur(10px)' : 'none',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ Section 1: Hero (100vh) ═══ */}
      <section
        style={{
          position: 'relative',
          height: '100vh',
          minHeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Background image with purple overlay */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'url(/hero-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `translateY(${heroTranslate}px)`,
            transition: 'transform 0.1s linear',
          }}
        />
        {/* Purple gradient overlay */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(109,40,217,0.88) 0%, rgba(124,58,237,0.82) 40%, rgba(139,92,246,0.75) 100%)',
          }}
        />
        {/* Animated confetti/particles */}
        <ConfettiParticles />

        {/* Hero content */}
        <div
          style={{
            position: 'relative', zIndex: 2,
            textAlign: 'center',
            maxWidth: 800,
            padding: '0 40px',
            opacity: heroOpacity,
            transform: `translateY(${-heroTranslate * 0.5}px)`,
          }}
        >
          {/* Main heading */}
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 72px)',
            fontWeight: 800,
            color: '#fff',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            lineHeight: 1.1,
            margin: '0 0 20px',
            letterSpacing: '-0.02em',
          }}>
            ออกแบบบรรจุภัณฑ์
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #e9d5ff, #c4b5fd, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              อย่างมืออาชีพ
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 'clamp(14px, 2vw, 18px)',
            color: 'rgba(255,255,255,0.75)',
            maxWidth: 520, margin: '0 auto 36px',
            fontFamily: "'Sarabun', sans-serif",
            lineHeight: 1.7,
          }}>
            เลือกโมเดลกล่อง ปรับแต่งขนาด วัสดุ และดีไซน์ ด้วยระบบ AI อัจฉริยะ
          </p>

          {/* CTA button */}
          <button
            onClick={() => {
              document.getElementById('models-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{
              background: '#fff',
              color: '#6d28d9',
              border: 'none', borderRadius: 14,
              padding: '14px 36px', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              transition: 'transform 0.25s, box-shadow 0.25s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)'; }}
          >
            ดูโมเดลทั้งหมด
          </button>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: 'absolute', bottom: 36, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            opacity: heroOpacity,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>
            Scroll
          </span>
          <div style={{
            width: 24, height: 40, borderRadius: 12,
            border: '2px solid rgba(255,255,255,0.25)',
            display: 'flex', justifyContent: 'center', paddingTop: 8,
          }}>
            <div style={{
              width: 3, height: 10, borderRadius: 2,
              background: 'rgba(255,255,255,0.6)',
              animation: 'scrollBounce 2s ease-in-out infinite',
            }} />
          </div>
        </div>
      </section>

      {/* ═══ Section 2: Models Showcase (scroll-reveal) ═══ */}
      <ModelsSection onSelect={handleSelectModel} />

      {/* ═══ Floating Chatbot ═══ */}
      <FloatingChat />

      {/* ═══ Keyframe animations ═══ */}
      <style>{`
        @keyframes scrollBounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(8px); opacity: 0.3; }
        }
        @keyframes confettiFloat {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes confettiDrift {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(30px); }
        }
      `}</style>
    </div>
  );
}


/* ════════════════════════════════════════
 * Confetti Particles (Google Antigravity style)
 * ════════════════════════════════════════ */
function ConfettiParticles() {
  const particles = useRef([]);

  if (particles.current.length === 0) {
    const colors = [
      '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6',
      '#ec4899', '#f97316', '#06b6d4', '#a78bfa', '#fbbf24',
    ];
    particles.current = Array.from({ length: 35 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: Math.random() * 100,
      size: 3 + Math.random() * 5,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 10,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
      drift: -20 + Math.random() * 40,
    }));
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {particles.current.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            bottom: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 1.5 : p.size,
            borderRadius: p.shape === 'circle' ? '50%' : 2,
            background: p.color,
            opacity: 0.7,
            animation: `confettiFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
            transform: `translateX(${p.drift}px)`,
          }}
        />
      ))}
    </div>
  );
}


/* ════════════════════════════════════════
 * Models Section — framed, 2x3 grid, floating animation
 * ════════════════════════════════════════ */

// Each card gets a unique float offset so they bob at different times
const FLOAT_OFFSETS = [0, 0.8, 1.6, 2.4, 3.2, 4.0];

function ModelsSection({ onSelect }) {
  const sectionRef = useRef(null);
  const isInView = useMotionInView(sectionRef, { once: true, amount: 0.08 });
  const [hoveredModel, setHoveredModel] = useState(null);

  return (
    <section
      id="models-section"
      ref={sectionRef}
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #faf5ff 0%, #fff 30%)',
        padding: '100px 40px 120px',
        overflow: 'hidden',
      }}
    >
      {/* Decorative gradient blob */}
      <div style={{
        position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 400,
        background: 'radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Entire frame slides up together ── */}
      <motion.div
        initial={{ opacity: 0, y: 160, scale: 0.85 }}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{
          type: 'spring',
          stiffness: 180,
          damping: 22,
          mass: 1,
        }}
        style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto' }}
      >
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(124,58,237,0.06)', borderRadius: 20, padding: '5px 14px',
            marginBottom: 16,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Box Models
            </span>
          </div>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 42px)',
            fontWeight: 800, color: '#1a1a2e',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            margin: '0 0 12px', letterSpacing: '-0.01em',
          }}>
            เลือกโมเดลกล่อง
          </h2>
          <p style={{
            fontSize: 16, color: '#6b7280', maxWidth: 500, margin: '0 auto',
            fontFamily: "'Sarabun', sans-serif", lineHeight: 1.6,
          }}>
            คลิกเลือกแบบกล่องเพื่อเริ่มออกแบบ ปรับแต่งได้ตามต้องการ
          </p>
        </div>

        {/* ── Outer frame ── */}
        <div style={{
          background: 'linear-gradient(145deg, #faf5ff 0%, #f5f0ff 50%, #ede9fe 100%)',
          border: '1.5px solid rgba(124,58,237,0.12)',
          borderRadius: 36,
          padding: '48px 44px',
          boxShadow: '0 8px 40px rgba(124,58,237,0.08), 0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}>
          {/* 2 rows x 3 cols */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 28,
          }}>
            {BOX_TYPES.map((bt, i) => {
              const isHovered = hoveredModel === bt.id;
              const isDummy = bt.dummy;
              return (
                <motion.button
                  key={bt.id}
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    y: {
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: FLOAT_OFFSETS[i],
                    },
                  }}
                  whileHover={{
                    scale: 1.06,
                    transition: { type: 'spring', stiffness: 400, damping: 15 },
                  }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => !isDummy && onSelect(bt.path)}
                  onMouseEnter={() => setHoveredModel(bt.id)}
                  onMouseLeave={() => setHoveredModel(null)}
                  style={{
                    aspectRatio: '1 / 1',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 16, padding: 28,
                    borderRadius: 28,
                    cursor: isDummy ? 'default' : 'pointer',
                    border: isHovered ? '2px solid #7c3aed' : '1.5px solid rgba(124,58,237,0.1)',
                    background: isHovered
                      ? 'linear-gradient(145deg, #fff 0%, #f5f0ff 100%)'
                      : '#fff',
                    boxShadow: isHovered
                      ? '0 24px 48px rgba(124,58,237,0.18), 0 8px 16px rgba(124,58,237,0.08), inset 0 1px 0 rgba(255,255,255,0.8)'
                      : '0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)',
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: isDummy ? 0.55 : 1,
                  }}
                >
                  {/* "Coming Soon" badge for dummy */}
                  {isDummy && (
                    <div style={{
                      position: 'absolute', top: 14, right: 14,
                      background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                      color: '#fff', fontSize: 9, fontWeight: 700,
                      padding: '3px 10px', borderRadius: 8,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      letterSpacing: '0.04em',
                    }}>
                      COMING SOON
                    </div>
                  )}

                  {/* Icon — bigger */}
                  <div style={{
                    width: 88, height: 88, borderRadius: 22,
                    background: isHovered
                      ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(139,92,246,0.06))'
                      : '#f5f3ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.3s',
                  }}>
                    <BoxPreviewSVGLarge type={bt.id} active={isHovered} />
                  </div>

                  {/* Text */}
                  <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                    <div style={{
                      fontSize: 17, fontWeight: 700,
                      color: isHovered ? '#7c3aed' : '#111827',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: 'color 0.25s',
                    }}>
                      {bt.label}
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 500, marginTop: 4,
                      color: isHovered ? '#8b5cf6' : '#6b7280',
                      transition: 'color 0.25s',
                    }}>
                      {bt.thai}
                    </div>
                  </div>

                  {/* Arrow pill */}
                  {!isDummy && (
                    <div style={{
                      width: 38, height: 38, borderRadius: 12,
                      background: isHovered ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#f3f4f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', zIndex: 1,
                      transition: 'background 0.25s, box-shadow 0.25s',
                      boxShadow: isHovered ? '0 4px 14px rgba(124,58,237,0.35)' : 'none',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke={isHovered ? '#fff' : '#9ca3af'} strokeWidth="2.2" strokeLinecap="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </section>
  );
}


/* ════════════════════════════════════════
 * NavLink component
 * ════════════════════════════════════════ */
function NavLink({ label, onClick, light }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: 600,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: light
          ? (hovered ? '#fff' : 'rgba(255,255,255,0.7)')
          : (hovered ? '#7c3aed' : '#374151'),
        transition: 'color 0.2s',
        padding: '4px 0',
      }}
    >
      {label}
    </button>
  );
}


/* ════════════════════════════════════════
 * Large Box Preview SVGs
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
    display: (
      <svg width={s} height={s} viewBox="0 0 44 44" fill="none">
        <rect x="8" y="14" width="28" height="24" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
        <path d="M8 14 L8 8 Q8 6 10 6 L34 6 Q36 6 36 8 L36 14" fill={fill} stroke={c} strokeWidth="1.5" />
        <line x1="8" y1="22" x2="36" y2="22" stroke={c} strokeWidth="1" strokeDasharray="3 2" />
        <rect x="16" y="26" width="12" height="8" rx="1" fill={fill} stroke={c} strokeWidth="1" />
      </svg>
    ),
  };

  return previews[type] || previews.rsc;
}
