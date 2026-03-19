/**
 * ResetPasswordPage — Set new password after clicking reset link from email.
 * Supabase redirects here with access token in URL hash.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err.message || 'ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'inherit', background: '#13131a' }}>

      {/* ===== Left — Visual ===== */}
      <div style={{ width: '50%', position: 'relative', display: 'none' }} className="hidden md:!block">
        <Link to="/" style={{ position: 'absolute', top: 28, left: 32, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src="/logo.png" alt="LumoPack" style={{ height: 100, width: 100, objectFit: 'contain' }} />
          <span style={{ color: '#fff', fontSize: 24, fontWeight: 700 }} className="font-display">LumoPack</span>
        </Link>

        <div style={{ height: '100%', background: 'linear-gradient(135deg, #7c3aed, #4338ca, #6b21a8)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -64, left: -64, width: 256, height: 256, borderRadius: '50%', background: 'rgba(168,85,247,0.2)' }} />
          <div style={{ position: 'absolute', top: '33%', right: 0, width: 192, height: 192, borderRadius: '50%', background: 'rgba(129,140,248,0.1)' }} />
          <div style={{ position: 'absolute', bottom: -80, left: '25%', width: 224, height: 224, borderRadius: '50%', background: 'rgba(168,85,247,0.15)' }} />

          <div style={{ position: 'absolute', bottom: 64, left: 64, color: '#fff', zIndex: 10 }}>
            <h2 style={{ fontSize: 36, fontWeight: 600, marginBottom: 8 }} className="font-display">ออกแบบกล่อง,</h2>
            <h2 style={{ fontSize: 36, fontWeight: 600 }} className="font-display">สร้างแบรนด์ของคุณ</h2>
          </div>
        </div>
      </div>

      {/* ===== Right — Form (Dark) ===== */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', background: '#13131a' }} className="md:!w-1/2">

        <div style={{ maxWidth: 460, width: '100%' }}>

          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: '#fff' }} className="font-display">ตั้งรหัสผ่านใหม่</h1>
          <p style={{ fontSize: 14, marginBottom: 40, color: '#9ca3af' }}>
            กรอกรหัสผ่านใหม่ที่ต้องการ
          </p>

          {error && (
            <div style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12, fontSize: 14, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          {!success ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* New Password */}
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="รหัสผ่านใหม่ (6 ตัวขึ้นไป)"
                  autoComplete="new-password"
                  style={{ width: '100%', background: '#1c1c26', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '16px 20px', paddingRight: 48, fontSize: 14, outline: 'none' }}
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

              {/* Confirm Password */}
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="ยืนยันรหัสผ่านใหม่"
                autoComplete="new-password"
                style={{ width: '100%', background: '#1c1c26', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '16px 20px', fontSize: 14, outline: 'none' }}
              />

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', background: loading ? 'rgba(124,58,237,0.4)' : '#7c3aed', color: '#fff', borderRadius: 12, padding: '16px 0', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, transition: 'background 0.2s' }}
              >
                {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
              </button>

            </form>
          ) : (
            <div style={{ padding: '32px 0' }}>
              <div style={{ margin: '0 auto 20px', width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: 28, height: 28, color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4, textAlign: 'center' }}>เปลี่ยนรหัสผ่านสำเร็จ</p>
              <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center' }}>
                กำลังพาคุณไปหน้าหลัก...
              </p>
            </div>
          )}

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
