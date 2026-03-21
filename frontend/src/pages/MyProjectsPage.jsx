/**
 * MyProjectsPage — รายการโปรเจคของผู้ใช้ (Gray/Purple theme — matches HomePage)
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000`;

const STATUS_CFG = {
  draft:         { label: 'แบบร่าง',       bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  quoted:        { label: 'เสนอราคาแล้ว',  bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
  ordered:       { label: 'สั่งผลิตแล้ว',  bg: '#ecfdf5', color: '#047857', dot: '#10b981' },
  slip_uploaded: { label: 'แนบสลิปแล้ว',   bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
  archived:      { label: 'เก็บถาวร',      bg: '#f9fafb', color: '#9ca3af', dot: '#d1d5db' },
};

const BOX_TYPE_LABELS = {
  rsc: 'RSC', die_cut: 'Die-cut', heart: 'Heart Box', star: 'Star Box',
  bear: 'Bear Box', circle: 'Circle Box', bow: 'Bow Box',
  self_lock: 'Self-Lock', tube_lock: 'Tube Lock',
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
          .from('projects').select('*').eq('user_id', user.id)
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
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase
        .from('projects').select('*').eq('user_id', user.id)
        .order('updated_at', { ascending: false });
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
      setNewName(''); setShowCreate(false);
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
    // Navigate to the correct box test page based on box_type
    const BOX_ROUTES = {
      rsc: '/rsc-test',
      die_cut: '/dieline-test',
      tube_lock: '/tube-lock-test',
      heart: '/heart-box-test',
      self_lock: '/self-lock-test',
    };
    const route = BOX_ROUTES[project.box_type] || '/';
    navigate(route, { state: { loadProject: project } });
  }

  const jk = "'Plus Jakarta Sans', sans-serif";
  const sb = "'Sarabun', sans-serif";

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>

      {/* ═══ Header ═══ */}
      <div style={{
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: '#fff',
      }}>
        <div style={{
          maxWidth: 820, margin: '0 auto',
          padding: '20px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img src="/logo.png" alt="LP" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </Link>
            <div>
              <h1 style={{
                fontSize: 18, fontWeight: 800, color: '#111827', margin: 0,
                fontFamily: jk, letterSpacing: '-0.02em',
              }}>My Projects</h1>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, fontFamily: sb }}>
                จัดการโปรเจคออกแบบกล่อง
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '10px 20px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: jk,
                boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,58,237,0.35)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,58,237,0.25)'; }}
            >
              + สร้างโปรเจคใหม่
            </button>
            <Link
              to="/"
              style={{
                fontSize: 13, color: '#6b7280', textDecoration: 'none',
                fontFamily: jk, fontWeight: 600,
                padding: '10px 16px', borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.08)', background: '#fff',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = '#6b7280'; }}
            >
              กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 32px 60px' }}>

        {/* Create dialog */}
        {showCreate && (
          <div style={{
            marginBottom: 24, background: '#fff', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.08)', padding: '20px 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{
              fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 14px',
              fontFamily: jk,
            }}>สร้างโปรเจคใหม่</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="ชื่อโปรเจค เช่น กล่องสินค้า A"
                autoFocus
                style={{
                  flex: 1, padding: '11px 16px', borderRadius: 12,
                  fontSize: 13, fontFamily: sb, color: '#111827',
                  border: '1px solid rgba(0,0,0,0.1)', background: '#f9fafb',
                  outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#7c3aed'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                style={{
                  padding: '11px 22px', borderRadius: 12, border: 'none',
                  background: creating || !newName.trim() ? '#e5e7eb' : '#7c3aed',
                  color: creating || !newName.trim() ? '#9ca3af' : '#fff',
                  fontSize: 13, fontWeight: 700, fontFamily: jk,
                  cursor: creating || !newName.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? '...' : 'สร้าง'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewName(''); }}
                style={{
                  padding: '11px 18px', borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.1)', background: '#fff',
                  color: '#6b7280', fontSize: 13, fontWeight: 600,
                  fontFamily: jk, cursor: 'pointer',
                }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid #ede9fe', borderTopColor: '#7c3aed',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: 14, color: '#ef4444', marginBottom: 12, fontFamily: sb }}>{error}</p>
            <button
              onClick={fetchProjects}
              style={{
                fontSize: 13, color: '#7c3aed', background: 'none', border: 'none',
                cursor: 'pointer', fontWeight: 600, fontFamily: jk,
              }}
            >
              ลองใหม่
            </button>
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: '#f3f4f6', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            </div>
            <p style={{
              fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 6px',
              fontFamily: jk,
            }}>ยังไม่มีโปรเจค</p>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px', fontFamily: sb }}>
              เริ่มสร้างโปรเจคแรกของคุณ
            </p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '12px 28px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: jk,
                boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
              }}
            >
              สร้างโปรเจคแรก
            </button>
          </div>
        ) : (
          /* Project list */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onLoad={handleLoad}
                onDelete={handleDelete}
                deletingId={deletingId}
                onSlipUploaded={fetchProjects}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function ProjectCard({ project, onLoad, onDelete, deletingId, onSlipUploaded }) {
  const [hovered, setHovered] = useState(false);
  const [uploading, setUploading] = useState(false);
  const slipInputRef = useRef(null);
  const status = STATUS_CFG[project.status] || STATUS_CFG.draft;
  const jk = "'Plus Jakarta Sans', sans-serif";
  const sb = "'Sarabun', sans-serif";

  const handleDownloadPdf = (e) => {
    e.stopPropagation();
    window.open(`${API_BASE}/api/pricing/project-quote-pdf/${project.id}`, '_blank');
  };

  const handleUploadSlip = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('project_id', project.id);
      formData.append('slip', file);
      const token = (await supabase?.auth.getSession())?.data?.session?.access_token;
      const res = await fetch(`${API_BASE}/api/payments/upload-slip`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }
      alert('อัพโหลดสลิปสำเร็จ');
      if (onSlipUploaded) onSlipUploaded();
    } catch (err) {
      alert(`อัพโหลดไม่สำเร็จ: ${err.message}`);
    } finally {
      setUploading(false);
      if (slipInputRef.current) slipInputRef.current.value = '';
    }
  };

  const hasPricing = project.grand_total != null || project.pricing;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 16,
        border: hovered ? '1px solid #c4b5fd' : '1px solid rgba(0,0,0,0.06)',
        padding: '18px 22px',
        boxShadow: hovered
          ? '0 8px 24px rgba(124,58,237,0.1)'
          : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Row 1: Name + Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{
          fontSize: 15, fontWeight: 700, color: '#111827', margin: 0,
          fontFamily: jk, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 'calc(100% - 120px)',
        }}>
          {project.name}
        </h3>
        <span style={{
          fontSize: 11, fontWeight: 600, fontFamily: jk,
          padding: '4px 10px', borderRadius: 20,
          background: status.bg, color: status.color,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          flexShrink: 0,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: status.dot,
            display: 'inline-block',
          }} />
          {status.label}
        </span>
      </div>

      {/* Row 2: Meta chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {project.box_type && (
          <MetaChip>{BOX_TYPE_LABELS[project.box_type] || project.box_type}</MetaChip>
        )}
        {project.dimensions && (
          <MetaChip>
            {project.dimensions.length || project.dimensions.width} x{' '}
            {project.dimensions.width || project.dimensions.length} x{' '}
            {project.dimensions.height} cm
          </MetaChip>
        )}
        {project.quantity && (
          <MetaChip>{project.quantity.toLocaleString()} ชิ้น</MetaChip>
        )}
        {project.grand_total != null && (
          <span style={{
            fontSize: 12, fontWeight: 700, color: '#7c3aed', fontFamily: jk,
          }}>
            ฿{project.grand_total.toLocaleString()}
          </span>
        )}
        {project.slip_url && (
          <MetaChip style={{ background: '#ecfdf5', color: '#047857' }}>สลิปแนบแล้ว</MetaChip>
        )}
      </div>

      {/* Row 3: Date + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: sb }}>
          อัปเดต{' '}
          {new Date(project.updated_at).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ActionButton onClick={() => onLoad(project)} primary>
            เปิดใน Studio
          </ActionButton>
          {hasPricing && (
            <ActionButton onClick={handleDownloadPdf}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                ใบเสนอราคา
              </span>
            </ActionButton>
          )}
          <ActionButton
            onClick={(e) => { e.stopPropagation(); slipInputRef.current?.click(); }}
            disabled={uploading}
          >
            {uploading ? '...' : 'อัพสลิป'}
          </ActionButton>
          <input
            ref={slipInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleUploadSlip}
          />
          <ActionButton
            onClick={(e) => onDelete(project.id, e)}
            disabled={deletingId === project.id}
            danger
          >
            {deletingId === project.id ? '...' : 'ลบ'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}


function MetaChip({ children, style: overrides }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, color: '#6b7280',
      fontFamily: "'Sarabun', sans-serif",
      background: '#f3f4f6', borderRadius: 8,
      padding: '3px 10px',
      ...overrides,
    }}>
      {children}
    </span>
  );
}


function ActionButton({ children, onClick, primary, danger, disabled }) {
  const [hovered, setHovered] = useState(false);
  const jk = "'Plus Jakarta Sans', sans-serif";

  let bg, color, borderColor;
  if (primary) {
    bg = hovered ? '#7c3aed' : '#f5f3ff';
    color = hovered ? '#fff' : '#7c3aed';
    borderColor = hovered ? '#7c3aed' : '#ede9fe';
  } else if (danger) {
    bg = hovered ? '#fef2f2' : 'transparent';
    color = hovered ? '#ef4444' : '#9ca3af';
    borderColor = hovered ? '#fecaca' : 'transparent';
  } else {
    bg = '#f3f4f6';
    color = '#374151';
    borderColor = 'rgba(0,0,0,0.06)';
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 14px', borderRadius: 10,
        fontSize: 12, fontWeight: 600, fontFamily: jk,
        border: `1px solid ${borderColor}`,
        background: bg, color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
