/**
 * ForgotpasswordPage — Split-screen forgot password (Dark right panel)
 * Calls supabase.auth.resetPasswordForEmail() to send real reset email.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ForgotpasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'inherit', background: '#13131a' }}>

      {/* ===== Left — Visual ===== */}
      <div style={{ width: '50%', position: 'relative', display: 'none' }} className="hidden md:!block">
        {/* Logo */}
        <Link to="/" style={{ position: 'absolute', top: 28, left: 32, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src="/logo.png" alt="LumoPack" style={{ height: 100, width: 100, objectFit: 'contain' }} />
          <span style={{ color: '#fff', fontSize: 24, fontWeight: 700 }} className="font-display">LumoPack</span>
        </Link>

        {/* Back link */}
        <Link
          to="/"
          style={{ position: 'absolute', top: 28, right: 32, zIndex: 10, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', color: '#fff', padding: '12px 24px', borderRadius: 9999, fontSize: 14, textDecoration: 'none', transition: 'background 0.2s' }}
        >
          กลับหน้าหลัก
        </Link>

        {/* Gradient bg */}
        <div style={{ height: '100%', background: 'linear-gradient(135deg, #7c3aed, #4338ca, #6b21a8)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -64, left: -64, width: 256, height: 256, borderRadius: '50%', background: 'rgba(168,85,247,0.2)' }} />
          <div style={{ position: 'absolute', top: '33%', right: 0, width: 192, height: 192, borderRadius: '50%', background: 'rgba(129,140,248,0.1)' }} />
          <div style={{ position: 'absolute', bottom: -80, left: '25%', width: 224, height: 224, borderRadius: '50%', background: 'rgba(168,85,247,0.15)' }} />

          {/* Bottom text */}
          <div style={{ position: 'absolute', bottom: 64, left: 64, color: '#fff', zIndex: 10 }}>
            <h2 style={{ fontSize: 36, fontWeight: 600, marginBottom: 8 }} className="font-display">ออกแบบกล่อง,</h2>
            <h2 style={{ fontSize: 36, fontWeight: 600 }} className="font-display">สร้างแบรนด์ของคุณ</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <div style={{ width: 16, height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
              <div style={{ width: 16, height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
              <div style={{ width: 16, height: 4, background: '#fff', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Right — Form (Dark) ===== */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', background: '#13131a' }} className="md:!w-1/2">

        <div style={{ maxWidth: 460, width: '100%' }}>

          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: '#fff' }} className="font-display">ลืมรหัสผ่าน</h1>
          <p style={{ fontSize: 14, marginBottom: 40, color: '#9ca3af' }}>
            กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
          </p>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12, fontSize: 14, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Email */}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                style={{ width: '100%', background: '#1c1c26', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '16px 20px', fontSize: 14, outline: 'none' }}
              />

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', background: loading ? 'rgba(124,58,237,0.4)' : '#7c3aed', color: '#fff', borderRadius: 12, padding: '16px 0', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, transition: 'background 0.2s' }}
              >
                {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}
              </button>

            </form>
          ) : (
            <div style={{ padding: '32px 0' }}>
              <div style={{ margin: '0 auto 20px', width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: 28, height: 28, color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4, textAlign: 'center' }}>ส่งลิงก์เรียบร้อยแล้ว</p>
              <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center' }}>
                ตรวจสอบอีเมล <span style={{ fontWeight: 500, color: '#fff' }}>{email}</span> เพื่อรีเซ็ตรหัสผ่าน
              </p>
            </div>
          )}

          {/* Back to login */}
          <div style={{ marginTop: 48 }}>
            <Link to="/login" style={{ color: '#a855f7', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              ← กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
