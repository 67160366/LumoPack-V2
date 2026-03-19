/**
 * MyProjectsPage — รายการโปรเจคของผู้ใช้ (Light Purple Theme)
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const STATUS_LABELS = {
  draft: 'แบบร่าง',
  quoted: 'เสนอราคาแล้ว',
  ordered: 'สั่งผลิตแล้ว',
  archived: 'เก็บถาวร',
};

const STATUS_COLORS = {
  draft: 'text-purple-400 border-purple-200',
  quoted: 'text-amber-600 border-amber-200',
  ordered: 'text-emerald-600 border-emerald-200',
  archived: 'text-gray-400 border-gray-200',
};

const BOX_TYPE_LABELS = {
  rsc: 'RSC',
  die_cut: 'Die-cut',
  heart: 'Heart Box',
  star: 'Star Box',
  bear: 'Bear Box',
  circle: 'Circle Box',
  bow: 'Bow Box',
};

export default function MyProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!supabase || !user) { setLoading(false); return; }

    let cancelled = false;

    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (!cancelled) {
          if (err) throw err;
          setProjects(data || []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'โหลดโปรเจคไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timeout = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); setError('Connection timeout'); }
    }, 8000);

    load().then(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [user]);

  async function fetchProjects() {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('projects').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
      if (err) throw err;
      setProjects(data || []);
    } catch (err) {
      setError(err.message || 'โหลดโปรเจคไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !supabase || !user) return;
    setCreating(true);
    try {
      const { error: err } = await supabase.from('projects').insert({ user_id: user.id, name: newName.trim() });
      if (err) throw err;
      setNewName('');
      setShowCreate(false);
      await fetchProjects();
    } catch (err) {
      alert(`สร้างโปรเจคไม่สำเร็จ: ${err.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm('ต้องการลบโปรเจคนี้?')) return;
    if (!supabase) return;
    setDeletingId(id);
    try {
      const { error: err } = await supabase.from('projects').delete().eq('id', id);
      if (err) throw err;
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert('ลบไม่สำเร็จ');
    } finally {
      setDeletingId(null);
    }
  }

  function handleLoad(project) {
    navigate('/', { state: { loadProject: project } });
  }

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Header */}
      <div className="border-b border-purple-100 bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-8 sm:px-12 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-purple-700">My Projects</h1>
            <p className="text-purple-400 text-xs mt-0.5">จัดการโปรเจคออกแบบกล่อง</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-display font-semibold transition-colors duration-200 shadow-sm"
            >
              + สร้างโปรเจคใหม่
            </button>
            <Link to="/" className="text-xs text-purple-500 hover:text-purple-700 transition-colors">
              กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 sm:px-12 py-8">
        {/* Create dialog */}
        {showCreate && (
          <div className="mb-6 bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
            <h3 className="text-sm font-display font-semibold text-purple-700 mb-3">สร้างโปรเจคใหม่</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="ชื่อโปรเจค เช่น กล่องสินค้า A"
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-50/50 border border-purple-200 text-sm text-purple-900 placeholder:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors duration-200"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? '...' : 'สร้าง'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewName(''); }}
                className="px-3 py-2.5 rounded-xl border border-purple-200 text-purple-500 hover:text-purple-700 text-sm transition-colors duration-200"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Project list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button onClick={fetchProjects} className="text-sm text-purple-600 hover:text-purple-800 font-medium">ลองใหม่</button>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-purple-400 text-sm mb-4">ยังไม่มีโปรเจค</p>
            <button onClick={() => setShowCreate(true)} className="text-sm text-purple-600 hover:text-purple-800 font-medium">สร้างโปรเจคแรก →</button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-xl border border-purple-100 p-4 hover:border-purple-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-display font-semibold text-purple-800 truncate mr-3">
                    {project.name}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLORS[project.status] || 'text-purple-400'}`}>
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-purple-400 mb-3">
                  {project.box_type && <span>{BOX_TYPE_LABELS[project.box_type] || project.box_type}</span>}
                  {project.dimensions && (
                    <span>
                      {project.dimensions.length || project.dimensions.width} x{' '}
                      {project.dimensions.width || project.dimensions.length} x{' '}
                      {project.dimensions.height} cm
                    </span>
                  )}
                  {project.quantity && <span>{project.quantity.toLocaleString()} ชิ้น</span>}
                  {project.grand_total != null && (
                    <span className="text-purple-700 font-semibold">฿{project.grand_total.toLocaleString()}</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-400">
                    อัปเดต:{' '}
                    {new Date(project.updated_at).toLocaleDateString('th-TH', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLoad(project)}
                      className="px-3 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 text-xs font-semibold transition-colors border border-purple-200"
                    >
                      เปิดใน Studio
                    </button>
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      disabled={deletingId === project.id}
                      className="px-2 py-1 rounded-lg hover:bg-red-50 text-purple-400 hover:text-red-500 text-xs transition-colors disabled:opacity-50"
                    >
                      {deletingId === project.id ? '...' : 'ลบ'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
