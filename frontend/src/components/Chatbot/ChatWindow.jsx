/**
 * ChatWindow — Container หลักของ Chatbot Panel (ขวา)
 * 
 * Layout:
 * ┌─────────────────┐
 * │ Header + Step   │ (fixed top)
 * ├─────────────────┤
 * │                 │
 * │   Messages      │ (scrollable)
 * │   + Typing      │
 * │                 │
 * ├─────────────────┤
 * │ ChatInput       │ (fixed bottom)
 * └─────────────────┘
 */

import React, { useRef, useEffect } from 'react';
import { useChatbot } from '../../contexts/ChatbotContext';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

export default function ChatWindow() {
  const {
    messages,
    currentStep,
    isLoading,
    isComplete,
    resetChat,
  } = useChatbot();

  const messagesEndRef = useRef(null);

  // Auto-scroll เมื่อมีข้อความใหม่
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Progress bar width
  const progress = Math.min(((currentStep - 1) / 13) * 100, 100);

  return (
    <div className="flex flex-col h-full bg-panel-darker max-md:pb-12">

      {/* ===== Header ===== */}
      <div className="flex-shrink-0 border-b border-panel-border">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-lumo-400/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">🤖</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-display font-semibold text-zinc-100 truncate">
                LumoPack Assistant
              </h3>
              {(isComplete || isLoading) && (
                <p className="text-[11px] text-zinc-500 font-body">
                  {isComplete ? '✅ สนทนาเสร็จสิ้น' : '⏳ กำลังพิมพ์...'}
                </p>
              )}
            </div>
          </div>

          {/* Reset button */}
          <button
            onClick={resetChat}
            className="flex-shrink-0 text-xs text-zinc-500 hover:text-lumo-400 transition-colors px-2 py-1 rounded hover:bg-panel-surface"
            title="เริ่มใหม่"
          >
            ↺ ใหม่
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] bg-panel-border">
          <div
            className="h-full bg-lumo-400 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ===== Messages Area ===== */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {/* Welcome message ถ้ายังไม่มีข้อความ */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-lumo-400/10 flex items-center justify-center mb-4">
              <span className="text-3xl">📦</span>
            </div>
            <h4 className="font-display font-semibold text-zinc-200 mb-2">
              ยินดีต้อนรับสู่ LumoPack
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-[240px]">
              พิมพ์ทักทายเพื่อเริ่มออกแบบกล่องบรรจุภัณฑ์ของคุณ
              AI จะแนะนำสเปคและคำนวณราคาให้
            </p>
            <div className="mt-4 px-4 py-2 rounded-lg bg-panel-surface border border-panel-border text-xs text-zinc-400">
              พิมพ์ <span className="text-lumo-400 font-medium">"สวัสดี"</span> ด้านล่างเพื่อเริ่มต้น ↓
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-lumo-400/20 flex items-center justify-center">
              <span className="text-xs">📦</span>
            </div>
            <div className="bg-panel-surface border border-panel-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full typing-dot" />
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full typing-dot" />
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full typing-dot" />
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* ===== Input Area ===== */}
      <ChatInput />
    </div>
  );
}