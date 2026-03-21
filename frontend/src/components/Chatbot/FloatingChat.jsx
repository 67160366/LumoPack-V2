/**
 * FloatingChat — Floating chatbot bubble (bottom-right) + resizable chat panel
 *
 * - Bubble: 80px circle with large logo, fixed bottom-right
 * - Panel: resizable via left edge / top edge / top-left corner drag
 * - Wraps ChatbotProvider + ChatWindow
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import ChatWindow from './ChatWindow';

const MIN_W = 360;
const MAX_W = 700;
const MIN_H = 420;
const DEFAULT_W = 400;
const PANEL_RIGHT = 24;
const PANEL_BOTTOM = 156;

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [panelW, setPanelW] = useState(DEFAULT_W);
  const [panelTop, setPanelTop] = useState(24);
  const panelRef = useRef(null);
  const dragRef = useRef(null);

  const handleToggle = () => {
    if (isOpen) {
      setIsAnimating(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsAnimating(false);
      }, 250);
    } else {
      setIsOpen(true);
    }
  };

  // Escape key closes
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isOpen) handleToggle(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // --- Resize drag logic ---
  const startDrag = useCallback((e, mode) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = panelW;
    const startTop = panelTop;
    dragRef.current = { startX, startY, startW, startTop, mode };

    const onMove = (ev) => {
      if (!dragRef.current) return;
      const { startX, startY, startW, startTop, mode } = dragRef.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const maxW = Math.min(MAX_W, window.innerWidth - PANEL_RIGHT - 24);

      if (mode === 'left' || mode === 'top-left') {
        // dragging left edge → wider when moving left (negative dx)
        const newW = Math.max(MIN_W, Math.min(maxW, startW - dx));
        setPanelW(newW);
      }
      if (mode === 'top' || mode === 'top-left') {
        const newTop = Math.max(16, Math.min(startTop + dy, window.innerHeight - PANEL_BOTTOM - MIN_H));
        setPanelTop(newTop);
      }
    };

    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelW, panelTop]);

  return (
    <>
      {/* ═══ Expanded Chat Panel ═══ */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            bottom: PANEL_BOTTOM,
            right: PANEL_RIGHT,
            top: panelTop,
            width: panelW,
            maxWidth: 'calc(100vw - 48px)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 24,
            overflow: 'visible',
            boxShadow: '0 25px 60px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.12)',
            border: '1px solid rgba(255,255,255,0.1)',
            animation: isAnimating
              ? 'chatPanelOut 0.25s ease forwards'
              : 'chatPanelIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* ── Resize handle: left edge ── */}
          <div
            onMouseDown={(e) => startDrag(e, 'left')}
            style={{
              position: 'absolute', left: -4, top: 40, bottom: 40,
              width: 8, cursor: 'ew-resize', zIndex: 60,
            }}
          />
          {/* ── Resize handle: top edge ── */}
          <div
            onMouseDown={(e) => startDrag(e, 'top')}
            style={{
              position: 'absolute', top: -4, left: 40, right: 40,
              height: 8, cursor: 'ns-resize', zIndex: 60,
            }}
          />
          {/* ── Resize handle: top-left corner ── */}
          <div
            onMouseDown={(e) => startDrag(e, 'top-left')}
            style={{
              position: 'absolute', left: -4, top: -4,
              width: 20, height: 20, cursor: 'nwse-resize', zIndex: 61,
            }}
          />

          {/* Inner wrapper clips content to rounded corners */}
          <div style={{
            display: 'flex', flexDirection: 'column', flex: 1,
            borderRadius: 24, overflow: 'hidden', minHeight: 0,
          }}>
            {/* ── Header (Navy) ── */}
            <div
              style={{
                flexShrink: 0,
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #020617 100%)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src="/chatbot-icon.gif"
                  alt="LumoPack"
                  style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: '50%' }}
                />
                <div>
                  <div style={{
                    fontSize: 16, fontWeight: 700, color: '#fff',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    letterSpacing: '-0.01em',
                  }}>LumoPack Assistant</div>
                  <div style={{
                    fontSize: 12, color: 'rgba(255,255,255,0.5)',
                    fontFamily: "'Sarabun', sans-serif",
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginTop: 2,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#22c55e', display: 'inline-block',
                      boxShadow: '0 0 6px rgba(34,197,94,0.5)',
                    }} />
                    ออนไลน์ — พร้อมช่วยออกแบบ
                  </div>
                </div>
              </div>

              <button
                onClick={handleToggle}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.6)', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Chat content ── */}
            <div style={{ flex: 1, minHeight: 0, background: '#fff' }}>
              <ChatWindow />
            </div>

            {/* ── Footer branding ── */}
            <div style={{
              flexShrink: 0, background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '8px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 10, color: '#cbd5e1', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Powered by
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                LumoPack AI
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bubble Button (80px) ═══ */}
      <button
        onClick={handleToggle}
        style={{
          position: 'fixed',
          bottom: 72,
          right: 24,
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          zIndex: 51,
          background: isOpen
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : '#ffffff',
          boxShadow: isOpen
            ? '0 8px 32px rgba(239,68,68,0.4), 0 2px 8px rgba(0,0,0,0.1)'
            : '0 8px 32px rgba(0,0,0,0.12), 0 2px 12px rgba(30,41,59,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {isOpen ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <img
            src="/chatbot-icon.gif"
            alt="LumoPack"
            style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: '50%' }}
          />
        )}
      </button>

      {/* ── Pulse ring ── */}
      {!isOpen && (
        <div style={{
          position: 'fixed', bottom: 72, right: 24,
          width: 80, height: 80, borderRadius: '50%',
          zIndex: 50, pointerEvents: 'none',
          border: '2px solid rgba(30,41,59,0.2)',
          animation: 'chatPulse 2s ease-in-out infinite',
        }} />
      )}

      <style>{`
        @keyframes chatPanelIn {
          from { opacity: 0; transform: translateY(24px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatPanelOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(24px) scale(0.92); }
        }
        @keyframes chatPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%      { transform: scale(1.15); opacity: 0; }
        }
      `}</style>
    </>
  );
}
