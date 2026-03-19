/**
 * LoginPage — Split-screen login (White right panel)
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password, remember);
      navigate('/');
    } catch (err) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'inherit' }}>

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
              <div style={{ width: 16, height: 4, background: '#fff', borderRadius: 2 }} />
              <div style={{ width: 16, height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Right — Form (White) ===== */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', background: '#ffffff' }} className="md:!w-1/2">

        <div style={{ maxWidth: 460, width: '100%' }}>

          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: '#111827' }} className="font-display">เข้าสู่ระบบ</h1>
          <p style={{ fontSize: 14, marginBottom: 40, color: '#6b7280' }}>
            ยังไม่มีบัญชี?{' '}
            <Link to="/register" style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>สมัครสมาชิก</Link>
          </p>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12, fontSize: 14, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Email */}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              autoComplete="email"
              style={{ width: '100%', background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827', borderRadius: 12, padding: '16px 20px', fontSize: 14, outline: 'none' }}
            />

            {/* Password */}
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="รหัสผ่าน"
                autoComplete="current-password"
                style={{ width: '100%', background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827', borderRadius: 12, padding: '16px 20px', paddingRight: 48, fontSize: 14, outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <svg style={{ width: 20, height: 20 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ accentColor: '#7c3aed' }}
                />
                <span style={{ color: '#6b7280', fontSize: 14 }}>จดจำฉัน</span>
              </label>
              <Link to="/forgot-password" style={{ color: '#7c3aed', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
                ลืมรหัสผ่าน?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: loading ? 'rgba(124,58,237,0.4)' : '#7c3aed', color: '#fff', borderRadius: 12, padding: '16px 0', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, transition: 'background 0.2s' }}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>

          </form>
        </div>
      </div>

    </div>
  );
}
