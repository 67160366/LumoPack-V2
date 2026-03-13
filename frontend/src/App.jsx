/**
 * App.jsx LumoPack Studio (Responsive 3-Panel Layout + Routing)
 *
 * Routes:
 * /              → Studio (3-panel layout)
 * /login         → Login
 * /register      → Register
 * /checkout      → Checkout (protected)
 * /projects      → My Projects (protected)
 * /orders        → My Orders (protected)
 * /orders/:id    → Order Detail (protected)
 * /admin         → Admin Dashboard (protected + admin)
 */

import React, { useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ChatbotProvider, useChatbot } from './contexts/ChatbotContext';
import { useAuth } from './contexts/AuthContext';
import ChatWindow from './components/Chatbot/ChatWindow';
import StudioPanel from './components/Panels/StudioPanel';
import SummaryPanel from './components/Panels/SummaryPanel';
import BoxViewer from './components/Box3D/BoxViewer';
import DielineViewer from './components/Dieline/DielineViewer';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CheckoutPage from './pages/CheckoutPage';
import MyOrdersPage from './pages/MyOrdersPage';
import MyProjectsPage from './pages/MyProjectsPage';
import OrderDetailPage from './pages/OrderDetailPage';
import AdminDashboard from './pages/AdminDashboard';
import { createProject, updateProject } from './services/api';


// ===================================
// Protected Route Wrapper
// ===================================

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-panel-darker flex items-center justify-center">
      <div className="text-zinc-500 text-sm font-display">Loading...</div>
    </div>
  );
}


