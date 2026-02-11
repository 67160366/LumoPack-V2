/**
 * LumoPack API Service
 * 
 * เชื่อมต่อกับ Backend API (FastAPI)
 * Endpoints: /api/chat/message, /api/chat/session/*, /api/pricing/*
 * 
 * ใช้ Vite proxy ตอน dev (proxy /api → localhost:8000)
 * ใช้ VITE_API_URL ตอน production
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

// ===================================
// Helper: Fetch with error handling
// ===================================

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  
  // [Bug #2 fix] แยก headers ก่อน spread เพื่อไม่ให้ options.headers overwrite
  const { headers: optHeaders, ...restOptions } = options;
  
  const config = {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...optHeaders,
    },
  };

  try {
    const response = await fetch(url, config);

    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.detail || errorData.message || `HTTP ${response.status}`;
      throw new ApiError(message, response.status, errorData);
    }

    // 204 No Content (e.g. delete)
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // Network error
    throw new ApiError(
      'ไม่สามารถเชื่อมต่อ server ได้ กรุณาตรวจสอบว่า backend กำลังทำงานอยู่',
      0,
      { originalError: error.message }
    );
  }
}


// ===================================
// Custom Error Class
// ===================================

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}


// ===================================
// Chat API
// ===================================

/**
 * ส่งข้อความไปยัง chatbot
 * @param {string} message - ข้อความจาก user
 * @param {string|null} sessionId - Session ID (null = สร้างใหม่)
 * @returns {Promise<{
 *   response: string,
 *   session_id: string,
 *   current_step: number,
 *   collected_data: object,
 *   is_waiting_confirmation: boolean,
 *   is_complete: boolean
 * }>}
 */
export async function sendChatMessage(message, sessionId = null) {
  return apiFetch('/api/chat/message', {
    method: 'POST',
    body: JSON.stringify({
      message,
      session_id: sessionId,
    }),
  });
}

/**
 * ดึงข้อมูล session
 * @param {string} sessionId
 * @returns {Promise<{session_id, current_step, collected_data, message_count, is_complete}>}
 */
export async function getSession(sessionId) {
  return apiFetch(`/api/chat/session/${sessionId}`);
}

/**
 * ดึงประวัติการสนทนา
 * @param {string} sessionId
 * @param {number|null} limit
 * @returns {Promise<{session_id, message_count, messages: Array}>}
 */
export async function getConversationHistory(sessionId, limit = null) {
  const params = limit ? `?limit=${limit}` : '';
  return apiFetch(`/api/chat/session/${sessionId}/history${params}`);
}

/**
 * Reset session กลับไปเริ่มต้นใหม่
 * @param {string} sessionId
 * @returns {Promise<{message, session_id}>}
 */
export async function resetSession(sessionId) {
  return apiFetch(`/api/chat/session/${sessionId}/reset`, {
    method: 'POST',
  });
}

/**
 * ลบ session
 * @param {string} sessionId
 * @returns {Promise<null>}
 */
export async function deleteSession(sessionId) {
  return apiFetch(`/api/chat/session/${sessionId}`, {
    method: 'DELETE',
  });
}


// ===================================
// Pricing API
// ===================================

/**
 * คำนวณราคาจาก requirement
 * @param {object} requirement - BoxRequirement object
 * @returns {Promise<object>} - Pricing result
 */
export async function calculatePrice(requirement) {
  return apiFetch('/api/pricing/calculate', {
    method: 'POST',
    body: JSON.stringify(requirement),
  });
}


// ===================================
// Health Check
// ===================================

/**
 * ตรวจสอบว่า backend ทำงานอยู่ไหม
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    await apiFetch('/health');
    return true;
  } catch {
    return false;
  }
}