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
import BoxViewer from './components/Box3D/BoxViewer';
import DielineViewer from './components/Dieline/DielineViewer';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CheckoutPage from './pages/CheckoutPage';
import MyOrdersPage from './pages/MyOrdersPage';
import MyProjectsPage from './pages/MyProjectsPage';
import OrderDetailPage from './pages/OrderDetailPage';
import AdminDashboard from './pages/AdminDashboard';
import ForgotpasswordPage from './pages/ForgotpasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { supabase } from './lib/supabase';


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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        <span className="text-purple-400 text-sm font-display">Loading...</span>
      </div>
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

  // --- Support design config ---
  const [supportConfig, setSupportConfig] = useState({
    wallHeight: 0.78,      // 0.4 – 0.95 (ratio of box height)
    holes: [
      { id: 1, type: 'circle', x: 0, y: 0, r: 2.5 },
    ],
  });

  // --- Active project tracking ---
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeProjectName, setActiveProjectName] = useState(null);
  const [saving, setSaving] = useState(false);

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

  // --- Save Project (via Supabase client directly) ---
  const handleSaveProject = async () => {
    if (!user || !supabase) {
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
        const { data, error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', activeProjectId)
          .select()
          .single();
        if (error) throw error;
        setActiveProjectName(data.name);
      } else {
        // Create new — prompt for name
        const name = prompt('ตั้งชื่อโปรเจค:', `โปรเจค ${new Date().toLocaleDateString('th-TH')}`);
        if (!name) { setSaving(false); return; }
        const { data, error } = await supabase
          .from('projects')
          .insert({ user_id: user.id, name, ...projectData })
          .select()
          .single();
        if (error) throw error;
        setActiveProjectId(data.id);
        setActiveProjectName(data.name);
      }
    } catch (err) {
      console.error('[SaveProject] error:', err);
      alert('บันทึกไม่สำเร็จ: ' + (err.message || ''));
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
    <div className="flex w-screen h-screen bg-gray-50 overflow-hidden">

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

      {/* ===== CENTER: 3D BOX VIEWER + FLOATING SIDEBAR ===== */}
      <div
        className={`
          flex-1 relative min-w-0
          max-md:absolute max-md:inset-0 max-md:z-0
          ${mobileView === '3d' ? 'max-md:block' : 'max-md:hidden md:block'}
        `}
      >
        {/* Floating icon-rail + flyout panel (overlaid on 3D) */}
        <div className="max-md:hidden">
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
            supportConfig={supportConfig}
            onSupportConfigChange={setSupportConfig}
            onSignOut={signOut}
            isComplete={isComplete}
            collectedData={collectedData}
            onCheckout={handleCheckout}
          />
        </div>

        {centerView === '3d' ? (
          <BoxViewer
            width={displayDims.length}
            height={displayDims.height}
            depth={displayDims.width}
            image={image}
            isDanger={isDanger}
            boxType={boxType}
            supportConfig={supportConfig}
          />
        ) : (
          <DielineViewer
            width={displayDims.length * 10}
            height={displayDims.height * 10}
            depth={displayDims.width * 10}
          />
        )}

        {/* View mode toggle (3D / 2D Dieline) */}
        <div className="absolute top-3 right-3 z-10 flex rounded-lg overflow-hidden border border-purple-200 bg-white/80 backdrop-blur-sm shadow-sm">
          <button
            onClick={() => setCenterView('3d')}
            className={`px-3 py-1.5 text-xs font-mono transition-colors ${
              centerView === '3d' ? 'text-purple-700 bg-purple-50' : 'text-purple-400 hover:text-purple-600'
            }`}
          >
            3D
          </button>
          <button
            onClick={() => setCenterView('dieline')}
            className={`px-3 py-1.5 text-xs font-mono transition-colors ${
              centerView === 'dieline' ? 'text-purple-700 bg-purple-50' : 'text-purple-400 hover:text-purple-600'
            }`}
          >
            2D Dieline
          </button>
        </div>

      </div>

      {/* ===== RIGHT PANEL: CHATBOT + PROJECT ===== */}
      <div
        className={`
          flex-shrink-0 border-l border-purple-100 overflow-hidden flex flex-col
          w-[28vw] min-w-[320px] max-w-[420px]
          max-md:absolute max-md:inset-0 max-md:w-full max-md:max-w-none max-md:min-w-0 max-md:border-l-0 max-md:z-10
          ${mobileView === 'chat' ? 'max-md:block' : 'max-md:hidden md:block'}
        `}
      >
        <div className="flex-1 min-h-0">
          <ChatWindow />
        </div>

        {/* Project save bar */}
        <div className="flex-shrink-0 border-t border-purple-100 bg-white px-4 py-3 space-y-1.5">
          {activeProjectName && (
            <div className="text-xs text-purple-400 font-mono truncate">
              Project: <span className="text-purple-700 font-semibold">{activeProjectName}</span>
            </div>
          )}
          <button
            onClick={handleSaveProject}
            disabled={saving}
            className="w-full py-2.5 rounded-xl border border-purple-200 hover:border-purple-400 text-purple-500 hover:text-purple-700 text-xs font-display font-semibold transition-colors duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : activeProjectId ? 'Save Project' : 'Save as Project'}
          </button>
        </div>
      </div>

      {/* ===== MOBILE TAB BAR ===== */}
      <div className="hidden max-md:flex absolute bottom-0 left-0 right-0 z-20 bg-white border-t border-purple-100 shadow-sm">
        <button
          onClick={() => setMobileView('chat')}
          className={`
            flex-1 py-3 text-xs font-display font-medium transition-colors
            ${mobileView === 'chat' ? 'text-purple-700 bg-purple-50' : 'text-purple-400'}
          `}
        >
          Chat
        </button>
        <button
          onClick={() => setMobileView('3d')}
          className={`
            flex-1 py-3 text-xs font-display font-medium transition-colors
            ${mobileView === '3d' ? 'text-purple-700 bg-purple-50' : 'text-purple-400'}
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
      <Route path="/forgot-password" element={<ForgotpasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
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
