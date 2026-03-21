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
import { useLocation, useNavigate } from 'react-router-dom';
import { sendChatMessage, resetSession as apiResetSession } from '../services/api';
import { useAuth } from './AuthContext';


// ===================================
// Context
// ===================================

const ChatbotContext = createContext(null);

// Default box dimensions
const DEFAULT_DIMENSIONS = { width: 10, length: 10, height: 10 };
const ONBOARDING_STAGES = {
  IDLE: 'idle',
  ASK_PRODUCT: 'ask_product',
  RECOMMEND_BOX: 'recommend_box',
  CHOOSE_BOX: 'choose_box',
  ASK_SUPPORT: 'ask_support',
  ASK_MATERIAL: 'ask_material',
  COMPLETE: 'complete',
};

const BOX_CATALOG = {
  rsc: {
    path: '/rsc-test',
    label: 'RSC (กล่องลูกฟูกมาตรฐาน)',
    aliases: ['rsc', 'กล่องลูกฟูก', 'ลูกฟูก', 'ส่งของ', 'ขนส่ง', 'heavy duty'],
  },
  die_cut: {
    path: '/dieline-test',
    label: 'Die-cut / ฝาเสียบ',
    aliases: ['die', 'die-cut', 'ฝาเสียบ', 'สินค้าโชว์', 'โชว์สินค้า', 'display'],
  },
  tube_lock: {
    path: '/tube-lock-test',
    label: 'Tube Lock',
    aliases: ['tube', 'tube lock', 'ท่อล็อค', 'ท่อ', 'ยาว', 'ขวด'],
  },
  self_lock: {
    path: '/self-lock-test',
    label: 'Self-Lock',
    aliases: ['self', 'self-lock', 'self lock', 'ล็อค', 'ล็อคอัตโนมัติ', 'หนัก'],
  },
  heart: {
    path: '/heart-box-test',
    label: 'Heart Box',
    aliases: ['heart', 'หัวใจ', 'ของขวัญ', 'gift'],
  },
};

const ALL_BOX_TYPES = Object.keys(BOX_CATALOG);

function normalizeText(input) {
  return String(input || '').trim().toLowerCase();
}

function isAffirmative(text) {
  const t = normalizeText(text);
  return ['ใช่', 'yes', 'y', 'ok', 'โอเค', 'ได้', 'เลือกแล้ว', 'เรียบร้อย'].some(k => t.includes(k));
}

function isNegative(text) {
  const t = normalizeText(text);
  return ['ยัง', 'ไม่', 'no', 'n', 'ยังไม่ได้', 'ยังไม่เลือก'].some(k => t.includes(k));
}

function parseSupportChoice(text) {
  const t = normalizeText(text);
  if (['มี', 'ต้องการ', 'เอา', 'yes', 'ใช่', 'มีซัพพอร์ต'].some(k => t.includes(k))) return true;
  if (['ไม่มี', 'ไม่ต้อง', 'ไม่เอา', 'no', 'ไม่ใช้ซัพพอร์ต'].some(k => t.includes(k))) return false;
  return null;
}

function boxTypeToReplyLabel(boxType) {
  return BOX_CATALOG[boxType]?.label || boxType;
}

function getAllBoxReplyLabels() {
  return ALL_BOX_TYPES.map(boxTypeToReplyLabel);
}

function parseBoxTypeFromText(text) {
  const t = normalizeText(text);
  for (const [boxType, info] of Object.entries(BOX_CATALOG)) {
    if (info.aliases.some(alias => t.includes(alias))) return boxType;
    if (t.includes(normalizeText(info.label))) return boxType;
  }
  return null;
}

function recommendBoxesFromProduct(productText) {
  const t = normalizeText(productText);
  if (['ของขวัญ', 'gift', 'เครื่องประดับ', 'ดอกไม้'].some(k => t.includes(k))) {
    return ['heart', 'die_cut'];
  }
  if (['ขวด', 'tube', 'หลอด', 'ทรงยาว', 'แก้ว'].some(k => t.includes(k))) {
    return ['tube_lock', 'die_cut'];
  }
  if (['หนัก', 'อะไหล่', 'เครื่องมือ', 'ชิ้นส่วน', 'industrial'].some(k => t.includes(k))) {
    return ['self_lock', 'rsc'];
  }
  if (['อาหาร', 'เบเกอรี่', 'ขนม', 'cosmetic', 'เครื่องสำอาง'].some(k => t.includes(k))) {
    return ['die_cut', 'rsc'];
  }
  return ['rsc', 'die_cut', 'self_lock'];
}

