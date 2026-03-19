/**
 * RegisterPage — Dark full-screen split register
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    fullName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setLoading(true);
    try {
      await signUp(form.email, form.password, form.fullName);
      navigate('/');
    } catch (err) {
      setError(err.message || 'สมัครสมาชิกไม่สำเร็จ');
    }
    setLoading(false);
  };

  return (
    <div className="bg-[#13131a] min-h-screen flex flex-col md:flex-row font-body">

      {/* ===== Left — Visual ===== */}
      <div className="w-full md:w-1/2 relative">
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
        <div className="h-[300px] md:h-full bg-gradient-to-br from-purple-700 via-indigo-800 to-purple-900 relative overflow-hidden">
          <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-purple-500/20" />
          <div className="absolute top-1/3 right-0 h-48 w-48 rounded-full bg-indigo-400/10" />
          <div className="absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-purple-400/15" />
          <div className="absolute inset-0 bg-purple-900/20" />

          {/* Bottom text */}
          <div className="absolute bottom-10 left-10 md:bottom-16 md:left-16 text-white z-10">
            <h2 className="text-2xl md:text-4xl font-semibold font-display mb-2">ออกแบบกล่อง,</h2>
            <h2 className="text-2xl md:text-4xl font-semibold font-display">สร้างแบรนด์ของคุณ</h2>
            <div className="flex gap-2 mt-6">
              <div className="w-4 h-1 bg-white/30 rounded" />
              <div className="w-4 h-1 bg-white/30 rounded" />
              <div className="w-4 h-1 bg-white rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Right — Form ===== */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center" style={{ padding: '48px 40px' }}>
        <div style={{ maxWidth: 460, width: '100%' }}>

          <h1 className="text-white font-bold font-display" style={{ fontSize: 32, marginBottom: 8 }}>สร้างบัญชีใหม่</h1>
          <p className="text-gray-400" style={{ fontSize: 14, marginBottom: 40 }}>
            มีบัญชีอยู่แล้ว?{' '}
            <Link to="/login" className="text-white font-semibold hover:underline">เข้าสู่ระบบ</Link>
          </p>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12, fontSize: 14, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Name */}
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              placeholder="ชื่อ-นามสกุล"
              autoComplete="name"
              style={{ width: '100%', background: '#1c1c26', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '16px 20px', fontSize: 14, outline: 'none' }}
            />

            {/* Email */}
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="Email"
              autoComplete="email"
              style={{ width: '100%', background: '#1c1c26', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '16px 20px', fontSize: 14, outline: 'none' }}
            />

            {/* Password */}
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="รหัสผ่าน (6 ตัวขึ้นไป)"
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
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              placeholder="ยืนยันรหัสผ่าน"
              autoComplete="new-password"
              style={{ width: '100%', background: '#1c1c26', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '16px 20px', fontSize: 14, outline: 'none' }}
            />

            {/* Terms */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ accentColor: '#7c3aed' }}
              />
              <span style={{ color: '#9ca3af', fontSize: 14 }}>
                ฉันยอมรับ{' '}
                <span style={{ color: '#fff', fontWeight: 600, cursor: 'pointer' }}>เงื่อนไขการใช้งาน</span>
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !agreed}
              style={{ width: '100%', background: loading || !agreed ? 'rgba(124,58,237,0.4)' : '#7c3aed', color: '#fff', borderRadius: 12, padding: '16px 0', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading || !agreed ? 'not-allowed' : 'pointer', marginTop: 8, transition: 'background 0.2s' }}
            >
              {loading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}
            </button>

          </form>
        </div>
      </div>

    </div>
  );
}
