/**
 * ChatWindow — Container หลักของ Chatbot Panel — Navy Theme
 */

import React, { useRef, useEffect } from 'react';
import { useChatbot } from '../../contexts/ChatbotContext';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import DimensionsForm from './DimensionsForm';
import HeartDimensionsForm from './HeartDimensionsForm';

export default function ChatWindow() {
  const {
    messages,
    currentStep,
    isLoading,
    isComplete,
    quickReplies,
    sendMessage,
    resetChat,
    collectedData,
  } = useChatbot();

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, quickReplies]);

  const progress = Math.min(((currentStep - 1) / 13) * 100, 100);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white max-md:pb-12">

      {/* ===== Header (inside ChatWindow — navy accent) ===== */}
      <div className="flex-shrink-0 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between px-5 py-3.5 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="LumoPack"
              className="flex-shrink-0"
              style={{ width: 36, height: 36, objectFit: 'contain' }}
            />
            <div className="min-w-0">
              <h3 style={{
                fontSize: 14, fontWeight: 700, color: '#0f172a',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                margin: 0,
              }}>
                LumoPack Assistant
              </h3>
              {(isComplete || isLoading) && (
                <p style={{
                  fontSize: 11, color: '#64748b', margin: '2px 0 0',
                  fontFamily: "'Sarabun', sans-serif",
                }}>
                  {isComplete ? 'สนทนาเสร็จสิ้น' : 'กำลังพิมพ์...'}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={resetChat}
            style={{
              fontSize: 12, fontWeight: 600, color: '#64748b',
              background: 'none', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
            title="เริ่มใหม่"
          >
            ใหม่
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: '#e2e8f0' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
              transition: 'width 0.5s ease-out',
            }}
          />
        </div>
      </div>

      {/* ===== Messages Area ===== */}
      <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {/* Logo */}
            <img
              src="/logo.png"
              alt="LumoPack"
              style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 20 }}
            />
            <h4 style={{
              fontSize: 18, fontWeight: 700, color: '#0f172a',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              marginBottom: 8,
            }}>
              ออกแบบกล่องของคุณ
            </h4>
            <p style={{
              fontSize: 13, color: '#64748b', lineHeight: 1.6,
              maxWidth: 260, marginBottom: 24,
              fontFamily: "'Sarabun', sans-serif",
            }}>
              AI จะแนะนำสเปค วัสดุ และคำนวณราคาให้ — แค่พิมพ์ "สวัสดี" เพื่อเริ่มต้น
            </p>
            <button
              onClick={() => sendMessage('สวัสดี')}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '12px 28px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.3)'; }}
            >
              เริ่มออกแบบกล่อง
            </button>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-center gap-3 mb-3">
            <img
              src="/logo.png"
              alt="LP"
              style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{
              background: '#f1f5f9', borderRadius: 16, borderTopLeftRadius: 4,
              padding: '14px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
                <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
                <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
              </div>
            </div>
          </div>
        )}

        {/* Quick Reply Buttons */}
        {!isLoading && quickReplies.length > 0 && (
          quickReplies.includes('__FORM_DIMENSIONS__') ? (
            collectedData?.box_type === 'heart' ? (
              <HeartDimensionsForm onSubmit={(text) => sendMessage(text)} />
            ) : (
              <DimensionsForm onSubmit={(text) => sendMessage(text)} />
            )
          ) : (
            <div className="flex flex-wrap gap-2 mt-2 mb-3 ml-11 chat-enter">
              {quickReplies.map((text, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(text)}
                  style={{
                    padding: '8px 16px', borderRadius: 12, fontSize: 12,
                    fontWeight: 500, cursor: 'pointer',
                    background: '#fff', color: '#1e293b',
                    border: '1px solid #e2e8f0',
                    fontFamily: "'Sarabun', sans-serif",
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; e.currentTarget.style.background = '#fff'; }}
                >
                  {text}
                </button>
              ))}
            </div>
          )
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ===== Input Area ===== */}
      <ChatInput />
    </div>
  );
}