// Material options per box type (simplified: kraft/white, heart adds red)
const MATERIAL_OPTIONS = {
  default: [
    { key: 'kraft', label: 'Kraft (คราฟท์)' },
    { key: 'white', label: 'White (ขาว)' },
  ],
  heart: [
    { key: 'kraft', label: 'Kraft (คราฟท์)' },
    { key: 'white', label: 'White (ขาว)' },
    { key: 'red', label: 'Red (แดง)' },
  ],
};

function getMaterialOptions(boxType) {
  return MATERIAL_OPTIONS[boxType] || MATERIAL_OPTIONS.default;
}

function getMaterialReplyLabels(boxType) {
  return getMaterialOptions(boxType).map(m => m.label);
}

function parseMaterialFromText(text) {
  const t = normalizeText(text);
  if (['kraft', 'คราฟท์', 'คราฟ'].some(k => t.includes(k))) return 'kraft';
  if (['white', 'ขาว'].some(k => t.includes(k))) return 'white';
  if (['red', 'แดง'].some(k => t.includes(k))) return 'red';
  return null;
}

// Product type quick replies
const PRODUCT_TYPE_REPLIES = ['สินค้าทั่วไป', 'Non-food', 'Food-grade', 'เครื่องสำอาง'];

function parseProductTypeFromText(text) {
  const t = normalizeText(text);
  if (['เครื่องสำอาง', 'cosmetic', 'สำอาง', 'ครีม'].some(k => t.includes(k))) return 'cosmetic';
  if (['food-grade', 'food grade', 'อาหาร', 'ขนม', 'เบเกอรี่'].some(k => t.includes(k))) return 'food_grade';
  if (['non-food', 'non food', 'ไม่ใช่อาหาร'].some(k => t.includes(k))) return 'non_food';
  if (['ทั่วไป', 'general', 'ธรรมดา'].some(k => t.includes(k))) return 'general';
  // Number matching
  const num = t.match(/^([1-4])$/);
  if (num) return { '1': 'general', '2': 'non_food', '3': 'food_grade', '4': 'cosmetic' }[num[1]];
  return null;
}

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
  // --- Auth ---
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // --- State ---
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [collectedData, setCollectedData] = useState({});
  const [boxDimensions, setBoxDimensions] = useState(DEFAULT_DIMENSIONS);
  const [hasChatbotDimensions, setHasChatbotDimensions] = useState(false); // [Bug #1 fix]
  const [quickReplies, setQuickReplies] = useState([]);  // [Sprint3-B] ปุ่มเลือกตอบ
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState(ONBOARDING_STAGES.IDLE);
  const [recommendedBoxes, setRecommendedBoxes] = useState([]);
  const [stickyCollectedData, setStickyCollectedData] = useState({});

  // Ref เพื่อป้องกัน double-send
  const sendingRef = useRef(false);

  // analysis result จาก chatbot (sync ไป StudioPanel)
  const [chatbotAnalysis, setChatbotAnalysis] = useState(null);

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

  // --- Auto-trigger strength analysis เมื่อ chatbot เก็บ dimensions+weight ครบ ---
  useEffect(() => {
    const dims   = collectedData?.dimensions;
    const weight = collectedData?.weight_kg;
    const flute  = collectedData?.flute_type ?? 'C';
    if (!dims) return;

    let cancelled = false;
    const apiBase = import.meta?.env?.VITE_API_URL ?? '';
    const payload = {
      length: dims.length,
      width: dims.width,
      height: dims.height,
      weight: weight ?? 0,
      flute_type: flute,
      support_required: collectedData?.support_required ?? false,
    };

    const run = async () => {
      const endpoints = [`${apiBase}/analyze-v2`, `${apiBase}/analyze`];
      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (!cancelled) setChatbotAnalysis(data);
          return;
        } catch {
          // try next endpoint
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [collectedData?.dimensions, collectedData?.weight_kg, collectedData?.flute_type, collectedData?.support_required]);

  const appendAssistantMessage = useCallback((content, extra = {}) => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      ...extra,
    }]);
  }, []);

  const gotoBoxEndpoint = useCallback((boxType) => {
    const endpoint = BOX_CATALOG[boxType]?.path;
    if (!endpoint) return;
    if (location.pathname !== endpoint) {
      navigate(endpoint);
    }
  }, [location.pathname, navigate]);

  const sendToBackend = useCallback(async (text, options = {}) => {
    const { includeUserBubble = true, prefillData = null } = options;
    if (sendingRef.current || !text.trim()) return;
    sendingRef.current = true;
    setError(null);
    setQuickReplies([]);

    if (includeUserBubble) {
      const userMsg = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
    }
    setIsLoading(true);

    try {
      const data = await sendChatMessage(text, sessionId, user?.id ?? null, prefillData);
      setSessionId(data.session_id);
      setCurrentStep(data.current_step);
      setCollectedData({ ...(stickyCollectedData || {}), ...(data.collected_data || {}) });
      setIsComplete(data.is_complete);
      setQuickReplies(Array.isArray(data.quick_replies) ? data.quick_replies : []);
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
      setQuickReplies([]);
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
  }, [sessionId, user?.id, stickyCollectedData]);

  // --- Send Message ---
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;

    const addUserMessage = () => setMessages(prev => [...prev, {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }]);

    if (onboardingStage !== ONBOARDING_STAGES.COMPLETE) {
      addUserMessage();
      setQuickReplies([]);
      setError(null);

      // --- IDLE: first message → ask product type ---
      if (onboardingStage === ONBOARDING_STAGES.IDLE) {
        setOnboardingStage(ONBOARDING_STAGES.ASK_PRODUCT);
        appendAssistantMessage(
          'สวัสดีค่ะ ฉันคือ LumoPack Assistant รับออกแบบกล่องให้เหมาะสม\n\nสินค้าของคุณเป็นประเภทไหนคะ?',
        );
        setQuickReplies(PRODUCT_TYPE_REPLIES);
        return;
      }

      // --- ASK_PRODUCT: parse product type → recommend boxes ---
      if (onboardingStage === ONBOARDING_STAGES.ASK_PRODUCT) {
        const productType = parseProductTypeFromText(trimmed) || trimmed;
        const rec = recommendBoxesFromProduct(trimmed);
        const sticky = { ...stickyCollectedData, product_type: productType };
        setStickyCollectedData(sticky);
        setCollectedData(prev => ({ ...prev, product_type: productType }));
        setRecommendedBoxes(rec);
        setOnboardingStage(ONBOARDING_STAGES.RECOMMEND_BOX);
        appendAssistantMessage(
          `รับทราบค่ะ แนะนำ ${rec.map(boxTypeToReplyLabel).join(' / ')} เลือกแบบที่ต้องการได้เลย`,
        );
        setQuickReplies([...rec.map(boxTypeToReplyLabel), 'ขอดูทุกแบบ']);
        return;
      }

      // --- RECOMMEND_BOX / CHOOSE_BOX: select box type → navigate → ask support ---
      if (onboardingStage === ONBOARDING_STAGES.RECOMMEND_BOX || onboardingStage === ONBOARDING_STAGES.CHOOSE_BOX) {
        if (trimmed.includes('ทุกแบบ')) {
          setOnboardingStage(ONBOARDING_STAGES.CHOOSE_BOX);
          appendAssistantMessage('ได้ค่ะ นี่คือประเภทกล่องทั้งหมดที่มี');
          setQuickReplies(getAllBoxReplyLabels());
          return;
        }

        const boxType = parseBoxTypeFromText(trimmed);
        if (!boxType) {
          appendAssistantMessage('ยังจับชื่อกล่องไม่ได้ค่ะ ลองเลือกจากปุ่มด้านล่าง');
          setQuickReplies(onboardingStage === ONBOARDING_STAGES.RECOMMEND_BOX && recommendedBoxes.length > 0
            ? [...recommendedBoxes.map(boxTypeToReplyLabel), 'ขอดูทุกแบบ']
            : getAllBoxReplyLabels());
          return;
        }

        const sticky = { ...stickyCollectedData, box_type: boxType };
        setStickyCollectedData(sticky);
        setCollectedData(prev => ({ ...prev, box_type: boxType }));
        gotoBoxEndpoint(boxType);
        setOnboardingStage(ONBOARDING_STAGES.ASK_SUPPORT);
        appendAssistantMessage(`พาไปหน้า ${boxTypeToReplyLabel(boxType)} แล้วค่ะ ต้องการเพิ่มซัพพอร์ตด้านในกล่องไหมคะ?`);
        setQuickReplies(['มีซัพพอร์ต', 'ไม่ใช้ซัพพอร์ต']);
        return;
      }

      // --- ASK_SUPPORT: parse support → ask material ---
      if (onboardingStage === ONBOARDING_STAGES.ASK_SUPPORT) {
        const supportRequired = parseSupportChoice(trimmed);
        if (supportRequired == null) {
          appendAssistantMessage('ขอเลือกอีกครั้งค่ะ: ต้องการซัพพอร์ตหรือไม่');
          setQuickReplies(['มีซัพพอร์ต', 'ไม่ใช้ซัพพอร์ต']);
          return;
        }

        const currentBox = stickyCollectedData.box_type || 'rsc';
        const sticky = { ...stickyCollectedData, support_required: supportRequired };
        setStickyCollectedData(sticky);
        setCollectedData(prev => ({ ...prev, support_required: supportRequired }));
        setOnboardingStage(ONBOARDING_STAGES.ASK_MATERIAL);
        appendAssistantMessage(
          (supportRequired
            ? 'รับทราบค่ะ จะรวมซัพพอร์ตในการออกแบบ'
            : 'รับทราบค่ะ จะคำนวณแบบไม่ใส่ซัพพอร์ต')
          + '\n\nเลือกวัสดุกล่องได้เลยค่ะ:',
        );
        setQuickReplies(getMaterialReplyLabels(currentBox));
        return;
      }

      // --- ASK_MATERIAL: parse material → complete onboarding → kickoff backend ---
      if (onboardingStage === ONBOARDING_STAGES.ASK_MATERIAL) {
        const material = parseMaterialFromText(trimmed);
        if (!material) {
          const currentBox = stickyCollectedData.box_type || 'rsc';
          appendAssistantMessage('ยังจับวัสดุไม่ได้ค่ะ กรุณาเลือกจากปุ่มด้านล่าง');
          setQuickReplies(getMaterialReplyLabels(currentBox));
          return;
        }

        const sticky = { ...stickyCollectedData, material };
        setStickyCollectedData(sticky);
        setCollectedData(prev => ({ ...prev, material }));
        setOnboardingStage(ONBOARDING_STAGES.COMPLETE);
        appendAssistantMessage(`เลือกวัสดุ ${material} เรียบร้อยค่ะ เริ่มขั้นตอนออกแบบต่อเลยนะคะ`);

        const kickoffMessage = [
          'เริ่มเข้าสู่ขั้นตอนออกแบบปกติ',
          `ประเภทกล่อง: ${sticky.box_type || '-'}`,
          `สินค้า: ${sticky.product_type || '-'}`,
          `ซัพพอร์ตภายใน: ${sticky.support_required ? 'ต้องการ' : 'ไม่ต้องการ'}`,
          `วัสดุ: ${material}`,
          'โปรดใช้การวิเคราะห์ความแข็งแรงเวอร์ชันใหม่ (McKee v2) ในการประเมิน',
        ].join('\n');
        await sendToBackend(kickoffMessage, {
          includeUserBubble: false,
          prefillData: {
            product_type: sticky.product_type || null,
            box_type: sticky.box_type || null,
            support_required: sticky.support_required ?? false,
            material,
          },
        });
        return;
      }

      return;
    }

    await sendToBackend(trimmed, { includeUserBubble: true });
  }, [
    appendAssistantMessage,
    gotoBoxEndpoint,
    onboardingStage,
    recommendedBoxes,
    sendToBackend,
    stickyCollectedData,
  ]);


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
    setQuickReplies([]);  // [Sprint3-B]
    setIsLoading(false);
    setError(null);
    setIsComplete(false);
    setOnboardingStage(ONBOARDING_STAGES.IDLE);
    setRecommendedBoxes([]);
    setStickyCollectedData({});
    setChatbotAnalysis(null);
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
    quickReplies,
    isLoading,
    error,
    isComplete,
    chatbotAnalysis,
    onboardingStage,

    // Actions
    sendMessage,
    resetChat,
    clearError,
  }), [
    messages, sessionId, currentStep, collectedData,
    boxDimensions, hasChatbotDimensions, quickReplies,
    isLoading, error, isComplete, chatbotAnalysis, onboardingStage,
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