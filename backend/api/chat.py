"""
Chat API Endpoints
จัดการ chatbot conversations
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import uuid

from services.chatbot_flow import ChatbotFlowManager
from models.chat_state import session_storage, ConversationState


# ===================================
# Request/Response Models
# ===================================

class ChatMessageRequest(BaseModel):
    """Request model สำหรับส่งข้อความ"""
    message: str = Field(..., min_length=1, description="ข้อความจากลูกค้า")
    session_id: Optional[str] = Field(None, description="Session ID (ถ้ามีอยู่แล้ว)")
    user_id: Optional[str] = Field(None, description="User ID (Optional)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "สวัสดีครับ",
                "session_id": None,
                "user_id": "user_12345"
            }
        }


class ChatMessageResponse(BaseModel):
    """Response model สำหรับการตอบกลับ"""
    response: str = Field(..., description="ข้อความตอบกลับจาก chatbot")
    session_id: str = Field(..., description="Session ID")
    current_step: int = Field(..., description="ขั้นตอนปัจจุบัน (1-14)")
    collected_data: Dict[str, Any] = Field(default_factory=dict, description="ข้อมูลที่เก็บได้")
    is_waiting_confirmation: bool = Field(default=False, description="กำลังรอการยืนยันหรือไม่")
    is_complete: bool = Field(default=False, description="สนทนาเสร็จสมบูรณ์แล้วหรือไม่")
    
    class Config:
        json_schema_extra = {
            "example": {
                "response": "สวัสดีค่ะ! ยินดีต้อนรับสู่ LumoPack",
                "session_id": "sess_abc123",
                "current_step": 1,
                "collected_data": {},
                "is_waiting_confirmation": False,
                "is_complete": False
            }
        }


class SessionResponse(BaseModel):
    """Response model สำหรับ session info"""
    session_id: str
    current_step: int
    collected_data: Dict[str, Any]
    message_count: int
    is_complete: bool
    created_at: str
    last_activity: str


class SessionListResponse(BaseModel):
    """Response model สำหรับ list sessions"""
    sessions: List[Dict[str, Any]]
    total: int


# ===================================
# Router
# ===================================

router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
    responses={
        404: {"description": "Session not found"},
        500: {"description": "Internal server error"}
    }
)

# Initialize chatbot flow manager
chatbot_manager = ChatbotFlowManager()


# ===================================
# Endpoints
# ===================================

@router.post("/message", response_model=ChatMessageResponse, status_code=status.HTTP_200_OK)
async def send_message(request: ChatMessageRequest):
    """
    ส่งข้อความไปยัง chatbot
    
    - **message**: ข้อความจากลูกค้า
    - **session_id**: Session ID (Optional - ถ้าไม่มีจะสร้างใหม่)
    - **user_id**: User ID (Optional)
    
    Returns:
    - **response**: ข้อความตอบกลับ
    - **session_id**: Session ID
    - **current_step**: ขั้นตอนปัจจุบัน
    - **collected_data**: ข้อมูลที่เก็บได้
    """
    try:
        # สร้าง session_id ใหม่ถ้าไม่มี
        if not request.session_id:
            request.session_id = f"sess_{uuid.uuid4().hex[:12]}"
        
        # ดึง session จาก storage หรือสร้างใหม่
        state = session_storage.get_session(request.session_id)
        if not state:
            state = ConversationState(session_id=request.session_id)
        
        # ประมวลผลข้อความ
        # chatbot_flow.process_message(user_message, state) → Tuple[str, ConversationState]
        response_text, state = await chatbot_manager.process_message(
            user_message=request.message,
            state=state
        )
        
        # บันทึก state กลับเข้า storage
        session_storage.update_session(request.session_id, state)
        
        # Return response
        return ChatMessageResponse(
            response=response_text,
            session_id=request.session_id,
            current_step=int(state.current_step),
            collected_data=state.collected_data,
            is_waiting_confirmation=getattr(state, 'is_waiting_for_confirmation', False),
            is_complete=int(state.current_step) >= 14
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing message: {str(e)}"
        )


@router.get("/session/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """
    ดึงข้อมูล session
    
    - **session_id**: Session ID ที่ต้องการดู
    
    Returns:
    - ข้อมูล session ทั้งหมด
    """
    try:
        # ดึง session
        state = session_storage.get_session(session_id)
        
        if not state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        # Return session info
        return SessionResponse(
            session_id=state.session_id,
            current_step=int(state.current_step),  # แปลง enum เป็น int
            collected_data=state.collected_data,
            message_count=len(state.messages),
            is_complete=state.current_step == 14,  # ChatbotStep.END
            created_at=state.created_at.isoformat(),
            last_activity=state.last_activity.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving session: {str(e)}"
        )


@router.delete("/session/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str):
    """
    ลบ session
    
    - **session_id**: Session ID ที่ต้องการลบ
    """
    try:
        state = session_storage.get_session(session_id)
        
        if not state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        # ลบ session
        session_storage.delete_session(session_id)
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting session: {str(e)}"
        )


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions():
    """
    แสดง session ทั้งหมด (สำหรับ debugging)
    
    Returns:
    - รายการ session ทั้งหมด
    """
    try:
        sessions = []
        
        # ดึง sessions จาก storage
        for session_id, state in session_storage._sessions.items():
            sessions.append({
                "session_id": state.session_id,
                "current_step": int(state.current_step),  # แปลง enum เป็น int
                "message_count": len(state.messages),
                "created_at": state.created_at.isoformat(),
                "last_activity": state.last_activity.isoformat()
            })
        
        return SessionListResponse(
            sessions=sessions,
            total=len(sessions)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing sessions: {str(e)}"
        )


@router.post("/session/{session_id}/reset", status_code=status.HTTP_200_OK)
async def reset_session(session_id: str):
    """
    Reset session ให้กลับไปเริ่มต้นใหม่
    
    - **session_id**: Session ID ที่ต้องการ reset
    """
    try:
        state = session_storage.get_session(session_id)
        
        if not state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        # Reset state
        state.current_step = 1  # ChatbotStep.GREETING
        state.collected_data = {}
        state.temp_data = {}
        state.is_waiting_for_confirmation = False
        state.messages = []
        
        # Update session
        session_storage.update_session(session_id, state)
        
        return {
            "message": "Session reset successfully",
            "session_id": session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting session: {str(e)}"
        )


@router.get("/session/{session_id}/history")
async def get_conversation_history(session_id: str, limit: Optional[int] = None):
    """
    ดึงประวัติการสนทนา
    
    - **session_id**: Session ID
    - **limit**: จำนวนข้อความสูงสุดที่ต้องการ (Optional)
    
    Returns:
    - ประวัติการสนทนา
    """
    try:
        state = session_storage.get_session(session_id)
        
        if not state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        # ดึง conversation history
        history = state.get_conversation_history(limit=limit)
        
        return {
            "session_id": session_id,
            "message_count": len(history),
            "messages": history
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving history: {str(e)}"
        )