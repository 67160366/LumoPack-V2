/**
 * ChatMessage — แสดงข้อความแต่ละ bubble + แสดง UI Cards อัตโนมัติ
 */

import React from 'react';
import { useChatbot } from '../../contexts/ChatbotContext';
import RequirementSummary from './RequirementSummary';
import PricingQuote from './PricingQuote';
import MockupDisplay from './MockupDisplay';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const { collectedData } = useChatbot();

  const content = message.content || '';
  const isSummary = !isUser && content.includes('สรุป Requirement');
  const isPricing = !isUser && content.includes('ใบเสนอราคา');
  const showMockup = !isUser && content.includes('ขนาด') && !isSummary && !isPricing;

  const getParsedDimensions = () => {
    if (!showMockup) return null;
    const regex = /กว้าง\s*(\d+).*ยาว\s*(\d+).*สูง\s*(\d+)/;
    const match = content.match(regex);
    if (match) {
      return { width: match[1], length: match[2], height: match[3] };
    }
    return null;
  };

  const parsedDimensions = getParsedDimensions();

  return (
    <div className={`chat-enter flex w-full mb-5 flex-col ${isUser ? 'items-end' : 'items-start'}`}>

      {/* Chat bubble (Teal theme) */}
      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center mr-2.5 mt-1">
            <span className="text-xs font-display font-semibold text-teal-600">LP</span>
          </div>
        )}

        <div
          className={`
            relative max-w-[85%] px-5 py-3.5 rounded-xl text-sm leading-relaxed shadow-sm
            ${isUser
              ? 'bg-teal-600 text-white rounded-tr-sm'
              : isError
                ? 'bg-red-50 text-red-600 border border-red-200 rounded-tl-sm'
                : 'bg-white text-teal-900 border border-teal-100 rounded-tl-sm'
            }
          `}
        >
          <div className="whitespace-pre-wrap break-words">
            {content}
          </div>
          <div className={`text-xs mt-1.5 select-none text-right ${isUser ? 'text-teal-200' : 'text-teal-300'}`}>
            {formatTime(message.timestamp)}
          </div>
        </div>

        {isUser && (
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center ml-2.5 mt-1">
            <span className="text-xs font-display font-semibold text-purple-600">Me</span>
          </div>
        )}
      </div>

      {/* UI Cards */}
      {isSummary && (
        <div className="w-full flex justify-center mt-4 mb-2 px-2">
          <RequirementSummary data={collectedData} />
        </div>
      )}

      {isPricing && (
        <div className="w-full flex justify-center mt-4 mb-2 px-2">
          <PricingQuote pricing={collectedData?.pricing} />
        </div>
      )}

      {showMockup && (
        <div className="w-full flex justify-center mt-4 mb-2 px-2">
          <MockupDisplay boxType={collectedData?.box_type} dimensions={parsedDimensions} />
        </div>
      )}

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
