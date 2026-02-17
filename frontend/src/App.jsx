/**
 * App.jsx LumoPack Studio (Responsive 3-Panel Layout)
 * 
 * Breakpoints:
 * - Desktop  1280px : 3 panels — Left (tabs) | Center (3D) | Right (Chat)
 * - Laptop   1024px : Left panel collapsible, Chat + 3D
 * - Tablet   768px  : Left hidden, Chat + 3D side-by-side
 * - Mobile   <768px  : Tab toggle between Chat / 3D
 */

import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { ChatbotProvider, useChatbot } from './contexts/ChatbotContext';
import ChatWindow from './components/Chatbot/ChatWindow';
import StudioPanel from './components/Panels/StudioPanel';
import SummaryPanel from './components/Panels/SummaryPanel';
import BoxViewer from './components/Box3D/BoxViewer';


// ===================================
// Inner App (ใช้ Context ได้)
// ===================================

function AppLayout() {
  // --- Old state (Studio panel) ---
  const [formData, setFormData] = useState({
    length: 20, width: 15, height: 10,
    weight: 5, flute_type: 'C',
  });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState('studio');

  // --- Panel visibility (responsive) ---
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // --- Mobile view toggle ---
  const [mobileView, setMobileView] = useState('chat'); // 'chat' | '3d'

  // --- Chatbot data (bridge) ---
  const { boxDimensions, hasChatbotDimensions, collectedData, chatbotAnalysis } = useChatbot();

  // Sync chatbot analysis → StudioPanel analysis state (เมื่อ chatbot run analyze แล้ว)
  React.useEffect(() => {
    if (chatbotAnalysis) setAnalysis(chatbotAnalysis);
  }, [chatbotAnalysis]);

  // Sync chatbot collected data → formData ของ StudioPanel (dimensions + weight + flute)
  React.useEffect(() => {
    if (!collectedData) return;
    setFormData(prev => {
      const updates = {};
      // Sync dimensions
      if (collectedData.dimensions) {
        updates.length = collectedData.dimensions.length ?? prev.length;
        updates.width  = collectedData.dimensions.width  ?? prev.width;
        updates.height = collectedData.dimensions.height ?? prev.height;
      }
      // Sync weight & flute
      if (collectedData.weight_kg != null) updates.weight     = collectedData.weight_kg;
      if (collectedData.flute_type)        updates.flute_type = collectedData.flute_type;

      // ไม่มีอะไรเปลี่ยน → คืน prev เดิม (ไม่ trigger re-render)
      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
  }, [collectedData?.dimensions, collectedData?.weight_kg, collectedData?.flute_type]);

  // ใช้ chatbot dimensions ถ้า chatbot กำหนดแล้ว ไม่งั้นใช้ formData
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
      // [Bug #3 fix] ใช้ env variable แทน hardcoded URL
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

  const isDanger = analysis?.status === 'DANGER';

  return (
    <div className="flex w-screen h-screen bg-panel-darker overflow-hidden">

      {/* ===== LEFT PANEL (Tabs: Studio | Summary) ===== */}
      {/* Desktop: แสดงเสมอ / Tablet: toggle ได้ / Mobile: ซ่อน */}
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
        {/* Logo + Title */}
        <div className="flex-shrink-0 border-b border-panel-border" style={{ padding: '12px 24px' }}>
          <h1 className="font-display font-bold text-base">
            <span className="text-gradient-lumo">📦 LumoPack</span>
            <span className="text-zinc-500 text-xs font-normal ml-1.5">Studio</span>
          </h1>
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
            🎨 Studio
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
            📋 Summary
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
            />
          ) : (
            <SummaryPanel />
          )}
        </div>
      </div>

      {/* ===== CENTER: 3D BOX VIEWER ===== */}
      {/* Desktop/Tablet: แสดงเสมอ / Mobile: toggle กับ chat */}
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
        />

        {/* Left panel toggle button (visible when panel is closed or on tablet) */}
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
          title={leftPanelOpen ? 'ซ่อน Panel' : 'แสดง Panel'}
        >
          {leftPanelOpen ? '—' : '▶'}
        </button>
      </div>

      {/* ===== RIGHT PANEL: CHATBOT ===== */}
      {/* Desktop: fixed width / Tablet: flex / Mobile: full screen */}
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
      {/* ซ่อนบน desktop แสดงบน mobile เพื่อสลับ Chat / 3D */}
      <div className="hidden max-md:flex absolute bottom-0 left-0 right-0 z-20 bg-panel-darker border-t border-panel-border">
        <button
          onClick={() => setMobileView('chat')}
          className={`
            flex-1 py-3 text-xs font-display font-medium transition-colors
            ${mobileView === 'chat' ? 'text-lumo-400 bg-panel-surface' : 'text-zinc-500'}
          `}
        >
          💬 แชท
        </button>
        <button
          onClick={() => setMobileView('3d')}
          className={`
            flex-1 py-3 text-xs font-display font-medium transition-colors
            ${mobileView === '3d' ? 'text-lumo-400 bg-panel-surface' : 'text-zinc-500'}
          `}
        >
          📦 กล่อง 3D
        </button>
      </div>

    </div>
  );
}


// ===================================
// Root App
// ===================================

export default function App() {
  return (
    <ChatbotProvider>
      <AppLayout />
    </ChatbotProvider>
  );
}