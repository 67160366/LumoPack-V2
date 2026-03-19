/**
 * ChatWindow — Container หลักของ Chatbot Panel (ขวา) — Teal Theme
 */

import React, { useRef, useEffect } from 'react';
import { useChatbot } from '../../contexts/ChatbotContext';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import DimensionsForm from './DimensionsForm';

export default function ChatWindow() {
  const {
    messages,
    currentStep,
    isLoading,
    isComplete,
    quickReplies,
    sendMessage,
    resetChat,
  } = useChatbot();

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, quickReplies]);

  const progress = Math.min(((currentStep - 1) / 13) * 100, 100);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-teal-50 to-white max-md:pb-12">

      {/* ===== Header ===== */}
      <div className="flex-shrink-0 border-b border-teal-100 bg-white">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-display font-semibold text-teal-600">LP</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-display font-semibold text-teal-900 truncate">
                LumoPack Assistant
              </h3>
              {(isComplete || isLoading) && (
                <p className="text-xs text-teal-500 font-body">
                  {isComplete ? '✅ สนทนาเสร็จสิ้น' : '⏳ กำลังพิมพ์...'}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={resetChat}
            className="flex-shrink-0 text-xs text-teal-500 hover:text-teal-700 transition-colors px-2 py-1 rounded hover:bg-teal-50"
            title="เริ่มใหม่"
          >
            ↺ ใหม่
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] bg-teal-100">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ===== Messages Area ===== */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-start justify-center h-full px-2">
            <h4 className="font-display font-semibold text-teal-800 text-base mb-1.5">
              ออกแบบกล่องของคุณ
            </h4>
            <p className="text-sm text-teal-500 leading-relaxed mb-6 max-w-[280px]">
              AI จะแนะนำสเปค วัสดุ และคำนวณราคาให้ — แค่พิมพ์ "สวัสดี" เพื่อเริ่มต้น
            </p>
            <button
              onClick={() => sendMessage('สวัสดี')}
              className="px-4 py-2.5 rounded-xl text-sm font-display font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors active:scale-[0.98]"
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
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
              <span className="text-xs font-display font-semibold text-teal-600">LP</span>
            </div>
            <div className="bg-white border border-teal-100 rounded-xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-teal-400 rounded-full typing-dot" />
                <div className="w-1.5 h-1.5 bg-teal-400 rounded-full typing-dot" />
                <div className="w-1.5 h-1.5 bg-teal-400 rounded-full typing-dot" />
              </div>
            </div>
          </div>
        )}

        {/* Quick Reply Buttons */}
        {!isLoading && quickReplies.length > 0 && (
          quickReplies.includes('__FORM_DIMENSIONS__') ? (
            <DimensionsForm onSubmit={(text) => sendMessage(text)} />
          ) : (
            <div className="flex flex-wrap gap-2 mt-1 mb-3 ml-9 chat-enter">
              {quickReplies.map((text, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(text)}
                  className="
                    px-3.5 py-2 rounded-xl text-xs font-body
                    bg-white border border-teal-200
                    text-teal-700 hover:text-teal-900
                    hover:border-teal-400 hover:bg-teal-50
                    active:scale-95 shadow-sm
                    transition-all duration-200
                  "
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
