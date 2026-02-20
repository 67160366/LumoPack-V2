/**
 * RegisterPage — Email + Password signup with profile info
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    fullName: '', phone: '', company: '',
  });
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
      await signUp(form.email, form.password, form.fullName, form.phone, form.company);
      navigate('/');
    } catch (err) {
      setError(err.message || 'สมัครสมาชิกไม่สำเร็จ');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-panel-darker flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-2xl">
            <span className="text-gradient-lumo">LumoPack</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">สมัครสมาชิก</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-panel-dark rounded-2xl border border-panel-border p-6 space-y-3">
          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-800/40 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-400 mb-1">ชื่อ-นามสกุล *</label>
            <input
              type="text" name="fullName" value={form.fullName} onChange={handleChange} required
              className="w-full bg-panel-darker border border-panel-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-lumo-400/50"
              placeholder="สมชาย ใจดี"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Email *</label>
            <input
              type="email" name="email" value={form.email} onChange={handleChange} required
              className="w-full bg-panel-darker border border-panel-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-lumo-400/50"
              placeholder="email@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Password *</label>
              <input
                type="password" name="password" value={form.password} onChange={handleChange} required
                className="w-full bg-panel-darker border border-panel-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-lumo-400/50"
                placeholder="******"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">ยืนยัน *</label>
              <input
                type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required
                className="w-full bg-panel-darker border border-panel-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-lumo-400/50"
                placeholder="******"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">เบอร์โทร</label>
            <input
              type="tel" name="phone" value={form.phone} onChange={handleChange}
              className="w-full bg-panel-darker border border-panel-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-lumo-400/50"
              placeholder="0812345678"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">ชื่อบริษัท</label>
            <input
              type="text" name="company" value={form.company} onChange={handleChange}
              className="w-full bg-panel-darker border border-panel-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-lumo-400/50"
              placeholder="บริษัท ABC จำกัด"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-lumo-400 hover:bg-lumo-300 text-panel-darker text-sm font-display font-semibold transition-colors disabled:opacity-50 active:scale-[0.98] mt-2"
          >
            {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>
        </form>

        {/* Login link */}
        <p className="text-center text-xs text-zinc-500 mt-4">
          มีบัญชีอยู่แล้ว?{' '}
          <Link to="/login" className="text-lumo-400 hover:text-lumo-300 transition-colors">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
