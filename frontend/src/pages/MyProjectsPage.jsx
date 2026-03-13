/**
 * MyProjectsPage — รายการโปรเจคของผู้ใช้
 *
 * Features:
 * - สร้างโปรเจคใหม่
 * - ดูรายการโปรเจค
 * - ลบโปรเจค
 * - โหลดโปรเจคเข้า Studio
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listProjects, createProject, deleteProject } from '../services/api';

const STATUS_LABELS = {
  draft: 'แบบร่าง',
  quoted: 'เสนอราคาแล้ว',
  ordered: 'สั่งผลิตแล้ว',
  archived: 'เก็บถาวร',
};

const STATUS_COLORS = {
  draft: 'text-zinc-400 border-zinc-600',
  quoted: 'text-amber-400 border-amber-600',
  ordered: 'text-emerald-400 border-emerald-600',
  archived: 'text-zinc-500 border-zinc-700',
};

const BOX_TYPE_LABELS = {
  rsc: 'RSC',
  die_cut: 'Die-cut',
  tuck_end: 'ฝาชน',
  ear_lock: 'หูช้าง',
};

export default function MyProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchProjects();
  }, [user]);

  async function fetchProjects() {
    try {
      const data = await listProjects();
      setProjects(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createProject({ name: newName.trim() });
      setNewName('');
      setShowCreate(false);
      await fetchProjects();
    } catch {
      alert('สร้างโปรเจคไม่สำเร็จ');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm('ต้องการลบโปรเจคนี้?')) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
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
    <div className="min-h-screen bg-panel-darker">
      {/* Header */}
      <div className="border-b border-panel-border bg-panel-dark">
        <div className="max-w-3xl mx-auto px-8 sm:px-12 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-gradient-lumo">My Projects</h1>
            <p className="text-zinc-500 text-xs mt-0.5">จัดการโปรเจคออกแบบกล่อง</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 rounded-lg bg-lumo-400 hover:bg-lumo-300 text-panel-darker text-xs font-display font-semibold transition-colors"
            >
              + สร้างโปรเจคใหม่
            </button>
            <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 sm:px-12 py-8">
        {/* Create dialog */}
        {showCreate && (
          <div className="mb-6 bg-panel-dark rounded-xl border border-panel-border p-4">
            <h3 className="text-sm font-display font-semibold text-zinc-300 mb-3">สร้างโปรเจคใหม่</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="ชื่อโปรเจค เช่น กล่องสินค้า A"
                className="flex-1 px-3 py-2 rounded-lg bg-panel-darker border border-panel-border text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-lumo-400/50"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 rounded-lg bg-lumo-400 hover:bg-lumo-300 text-panel-darker text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {creating ? '...' : 'สร้าง'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewName(''); }}
                className="px-3 py-2 rounded-lg border border-panel-border text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Project list */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-zinc-500 text-sm">Loading...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">📁</div>
            <p className="text-zinc-400 text-sm mb-4">ยังไม่มีโปรเจค</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-lumo-400 hover:text-lumo-300 text-sm"
            >
              สร้างโปรเจคแรก
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-panel-dark rounded-xl border border-panel-border p-4 hover:border-lumo-400/30 transition-colors"
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-display font-semibold text-zinc-200 truncate mr-3">
                    {project.name}
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLORS[project.status] || 'text-zinc-400'}`}>
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                </div>

                {/* Info row */}
                <div className="flex items-center gap-3 text-[11px] text-zinc-500 mb-3">
                  {project.box_type && (
                    <span>{BOX_TYPE_LABELS[project.box_type] || project.box_type}</span>
                  )}
                  {project.dimensions && (
                    <span>
                      {project.dimensions.length || project.dimensions.width} x{' '}
                      {project.dimensions.width || project.dimensions.length} x{' '}
                      {project.dimensions.height} cm
                    </span>
                  )}
                  {project.quantity && (
                    <span>{project.quantity.toLocaleString()} ชิ้น</span>
                  )}
                  {project.grand_total != null && (
                    <span className="text-lumo-400 font-semibold">
                      ฿{project.grand_total.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Date + Actions */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600">
                    อัปเดต:{' '}
                    {new Date(project.updated_at).toLocaleDateString('th-TH', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLoad(project)}
                      className="px-3 py-1 rounded-lg bg-lumo-400/10 hover:bg-lumo-400/20 text-lumo-400 text-[11px] font-semibold transition-colors"
                    >
                      เปิดใน Studio
                    </button>
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      disabled={deletingId === project.id}
                      className="px-2 py-1 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 text-[11px] transition-colors disabled:opacity-50"
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
