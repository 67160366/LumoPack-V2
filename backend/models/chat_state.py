"""
Chat State Management (Refactored)
จัดการ state ของ conversation ระหว่างแชทบอทกับลูกค้า

Changes from original:
- เพิ่ม sub_step สำหรับ step ที่ต้องถามหลายคำถาม
- เพิ่ม edit_mode สำหรับ checkpoint edits
- เพิ่ม partial_data สำหรับเก็บข้อมูลชั่วคราว
- เพิ่ม confirmation flags แยก structure/design
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import IntEnum


# ===================================
# 1. Chatbot Steps (14 ขั้นตอน)
# ===================================
class ChatbotStep(IntEnum):
    """ขั้นตอนต่างๆ ของแชทบอท (ตาม Requirement.pdf)"""
    
    GREETING = 1
    COLLECT_PRODUCT_TYPE = 2
    COLLECT_BOX_TYPE = 3            # + เลือกวัสดุ
    COLLECT_INNER = 4               # Optional, เฉพาะ Die-cut
    COLLECT_DIMENSIONS = 5          # ขนาดกล่อง + จำนวนผลิต
    CHECKPOINT_1 = 6
    COLLECT_MOOD_TONE = 7           # Optional
    COLLECT_LOGO = 8                # Optional, มี sub_step
    COLLECT_SPECIAL_EFFECTS = 9     # Optional
    CHECKPOINT_2 = 10
    GENERATE_MOCKUP = 11
    GENERATE_QUOTE = 12
    CONFIRM_ORDER = 13
    END = 14


# ===================================
# 2. Step Transition Map
# ===================================
DEFAULT_NEXT_STEP = {
    1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7,
    7: 8, 8: 9, 9: 10, 10: 11, 11: 12,
    12: 13, 13: 14, 14: 14,
}

OPTIONAL_STEPS = {
    ChatbotStep.COLLECT_INNER,
    ChatbotStep.COLLECT_MOOD_TONE,
    ChatbotStep.COLLECT_LOGO,
    ChatbotStep.COLLECT_SPECIAL_EFFECTS,
}

# Mapping step → field name ใน collected_data (สำหรับ checkpoint edit detection)
STEP_TO_FIELD = {
    2: ["product_type"],
    3: ["box_type", "material"],
    4: ["inner"],
    5: ["dimensions", "quantity", "weight_kg", "flute_type"],
    7: ["mood_tone"],
    8: ["has_logo", "logo_positions"],
    9: ["special_effects"],
}

# Mapping keywords → target step (สำหรับ detect ว่า user อยากแก้อะไร)
EDIT_KEYWORDS_TO_STEP = {
    2: ["ประเภทสินค้า", "product type", "สินค้า"],
    3: ["ประเภทกล่อง", "box type", "กล่อง", "วัสดุ", "material"],
    4: ["inner", "กันกระแทก", "เคลือบกันชื้น"],
    5: ["ขนาด", "dimension", "จำนวน", "quantity", "ชิ้น", "น้ำหนัก", "weight", "ลอน", "flute"],
    7: ["mood", "tone", "สไตล์", "โทนสี"],
    8: ["logo", "โลโก้", "ตำแหน่ง"],
    9: ["ลูกเล่น", "เคลือบ", "ป๊ัม", "ฟอยล์", "special"],
}


# ===================================
# 3. Message Model
# ===================================
class ChatMessage(BaseModel):
    """ข้อความในการสนทนา"""
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)
    step: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


# ===================================
# 4. Conversation State (Refactored)
# ===================================
class ConversationState(BaseModel):
    """State ของการสนทนาทั้งหมด"""
    
    # --- Session Info ---
    session_id: str
    user_id: Optional[str] = None
    
    # --- Step Tracking ---
    current_step: ChatbotStep = ChatbotStep.GREETING
    sub_step: int = 0  # 0 = เริ่มต้น, 1+ = sub-step ถัดไป
    
    # --- Edit Mode (สำหรับ Checkpoint) ---
    edit_mode: bool = False
    edit_target_step: Optional[int] = None
    return_to_checkpoint: Optional[int] = None
    edit_action: Optional[str] = None  # "replace" | "append"
    
    # --- Confirmation Flags ---
    is_waiting_for_confirmation: bool = False
    is_structure_confirmed: bool = False
    is_design_confirmed: bool = False
    
    # --- Data Storage ---
    messages: List[ChatMessage] = []
    collected_data: Dict[str, Any] = {}
    partial_data: Dict[str, Any] = {}  # ข้อมูลชั่วคราวระหว่างรอข้อมูลเพิ่ม
    temp_data: Dict[str, Any] = {}
    
    # --- Flags ---
    is_complete: bool = False
    
    # --- Metadata ---
    created_at: datetime = Field(default_factory=datetime.now)
    last_activity: datetime = Field(default_factory=datetime.now)
    
    # ===================================
    # Message Management
    # ===================================
    def add_message(self, role: str, content: str, metadata: Optional[Dict] = None):
        """เพิ่มข้อความลงใน history"""
        self.messages.append(ChatMessage(
            role=role, content=content,
            step=self.current_step, metadata=metadata
        ))
        self.last_activity = datetime.now()
    
    def get_conversation_history(self, limit: Optional[int] = None) -> List[Dict[str, str]]:
        """ดึง conversation history สำหรับ LLM"""
        msgs = self.messages[-limit:] if limit else self.messages
        return [{"role": m.role, "content": m.content} for m in msgs]
    
    # ===================================
    # Step Navigation
    # ===================================
    def advance_step(self, next_step_override: Optional[int] = None):
        """ไป step ถัดไป พร้อม reset sub_step"""
        if next_step_override is not None:
            self.current_step = ChatbotStep(next_step_override)
        else:
            nxt = DEFAULT_NEXT_STEP.get(self.current_step, self.current_step + 1)
            self.current_step = ChatbotStep(min(nxt, ChatbotStep.END))
        self.sub_step = 0
        self.is_waiting_for_confirmation = False
        self.partial_data = {}
    
    # ===================================
    # Edit Mode
    # ===================================
    def enter_edit_mode(self, target_step: int, checkpoint: int, action: str = "replace"):
        """เข้าโหมดแก้ไขจาก checkpoint"""
        self.edit_mode = True
        self.edit_target_step = target_step
        self.return_to_checkpoint = checkpoint
        self.edit_action = action
        self.current_step = ChatbotStep(target_step)
        self.sub_step = 0
        self.is_waiting_for_confirmation = False
    
    def exit_edit_mode(self):
        """ออกจากโหมดแก้ไข → กลับไป checkpoint"""
        checkpoint = self.return_to_checkpoint
        self.edit_mode = False
        self.edit_target_step = None
        self.return_to_checkpoint = None
        self.edit_action = None
        if checkpoint:
            self.current_step = ChatbotStep(checkpoint)
            self.sub_step = 0
            self.is_waiting_for_confirmation = False
    
    # ===================================
    # Data Management
    # ===================================
    def update_collected_data(self, data: Dict[str, Any]):
        """อัปเดต collected_data (รองรับ append mode สำหรับ edit)"""
        if self.edit_mode and self.edit_action == "append":
            for key, value in data.items():
                existing = self.collected_data.get(key)
                if isinstance(existing, list) and isinstance(value, list):
                    self.collected_data[key] = existing + value
                else:
                    self.collected_data[key] = value
        else:
            self.collected_data.update(data)
    
    def merge_partial_data(self, data: Dict[str, Any]):
        """เก็บข้อมูลชั่วคราว (เช่น dimensions มาก่อน quantity)"""
        self.partial_data.update(data)
    
    def commit_partial_data(self):
        """ย้าย partial_data ไป collected_data"""
        if self.partial_data:
            self.update_collected_data(self.partial_data)
            self.partial_data = {}
    
    # ===================================
    # Validation Helpers
    # ===================================
    def is_optional_step(self) -> bool:
        return self.current_step in OPTIONAL_STEPS
    
    def should_skip_inner(self) -> bool:
        """RSC ไม่ต้องถาม Inner"""
        return self.collected_data.get("box_type") == "rsc"
    
    def is_structure_complete(self) -> bool:
        required = ["product_type", "box_type", "dimensions", "quantity"]
        return all(f in self.collected_data for f in required)
    
    def get_missing_required_fields(self) -> List[str]:
        missing = []
        checks = {
            "product_type": "ประเภทสินค้า",
            "box_type": "ประเภทกล่อง",
            "dimensions": "ขนาดกล่อง",
            "quantity": "จำนวนผลิต",
        }
        for field, label in checks.items():
            if field not in self.collected_data:
                missing.append(label)
        return missing


# ===================================
# 5. Session Storage (In-Memory)
# ===================================
class SessionStorage:
    """เก็บ session data ชั่วคราว (ควรย้ายไป Redis/DB ในอนาคต)"""
    
    def __init__(self):
        self._sessions: Dict[str, ConversationState] = {}
    
    def create_session(self, session_id: str, user_id: Optional[str] = None) -> ConversationState:
        state = ConversationState(session_id=session_id, user_id=user_id)
        self._sessions[session_id] = state
        return state
    
    def get_session(self, session_id: str) -> Optional[ConversationState]:
        return self._sessions.get(session_id)
    
    def update_session(self, session_id: str, state: ConversationState):
        self._sessions[session_id] = state
    
    def delete_session(self, session_id: str):
        self._sessions.pop(session_id, None)
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        return [
            {
                "session_id": sid,
                "current_step": s.current_step,
                "message_count": len(s.messages),
                "is_complete": s.is_complete,
                "last_activity": s.last_activity.isoformat(),
            }
            for sid, s in self._sessions.items()
        ]
    
    def cleanup_old_sessions(self, max_age_hours: int = 24) -> int:
        now = datetime.now()
        to_delete = [
            sid for sid, s in self._sessions.items()
            if (now - s.last_activity).total_seconds() / 3600 > max_age_hours
        ]
        for sid in to_delete:
            self.delete_session(sid)
        return len(to_delete)


session_storage = SessionStorage()