// ===================================
// Inner App Layout (3-panel Studio)
// ===================================

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- Old state (Studio panel) ---
  const [formData, setFormData] = useState({
    length: 20, width: 15, height: 10,
    weight: 5, flute_type: 'C',
  });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [boxType, setBoxType] = useState('rsc');

  // --- Active project tracking ---
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeProjectName, setActiveProjectName] = useState(null);
  const [saving, setSaving] = useState(false);

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState('studio');

  // --- Panel visibility (responsive) ---
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // --- Mobile view toggle ---
  const [mobileView, setMobileView] = useState('chat'); // 'chat' | '3d'

  // --- Center panel view mode ---
  const [centerView, setCenterView] = useState('3d'); // '3d' | 'dieline'

  // --- Auth ---
  const { user, profile, signOut } = useAuth();

  // --- Chatbot data (bridge) ---
  const { boxDimensions, hasChatbotDimensions, collectedData, chatbotAnalysis, isComplete } = useChatbot();

  // Sync chatbot analysis → StudioPanel analysis state
  React.useEffect(() => {
    if (chatbotAnalysis) setAnalysis(chatbotAnalysis);
  }, [chatbotAnalysis]);

  // Sync chatbot collected data → formData
  React.useEffect(() => {
    if (!collectedData) return;
    setFormData(prev => {
      const updates = {};
      if (collectedData.dimensions) {
        updates.length = collectedData.dimensions.length ?? prev.length;
        updates.width  = collectedData.dimensions.width  ?? prev.width;
        updates.height = collectedData.dimensions.height ?? prev.height;
      }
      if (collectedData.weight_kg != null) updates.weight     = collectedData.weight_kg;
      if (collectedData.flute_type)        updates.flute_type = collectedData.flute_type;

      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
  }, [collectedData?.dimensions, collectedData?.weight_kg, collectedData?.flute_type]);

  // Sync chatbot box_type → boxType state
  React.useEffect(() => {
    if (collectedData?.box_type) {
      setBoxType(collectedData.box_type);
    }
  }, [collectedData?.box_type]);

  // --- Load project from navigation state ---
  React.useEffect(() => {
    const proj = location.state?.loadProject;
    if (!proj) return;
    // Clear navigation state to prevent re-loading on re-render
    window.history.replaceState({}, '');

    setActiveProjectId(proj.id);
    setActiveProjectName(proj.name);

    if (proj.box_type) setBoxType(proj.box_type);
    if (proj.dimensions) {
      setFormData(prev => ({
        ...prev,
        length: proj.dimensions.length ?? prev.length,
        width: proj.dimensions.width ?? prev.width,
        height: proj.dimensions.height ?? prev.height,
        weight: proj.weight_kg ?? prev.weight,
        flute_type: proj.flute_type ?? prev.flute_type,
      }));
    } else {
      if (proj.weight_kg != null) setFormData(prev => ({ ...prev, weight: proj.weight_kg }));
      if (proj.flute_type) setFormData(prev => ({ ...prev, flute_type: proj.flute_type }));
    }
  }, [location.state?.loadProject]);

  const displayDims = hasChatbotDimensions
    ? { width: boxDimensions.width, length: boxDimensions.length, height: boxDimensions.height }
    : { width: parseFloat(formData.width), length: parseFloat(formData.length), height: parseFloat(formData.height) };

  // --- Handlers ---
  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) setImage(URL.createObjectURL(file));
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          length: parseFloat(formData.length),
          width: parseFloat(formData.width),
          height: parseFloat(formData.height),
          weight: parseFloat(formData.weight),
          flute_type: formData.flute_type,
        }),
      });
      const data = await response.json();
      setAnalysis(data);
    } catch {
      alert('เชื่อมต่อ Backend ไม่ได้!');
    }
    setLoading(false);
  };

  const handleGeneratePDF = async () => {
    // Capture 3D canvas screenshot
    const threeCanvas = document.querySelector('canvas');
    const boxImgSrc = threeCanvas ? threeCanvas.toDataURL('image/png') : null;

    // Set box image src for the hidden template
    const boxImgEl = document.getElementById('pdf-box-img');
    if (boxImgEl && boxImgSrc) boxImgEl.src = boxImgSrc;

    // Show hidden PDF template
    const pdfEl = document.getElementById('pdf-content');
    if (!pdfEl) return;
    pdfEl.style.display = 'block';

    try {
      const canvas = await html2canvas(pdfEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 210; // A4 mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const doc = new jsPDF({
        orientation: pdfHeight > 297 ? 'portrait' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 297));

      // If content overflows one page, add extra pages
      if (pdfHeight > 297) {
        let remainingHeight = pdfHeight;
        let position = -297;
        while (remainingHeight > 297) {
          doc.addPage();
          doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          remainingHeight -= 297;
          position -= 297;
        }
      }

      doc.save('LumoPack_Quotation.pdf');
    } finally {
      pdfEl.style.display = 'none';
    }
  };

  const handleCheckout = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/checkout', { state: { collectedData } });
  };

  // --- Save Project ---
  const handleSaveProject = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setSaving(true);
    try {
      const projectData = {
        box_type: boxType,
        dimensions: {
          length: parseFloat(formData.length),
          width: parseFloat(formData.width),
          height: parseFloat(formData.height),
        },
        weight_kg: parseFloat(formData.weight) || null,
        flute_type: formData.flute_type,
        material: collectedData?.material || null,
        quantity: collectedData?.quantity || null,
        product_type: collectedData?.product_type || null,
        mood_tone: collectedData?.mood_tone || null,
        has_logo: collectedData?.has_logo || false,
        logo_positions: collectedData?.logo_positions || null,
        inner_materials: collectedData?.inner || null,
        special_effects: collectedData?.special_effects || null,
        collected_data: collectedData || null,
        pricing: collectedData?.pricing || null,
        grand_total: collectedData?.pricing?.grand_total || null,
      };

      if (activeProjectId) {
        // Update existing
        const updated = await updateProject(activeProjectId, projectData);
        setActiveProjectName(updated.name);
      } else {
        // Create new — prompt for name
        const name = prompt('ตั้งชื่อโปรเจค:', `โปรเจค ${new Date().toLocaleDateString('th-TH')}`);
        if (!name) { setSaving(false); return; }
        const created = await createProject({ name, ...projectData });
        setActiveProjectId(created.id);
        setActiveProjectName(created.name);
      }
    } catch {
      alert('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const isDanger = analysis?.status === 'DANGER';

  // --- PDF data helpers ---
  const pdfDims = collectedData?.dimensions || {
    length: formData.length, width: formData.width, height: formData.height,
  };
  const pdfPricing = collectedData?.pricing;
  const pdfGrandTotal = pdfPricing?.grand_total ?? (parseFloat(formData.length) * parseFloat(formData.width) * parseFloat(formData.height) * 0.005);

  return (
    <div className="flex w-screen h-screen bg-panel-darker overflow-hidden">

      {/* ===== HIDDEN PDF TEMPLATE ===== */}
      <div
        id="pdf-content"
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '794px', // A4 at 96dpi
          background: '#ffffff',
          fontFamily: "'Sarabun', sans-serif",
          color: '#1a1a1a',
          padding: '40px',
          zIndex: -9999,
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '2px solid #e5e5e5', paddingBottom: '16px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            LumoPack Quotation
          </h1>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
            Generated on: {new Date().toLocaleString('th-TH')}
          </p>
        </div>

        {/* Section 1: Product Specifications */}
        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              1. Product Specifications
            </h2>
            <table style={{ fontSize: '13px', lineHeight: '1.8', borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {collectedData?.product_type && (
                  <tr><td style={{ color: '#666', paddingRight: '16px' }}>ประเภทสินค้า</td><td style={{ fontWeight: 600 }}>{collectedData.product_type}</td></tr>
                )}
                {(collectedData?.box_type || boxType) && (
                  <tr><td style={{ color: '#666', paddingRight: '16px' }}>ประเภทกล่อง</td><td style={{ fontWeight: 600 }}>{collectedData?.box_type || boxType}</td></tr>
                )}
                {collectedData?.material && (
                  <tr><td style={{ color: '#666', paddingRight: '16px' }}>วัสดุ</td><td style={{ fontWeight: 600 }}>{collectedData.material}</td></tr>
                )}
                <tr><td style={{ color: '#666', paddingRight: '16px' }}>ขนาด</td><td style={{ fontWeight: 600 }}>{pdfDims.length} x {pdfDims.width} x {pdfDims.height} cm</td></tr>
                {collectedData?.quantity && (
                  <tr><td style={{ color: '#666', paddingRight: '16px' }}>จำนวน</td><td style={{ fontWeight: 600 }}>{collectedData.quantity.toLocaleString()} ชิ้น</td></tr>
                )}
                <tr><td style={{ color: '#666', paddingRight: '16px' }}>ลอน (Flute)</td><td style={{ fontWeight: 600 }}>{collectedData?.flute_type || formData.flute_type}</td></tr>
                {collectedData?.weight_kg != null && (
                  <tr><td style={{ color: '#666', paddingRight: '16px' }}>น้ำหนักรับได้</td><td style={{ fontWeight: 600 }}>{collectedData.weight_kg} kg</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* 3D Box Screenshot */}
          <div style={{ width: '200px', flexShrink: 0 }}>
            <img id="pdf-box-img" alt="3D Box" style={{ width: '100%', borderRadius: '8px', background: '#1a1a2e' }} />
          </div>
        </div>

        {/* Section 2: AI Engineering Analysis */}
        {analysis && (
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f8f8f8', borderRadius: '8px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              2. AI Engineering Analysis
            </h2>
            <p style={{
              fontSize: '14px', fontWeight: 700, marginBottom: '8px',
              color: analysis.status === 'DANGER' ? '#dc3545' : '#28a745',
            }}>
              STATUS: {analysis.status}
            </p>
            <table style={{ fontSize: '13px', lineHeight: '1.8' }}>
              <tbody>
                <tr><td style={{ color: '#666', paddingRight: '16px' }}>Safety Score</td><td style={{ fontWeight: 600 }}>{analysis.safety_score} / 100</td></tr>
                <tr><td style={{ color: '#666', paddingRight: '16px' }}>Max Load Capacity</td><td style={{ fontWeight: 600 }}>{analysis.max_load_kg} kg</td></tr>
              </tbody>
            </table>
            {analysis.recommendation && (
              <p style={{ fontSize: '12px', color: '#555', marginTop: '8px', fontStyle: 'italic' }}>
                NOTE: {analysis.recommendation}
              </p>
            )}
          </div>
        )}

        {/* Section 3: Pricing */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            3. Pricing
          </h2>
          {pdfPricing ? (
            <table style={{ fontSize: '13px', lineHeight: '2', width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {pdfPricing.box_base != null && (
                  <tr>
                    <td style={{ color: '#666' }}>ค่ากล่อง</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {typeof pdfPricing.box_base === 'object' ? `฿${pdfPricing.box_base.total_price?.toLocaleString()}` : `฿${pdfPricing.box_base.toLocaleString()}`}
                    </td>
                  </tr>
                )}
                {pdfPricing.inner != null && (typeof pdfPricing.inner === 'object' ? pdfPricing.inner.total_price > 0 : pdfPricing.inner > 0) && (
                  <tr>
                    <td style={{ color: '#666' }}>Inner</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {typeof pdfPricing.inner === 'object' ? `฿${pdfPricing.inner.total_price?.toLocaleString()}` : `฿${pdfPricing.inner.toLocaleString()}`}
                    </td>
                  </tr>
                )}
                {Array.isArray(pdfPricing.coatings) && pdfPricing.coatings.map((c, i) => (
                  <tr key={`coat-${i}`}>
                    <td style={{ color: '#666' }}>{c.name || 'Coating'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>฿{c.total_price?.toLocaleString()}</td>
                  </tr>
                ))}
                {Array.isArray(pdfPricing.stampings) && pdfPricing.stampings.map((s, i) => (
                  <tr key={`stamp-${i}`}>
                    <td style={{ color: '#666' }}>{s.name || 'Stamping'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>฿{s.total?.toLocaleString()}</td>
                  </tr>
                ))}
                <tr><td colSpan={2}><hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '4px 0' }} /></td></tr>
                <tr>
                  <td style={{ color: '#666' }}>Subtotal</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>฿{pdfPricing.subtotal?.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style={{ color: '#666' }}>VAT 7%</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>฿{pdfPricing.vat?.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: '13px', color: '#888' }}>ยังไม่มีข้อมูลราคาจาก Chatbot</p>
          )}
        </div>

        {/* Grand Total */}
        <div style={{
          borderTop: '2px solid #1a1a1a',
          paddingTop: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>Total Estimated Price:</span>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#0056b3' }}>
            THB {pdfGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* ===== LEFT PANEL (Tabs: Studio | Summary) ===== */}
      <div
        className={`
          flex-shrink-0 flex-col border-r border-panel-border bg-panel-dark
          transition-all duration-300 ease-in-out overflow-hidden
          ${leftPanelOpen
            ? 'w-[22vw] min-w-[260px] max-w-[360px] flex'
            : 'w-0 min-w-0 max-w-0 border-r-0 hidden'
          }
          max-md:hidden
        `}
      >
        {/* Logo + Title + Auth */}
        <div className="flex-shrink-0 border-b border-panel-border flex items-center justify-between" style={{ padding: '12px 24px' }}>
          <h1 className="font-display font-bold text-base">
            <span className="text-gradient-lumo">LumoPack</span>
            <span className="text-zinc-500 text-xs font-normal ml-1.5">Studio</span>
          </h1>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/projects"
                  className="text-[10px] text-zinc-500 hover:text-lumo-400 transition-colors"
                  title="My Projects"
                >
                  Projects
                </Link>
                <Link
                  to="/orders"
                  className="text-[10px] text-zinc-500 hover:text-lumo-400 transition-colors"
                  title="My Orders"
                >
                  Orders
                </Link>
                {profile?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="text-[10px] text-zinc-500 hover:text-lumo-400 transition-colors"
                    title="Admin"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={signOut}
                  className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-[10px] text-lumo-400 hover:text-lumo-300 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex-shrink-0 flex border-b border-panel-border">
          <button
            onClick={() => setActiveTab('studio')}
            className={`
              flex-1 py-2.5 text-xs font-display font-medium transition-colors relative
              ${activeTab === 'studio'
                ? 'text-lumo-400 tab-active'
                : 'text-zinc-500 hover:text-zinc-300'
              }
            `}
          >
            Studio
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`
              flex-1 py-2.5 text-xs font-display font-medium transition-colors relative
              ${activeTab === 'summary'
                ? 'text-lumo-400 tab-active'
                : 'text-zinc-500 hover:text-zinc-300'
              }
            `}
          >
            Summary
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'studio' ? (
            <StudioPanel
              formData={formData}
              onFormChange={handleFormChange}
              analysis={analysis}
              onAnalyze={handleAnalyze}
              loading={loading}
              image={image}
              onImageUpload={handleImageUpload}
              onGeneratePDF={handleGeneratePDF}
              boxType={boxType}
              onBoxTypeChange={(e) => setBoxType(e.target.value)}
            />
          ) : (
            <SummaryPanel />
          )}
        </div>

        {/* Save Project + Checkout */}
        <div className="flex-shrink-0 border-t border-panel-border p-4 space-y-2">
          {/* Active project indicator */}
          {activeProjectName && (
            <div className="text-[10px] text-zinc-500 font-mono truncate mb-1">
              Project: <span className="text-lumo-400">{activeProjectName}</span>
            </div>
          )}

          {/* Save project button */}
          <button
            onClick={handleSaveProject}
            disabled={saving}
            className="w-full py-2.5 rounded-xl border border-panel-border hover:border-lumo-400/40 text-zinc-300 hover:text-lumo-400 text-xs font-display font-semibold transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving...' : activeProjectId ? 'Save Project' : 'Save as Project'}
          </button>

          {/* Checkout Button (visible when chatbot is complete) */}
          {isComplete && collectedData?.pricing && (
            <button
              onClick={handleCheckout}
              className="w-full py-3 rounded-xl bg-lumo-400 hover:bg-lumo-300 text-panel-darker text-sm font-display font-semibold transition-colors active:scale-[0.98]"
            >
              Checkout — ฿{collectedData.pricing.grand_total?.toLocaleString()}
            </button>
          )}
        </div>
      </div>

      {/* ===== CENTER: 3D BOX VIEWER ===== */}
      <div
        className={`
          flex-1 relative min-w-0
          max-md:absolute max-md:inset-0 max-md:z-0
          ${mobileView === '3d' ? 'max-md:block' : 'max-md:hidden md:block'}
        `}
      >
        {centerView === '3d' ? (
          <BoxViewer
            width={displayDims.length}
            height={displayDims.height}
            depth={displayDims.width}
            image={image}
            isDanger={isDanger}
            boxType={boxType}
          />
        ) : (
          <DielineViewer
            width={displayDims.length * 10}
            height={displayDims.height * 10}
            depth={displayDims.width * 10}
          />
        )}

        {/* View mode toggle (3D / 2D Dieline) */}
        <div className="absolute top-3 right-3 z-10 flex rounded-lg overflow-hidden border border-panel-border bg-panel-darker/80 backdrop-blur-sm">
          <button
            onClick={() => setCenterView('3d')}
            className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
              centerView === '3d' ? 'text-lumo-400 bg-panel-surface' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            3D
          </button>
          <button
            onClick={() => setCenterView('dieline')}
            className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
              centerView === 'dieline' ? 'text-lumo-400 bg-panel-surface' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            2D Dieline
          </button>
        </div>

        {/* Left panel toggle button */}
        <button
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className={`
            absolute top-3 left-3 z-10
            w-9 h-9 rounded-lg bg-panel-darker/80 backdrop-blur-sm
            border border-panel-border
            flex items-center justify-center
            text-zinc-400 hover:text-lumo-400 transition-colors
            text-sm
            max-md:hidden
          `}
          title={leftPanelOpen ? 'Hide Panel' : 'Show Panel'}
        >
          {leftPanelOpen ? '—' : '▶'}
        </button>
      </div>

      {/* ===== RIGHT PANEL: CHATBOT ===== */}
      <div
        className={`
          flex-shrink-0 border-l border-panel-border overflow-hidden
          w-[28vw] min-w-[320px] max-w-[420px]
          max-md:absolute max-md:inset-0 max-md:w-full max-md:max-w-none max-md:min-w-0 max-md:border-l-0 max-md:z-10
          ${mobileView === 'chat' ? 'max-md:block' : 'max-md:hidden md:block'}
        `}
      >
        <ChatWindow />
      </div>

      {/* ===== MOBILE TAB BAR ===== */}
      <div className="hidden max-md:flex absolute bottom-0 left-0 right-0 z-20 bg-panel-darker border-t border-panel-border">
        <button
          onClick={() => setMobileView('chat')}
          className={`
            flex-1 py-3 text-xs font-display font-medium transition-colors
            ${mobileView === 'chat' ? 'text-lumo-400 bg-panel-surface' : 'text-zinc-500'}
          `}
        >
          Chat
        </button>
        <button
          onClick={() => setMobileView('3d')}
          className={`
            flex-1 py-3 text-xs font-display font-medium transition-colors
            ${mobileView === '3d' ? 'text-lumo-400 bg-panel-surface' : 'text-zinc-500'}
          `}
        >
          3D Box
        </button>
      </div>

    </div>
  );
}


// ===================================
// Root App with Routes
// ===================================

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <ChatbotProvider><CheckoutPage /></ChatbotProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute><MyProjectsPage /></ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute><MyOrdersPage /></ProtectedRoute>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <ProtectedRoute><OrderDetailPage /></ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute><AdminDashboard /></AdminRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ChatbotProvider><AppLayout /></ChatbotProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
