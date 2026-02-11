/**
 * ChatbotContext — State Management กลาง
 * 
 * จัดการ:
 * - messages[]              : ประวัติสนทนา
 * - sessionId               : session ID จาก backend
 * - currentStep             : step ปัจจุบัน (1-14)
 * - collectedData           : ข้อมูลที่ chatbot เก็บได้
 * - boxDimensions           : ขนาดกล่อง 3D (sync กับ chatbot)
 * - hasChatbotDimensions    : chatbot กำหนดขนาดแล้วหรือยัง
 * - isLoading               : กำลังรอ response
 * - error                   : error message
 * - isComplete              : conversation จบแล้วหรือยัง
 * 
 * Actions:
 * - sendMessage(text)       : ส่งข้อความ → backend → update state
 * - resetChat()             : เริ่มใหม่
 * - clearError()            : ลบ error
 */

import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect, useMemo
} from 'react';
import { sendChatMessage, resetSession as apiResetSession } from '../services/api';


// ===================================
// Context
// ===================================

const ChatbotContext = createContext(null);

// Default box dimensions
const DEFAULT_DIMENSIONS = { width: 10, length: 10, height: 10 };

// Step labels สำหรับแสดง UI
export const STEP_LABELS = {
  1:  'ทักทาย',
  2:  'ประเภทสินค้า',
  3:  'ประเภทกล่อง & วัสดุ',
  4:  'Inner กันกระแทก',
  5:  'ขนาด & จำนวน',
  6:  'สรุปรอบ 1',
  7:  'Mood & Tone',
  8:  'โลโก้',
  9:  'ลูกเล่นพิเศษ',
  10: 'สรุปรอบ 2',
  11: 'Mockup',
  12: 'ใบเสนอราคา',
  13: 'ยืนยันคำสั่งซื้อ',
  14: 'เสร็จสิ้น',
};


// ===================================
// Provider
// ===================================

export function ChatbotProvider({ children }) {
  // --- State ---
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [collectedData, setCollectedData] = useState({});
  const [boxDimensions, setBoxDimensions] = useState(DEFAULT_DIMENSIONS);
  const [hasChatbotDimensions, setHasChatbotDimensions] = useState(false); // [Bug #1 fix]
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  // Ref เพื่อป้องกัน double-send
  const sendingRef = useRef(false);

  // --- Extract box dimensions จาก collectedData --- [Bug #1 fix]
  useEffect(() => {
    if (collectedData?.dimensions) {
      const dims = collectedData.dimensions;
      const newDims = {
        width:  dims.width  ?? DEFAULT_DIMENSIONS.width,
        length: dims.length ?? DEFAULT_DIMENSIONS.length,
        height: dims.height ?? DEFAULT_DIMENSIONS.height,
      };
      setBoxDimensions(newDims);
      setHasChatbotDimensions(true);
    }
  }, [collectedData?.dimensions]);


  // --- Send Message ---
  const sendMessage = useCallback(async (text) => {
    if (sendingRef.current || !text.trim()) return;
    sendingRef.current = true;
    setError(null);

    // 1. เพิ่ม user message ลง state ทันที (optimistic)
    const userMsg = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 2. เรียก API
      const data = await sendChatMessage(text, sessionId);

      // 3. Update state จาก response
      setSessionId(data.session_id);
      setCurrentStep(data.current_step);
      setCollectedData(data.collected_data);
      setIsComplete(data.is_complete);

      // 4. เพิ่ม bot message
      const botMsg = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        step: data.current_step,
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');

      const errorMsg = {
        role: 'assistant',
        content: '⚠️ ขออภัยค่ะ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองส่งข้อความอีกครั้งค่ะ',
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMsg]);

    } finally {
      setIsLoading(false);
      sendingRef.current = false;
    }
  }, [sessionId]);


  // --- Reset Chat ---
  const resetChat = useCallback(async () => {
    if (sessionId) {
      try {
        await apiResetSession(sessionId);
      } catch {
        // ถ้า reset ไม่ได้ สร้าง session ใหม่แทน
      }
    }

    setMessages([]);
    setSessionId(null);
    setCurrentStep(1);
    setCollectedData({});
    setBoxDimensions(DEFAULT_DIMENSIONS);
    setHasChatbotDimensions(false); // [Bug #1 fix]
    setIsLoading(false);
    setError(null);
    setIsComplete(false);
    sendingRef.current = false;
  }, [sessionId]);


  // --- Clear Error ---
  const clearError = useCallback(() => setError(null), []);


  // --- Context Value --- [Bug #4 fix: useMemo]
  const value = useMemo(() => ({
    // State
    messages,
    sessionId,
    currentStep,
    collectedData,
    boxDimensions,
    hasChatbotDimensions,
    isLoading,
    error,
    isComplete,

    // Actions
    sendMessage,
    resetChat,
    clearError,
  }), [
    messages, sessionId, currentStep, collectedData,
    boxDimensions, hasChatbotDimensions, isLoading, error, isComplete,
    sendMessage, resetChat, clearError,
  ]);

  return (
    <ChatbotContext.Provider value={value}>
      {children}
    </ChatbotContext.Provider>
  );
}


// ===================================
// Hook
// ===================================

export function useChatbot() {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
}

export default ChatbotContext;