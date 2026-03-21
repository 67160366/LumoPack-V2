/**
 * ChatInput — Input field + Send button — Navy Theme
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
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid #e2e8f0',
      background: '#fff',
      padding: '14px 16px',
    }}>
      {isComplete && (
        <div style={{
          textAlign: 'center', fontSize: 12, color: '#64748b',
          marginBottom: 10, padding: '4px 0',
          fontFamily: "'Sarabun', sans-serif",
        }}>
          การสนทนาเสร็จสิ้น
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
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
          style={{
            flex: 1, resize: 'none',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '11px 16px',
            fontSize: 13,
            color: '#0f172a',
            fontFamily: "'Sarabun', sans-serif",
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            opacity: isDisabled ? 0.5 : 1,
            cursor: isDisabled ? 'not-allowed' : 'text',
          }}
          onFocus={e => { if (!isDisabled) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; } }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
        />

        <button
          onClick={handleSend}
          disabled={isDisabled || !text.trim()}
          style={{
            flexShrink: 0,
            width: 44, height: 44, borderRadius: 14,
            border: 'none', cursor: (isDisabled || !text.trim()) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            background: (text.trim() && !isDisabled)
              ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
              : '#f1f5f9',
            color: (text.trim() && !isDisabled) ? '#fff' : '#cbd5e1',
            boxShadow: (text.trim() && !isDisabled) ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
          }}
          title="ส่งข้อความ"
        >
          {isLoading ? (
            <svg style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
