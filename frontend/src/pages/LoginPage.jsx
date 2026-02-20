/**
 * LoginPage — Email + Password login
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
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
          <p className="text-zinc-500 text-sm mt-1">เข้าสู่ระบบ</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-panel-dark rounded-2xl border border-panel-border p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-800/40 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-panel-darker border border-panel-border rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-lumo-400/50"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-panel-darker border border-panel-border rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-lumo-400/50"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-lumo-400 hover:bg-lumo-300 text-panel-darker text-sm font-display font-semibold transition-colors disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {/* Register link */}
        <p className="text-center text-xs text-zinc-500 mt-4">
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" className="text-lumo-400 hover:text-lumo-300 transition-colors">
            สมัครสมาชิก
          </Link>
        </p>

        {/* Back to home */}
        <p className="text-center text-xs text-zinc-600 mt-2">
          <Link to="/" className="hover:text-zinc-400 transition-colors">
            กลับหน้าหลัก
          </Link>
        </p>
      </div>
    </div>
  );
}
