/**
 * ChatMessage — แสดงข้อความแต่ละ bubble — Navy Theme
 */

import React from 'react';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const content = message.content || '';

  return (
    <div className={`chat-enter flex w-full mb-5 flex-col ${isUser ? 'items-end' : 'items-start'}`}>

      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <img
            src="/logo.png"
            alt="LP"
            className="flex-shrink-0 mr-3 mt-1"
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
        )}

        <div
          style={{
            maxWidth: '82%',
            padding: '12px 16px',
            borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
            fontSize: 13,
            lineHeight: 1.7,
            ...(isUser
              ? {
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(15,23,42,0.2)',
                }
              : isError
                ? {
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                  }
                : {
                    background: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid #e2e8f0',
                  }
            ),
          }}
        >
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {content}
          </div>
          <div style={{
            fontSize: 10, marginTop: 6, textAlign: 'right',
            color: isUser ? 'rgba(255,255,255,0.4)' : '#94a3b8',
          }}>
            {formatTime(message.timestamp)}
          </div>
        </div>

        {isUser && (
          <div
            className="flex-shrink-0 flex items-center justify-center ml-3 mt-1"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            }}
          >
            <span style={{
              color: '#fff', fontSize: 10, fontWeight: 700,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>Me</span>
          </div>
        )}
      </div>

    </div>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
