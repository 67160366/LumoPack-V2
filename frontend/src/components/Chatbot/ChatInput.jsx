/**
 * ChatInput — Input field + Send button (Teal Theme)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useChatbot } from '../../contexts/ChatbotContext';

export default function ChatInput() {
  const { sendMessage, isLoading, isComplete } = useChatbot();
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const isDisabled = isLoading || isComplete;

  useEffect(() => {
    if (textareaRef.current && !isDisabled) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 96) + 'px';
    }
  }, [text]);

  const handleSend = () => {
    if (!text.trim() || isDisabled) return;
    sendMessage(text);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-teal-100 bg-white p-3">
      {isComplete && (
        <div className="text-center text-xs text-teal-500 mb-2 py-1">
          ✅ การสนทนาเสร็จสิ้น
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isComplete
              ? 'การสนทนาเสร็จสิ้นแล้ว'
              : isLoading
                ? 'กำลังประมวลผล...'
                : 'พิมพ์ข้อความ...'
          }
          disabled={isDisabled}
          rows={1}
          className={`
            flex-1 resize-none bg-teal-50/50 border border-teal-200
            rounded-xl px-3.5 py-2.5 text-sm text-teal-900
            placeholder-teal-300 font-body
            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
          `}
        />

        <button
          onClick={handleSend}
          disabled={isDisabled || !text.trim()}
          className={`
            flex-shrink-0 w-10 h-10 rounded-xl
            flex items-center justify-center
            transition-all duration-200 shadow-sm
            ${text.trim() && !isDisabled
              ? 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95'
              : 'bg-purple-50 text-purple-300 cursor-not-allowed'
            }
          `}
          title="ส่งข้อความ"
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
