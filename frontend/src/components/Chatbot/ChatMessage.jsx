/**
 * ChatMessage — แสดงข้อความแต่ละ bubble
 * 
 * Props:
 * - message: { role, content, timestamp, step?, isError? }
 * 
 * Styles:
 * - user:  ชิดขวา, สี warm brown (lumo-400)
 * - bot:   ชิดซ้าย, สี dark (panel-surface)
 * - error: ชิดซ้าย, สี red border
 */

import React from 'react';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div
      className={`
        chat-enter flex w-full mb-3
        ${isUser ? 'justify-end' : 'justify-start'}
      `}
    >
      {/* Avatar — bot only */}
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-lumo-400/20 flex items-center justify-center mr-2 mt-1">
          <span className="text-xs">📦</span>
        </div>
      )}

      {/* Bubble */}
      <div
        className={`
          relative max-w-[92%] px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-lumo-400 text-panel-darker rounded-br-md'
            : isError
              ? 'bg-red-900/30 text-red-200 border border-red-800/40 rounded-bl-md'
              : 'bg-panel-surface text-zinc-200 border border-panel-border rounded-bl-md'
          }
        `}
      >
        {/* Content — ซับพอร์ต newline */}
        <div className="whitespace-pre-wrap break-words font-body">
          {message.content}
        </div>

        {/* Timestamp */}
        <div
          className={`
            text-[10px] mt-1.5 select-none
            ${isUser ? 'text-panel-darker/50' : 'text-zinc-500'}
          `}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>

      {/* Avatar — user only */}
      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-lumo-400/30 flex items-center justify-center ml-2 mt-1">
          <span className="text-xs">👤</span>
        </div>
      )}
    </div>
  );
}


// ===================================
// Helper: Format timestamp
// ===================================

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}