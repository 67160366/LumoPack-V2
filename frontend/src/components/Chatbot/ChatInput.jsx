/**
 * ChatInput — Input field + Send button
 * 
 * Features:
 * - Enter → send (Shift+Enter → newline)
 * - Disabled เมื่อ loading หรือ chat complete
 * - Auto-focus
 * - Auto-resize textarea (max 4 lines)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useChatbot } from '../../contexts/ChatbotContext';

export default function ChatInput() {
  const { sendMessage, isLoading, isComplete } = useChatbot();
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const isDisabled = isLoading || isComplete;

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current && !isDisabled) {
      textareaRef.current.focus();
    }
  }, [isLoading]); // Re-focus after loading finishes

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 96) + 'px'; // max ~4 lines
    }
  }, [text]);

  // Handle send
  const handleSend = () => {
    if (!text.trim() || isDisabled) return;
    sendMessage(text);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-panel-border bg-panel-darker p-3">
      {/* Complete message */}
      {isComplete && (
        <div className="text-center text-xs text-zinc-500 mb-2 py-1">
          ✅ การสนทนาเสร็จสิ้น
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Textarea */}
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
            flex-1 resize-none bg-panel-surface border border-panel-border 
            rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 
            placeholder-zinc-500 font-body
            focus:outline-none focus:border-lumo-400/50 focus:ring-1 focus:ring-lumo-400/20
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors duration-200
          `}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isDisabled || !text.trim()}
          className={`
            flex-shrink-0 w-10 h-10 rounded-xl
            flex items-center justify-center
            transition-all duration-200
            ${text.trim() && !isDisabled
              ? 'bg-lumo-400 text-panel-darker hover:bg-lumo-300 active:scale-95'
              : 'bg-panel-surface text-zinc-600 cursor-not-allowed'
            }
          `}
          title="ส่งข้อความ"
        >
          {isLoading ? (
            // Loading spinner
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            // Send icon
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