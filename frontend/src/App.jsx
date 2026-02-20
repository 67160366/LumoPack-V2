/**
 * App.jsx LumoPack Studio (Responsive 3-Panel Layout + Routing)
 *
 * Routes:
 * /              → Studio (3-panel layout)
 * /login         → Login
 * /register      → Register
 * /checkout      → Checkout (protected)
 * /orders        → My Orders (protected)
 * /orders/:id    → Order Detail (protected)
 * /admin         → Admin Dashboard (protected + admin)
 */

import React, { useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { ChatbotProvider, useChatbot } from './contexts/ChatbotContext';
import { useAuth } from './contexts/AuthContext';
import ChatWindow from './components/Chatbot/ChatWindow';
import StudioPanel from './components/Panels/StudioPanel';
import SummaryPanel from './components/Panels/SummaryPanel';
import BoxViewer from './components/Box3D/BoxViewer';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CheckoutPage from './pages/CheckoutPage';
import MyOrdersPage from './pages/MyOrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import AdminDashboard from './pages/AdminDashboard';


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

  // --- Old state (Studio panel) ---
  const [formData, setFormData] = useState({
    length: 20, width: 15, height: 10,
    weight: 5, flute_type: 'C',
  });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [boxType, setBoxType] = useState('rsc');

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState('studio');

  // --- Panel visibility (responsive) ---
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // --- Mobile view toggle ---
  const [mobileView, setMobileView] = useState('chat'); // 'chat' | '3d'

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

  const handleGeneratePDF = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(22); doc.setTextColor(40, 40, 40);
    doc.text('LumoPack Quotation', 20, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
    doc.setDrawColor(200); doc.line(20, 35, pageWidth - 20, 35);

    doc.setFontSize(16); doc.setTextColor(0);
    doc.text('1. Product Specifications', 20, 50);
    doc.setFontSize(12); doc.setTextColor(60);
    doc.text(`- Dimensions: ${formData.length}x${formData.width}x${formData.height} cm`, 25, 60);
    doc.text(`- Material: Flute ${formData.flute_type}`, 25, 70);
    doc.text(`- Weight Load: ${formData.weight} kg`, 25, 80);

    doc.addImage(imgData, 'PNG', 110, 45, 80, 80);

    if (analysis) {
      doc.setFontSize(16); doc.setTextColor(0);
      doc.text('2. AI Engineering Analysis', 20, 140);
      if (analysis.status === 'DANGER') {
        doc.setTextColor(220, 53, 69); doc.setFont(undefined, 'bold');
      } else {
        doc.setTextColor(40, 167, 69); doc.setFont(undefined, 'bold');
      }
      doc.text(`STATUS: ${analysis.status}`, 25, 150);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60); doc.setFontSize(12);
      doc.text(`- Safety Score: ${analysis.safety_score} / 100`, 25, 160);
      doc.text(`- Max Load Capacity: ${analysis.max_load_kg} kg`, 25, 170);
      doc.setFont(undefined, 'italic');
      const recText = doc.splitTextToSize(`NOTE: ${analysis.recommendation}`, pageWidth - 40);
      doc.text(recText, 25, 180);
    }

    doc.setDrawColor(200); doc.line(20, 200, pageWidth - 20, 200);
    const price = (formData.length * formData.width * formData.height) * 0.005;
    doc.setFontSize(14); doc.setTextColor(100);
    doc.text('Total Estimated Price:', 20, 215);
    doc.setFontSize(24); doc.setTextColor(0, 86, 179);
    doc.setFont(undefined, 'bold');
    doc.text(`THB ${price.toFixed(2)}`, pageWidth - 20, 215, { align: 'right' });

    doc.save('LumoPack_Quotation.pdf');
  };

  const handleCheckout = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/checkout', { state: { collectedData } });
  };

  const isDanger = analysis?.status === 'DANGER';

  return (
    <div className="flex w-screen h-screen bg-panel-darker overflow-hidden">

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

        {/* Checkout Button (visible when chatbot is complete) */}
        {isComplete && collectedData?.pricing && (
          <div className="flex-shrink-0 border-t border-panel-border p-4">
            <button
              onClick={handleCheckout}
              className="w-full py-3 rounded-xl bg-lumo-400 hover:bg-lumo-300 text-panel-darker text-sm font-display font-semibold transition-colors active:scale-[0.98]"
            >
              Checkout — ฿{collectedData.pricing.grand_total?.toLocaleString()}
            </button>
          </div>
        )}
      </div>

      {/* ===== CENTER: 3D BOX VIEWER ===== */}
      <div
        className={`
          flex-1 relative min-w-0
          max-md:absolute max-md:inset-0 max-md:z-0
          ${mobileView === '3d' ? 'max-md:block' : 'max-md:hidden md:block'}
        `}
      >
        <BoxViewer
          width={displayDims.length}
          height={displayDims.height}
          depth={displayDims.width}
          image={image}
          isDanger={isDanger}
          boxType={boxType}
        />

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
          <ChatbotProvider><AppLayout /></ChatbotProvider>
        }
      />
    </Routes>
  );
}
