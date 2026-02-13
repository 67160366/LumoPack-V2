"""
Chatbot Flow Manager (Refactored)
State Machine Architecture — Orchestrator

Changes:
- StepResult pattern แทน if-elif chain
- Edit mode support สำหรับ checkpoint edits
- Step skip logic (RSC ข้าม Inner)
- Handlers แยก 3 ไฟล์ตาม phase
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional, Tuple
from models.chat_state import ConversationState, ChatbotStep
from services.step_handlers.structure_steps import StructureStepHandlers
from services.step_handlers.design_steps import DesignStepHandlers
from services.step_handlers.finalize_steps import FinalizeStepHandlers
from services.groq_service import get_groq_service


# ===================================
# StepResult — ทุก handler return ค่านี้
# ===================================
@dataclass
class StepResult:
    """ผลลัพธ์จากแต่ละ step handler"""
    response: str
    advance: bool = False                       # ไป step ถัดไปไหม
    next_step_override: Optional[int] = None    # บังคับไป step ไหน
    update_data: Optional[Dict[str, Any]] = None
    update_sub_step: Optional[int] = None
    merge_partial: Optional[Dict[str, Any]] = None
    exit_edit: bool = False                     # ออกจาก edit mode
    post_advance_waiting: bool = False          # หลัง advance แล้ว set is_waiting_for_confirmation=True
                                                # ใช้เมื่อ handler generate checkpoint summary ในรอบเดียวกัน


# ===================================
# ChatbotFlowManager (Orchestrator)
# ===================================
class ChatbotFlowManager:
    """
    State Machine Orchestrator
    
    1. Route message → handler ตาม current_step
    2. Apply StepResult (update data, advance step)
    3. จัดการ edit mode & step skip logic

    ─────────────────────────────────────────────
    FULL FLOW OVERVIEW (14 Steps)
    ─────────────────────────────────────────────
    Phase 1 — Structure (Steps 1-6)  →  structure_steps.py
      1  GREETING            handle_greeting            [auto-advance]
      2  PRODUCT_TYPE        handle_product_type        [required]
      3  BOX_TYPE            handle_box_type            [required, sub_step: box→material]
      4  INNER               handle_inner               [optional, die-cut only, multi-select 3 กลุ่ม]
         └─ skip if RSC (should_skip_inner)
      5  DIMENSIONS          handle_dimensions          [required, partial_data: dims+qty แยกรอบได้]
      6  CHECKPOINT_1        handle_checkpoint1         [สรุป+ยืนยัน, edit_mode support]

    Phase 2 — Design (Steps 7-10)  →  design_steps.py
      7  MOOD_TONE           handle_mood_tone           [optional, free text]
      8  LOGO                handle_logo                [optional, sub_step: has_logo→positions]
      9  SPECIAL_EFFECTS     handle_special_effects     [optional, multi-select, sub_step: block check]
      10 CHECKPOINT_2        handle_checkpoint2         [สรุป+ยืนยัน, edit_mode support]

    Phase 3 — Finalize (Steps 11-14)  →  finalize_steps.py
      11 GENERATE_MOCKUP     handle_mockup              [sub_step 0:แสดง, 1:รอ user → advance]
      12 GENERATE_QUOTE      handle_quote               [คำนวณ pricing, sub_step 0:คำนวณ, 1:รอ]
      13 CONFIRM_ORDER       handle_confirm             [ยืนยัน/back to 11 (mockup)/back to 10]
      14 END                 handle_end                 [จบ, is_complete=True]

    ─────────────────────────────────────────────
    Special Mechanics
    ─────────────────────────────────────────────
    edit_mode:     Checkpoint → enter_edit_mode(target, checkpoint) → handler → exit_edit_mode → checkpoint
    partial_data:  Step 5 dims/qty อาจมาแยกรอบ → merge_partial → commit เมื่อครบ
    skip logic:    RSC → ข้าม Step 4 (inner) ผ่าน _resolve_next_step
    inner format:  List[Dict] — cushion→inner_type, moisture/food_grade→coatings ใน to_pricing_request
    """
    
    def __init__(self):
        self.groq_service = get_groq_service()
        self.structure_handlers = StructureStepHandlers(self.groq_service)
        self.design_handlers = DesignStepHandlers(self.groq_service)
        self.finalize_handlers = FinalizeStepHandlers(self.groq_service)
    
    # ===================================
    # Main Entry Point
    # ===================================
    async def process_message(
        self,
        user_message: str,
        state: ConversationState
    ) -> Tuple[str, ConversationState]:
        """
        ประมวลผลข้อความจากลูกค้า
        
        Flow:
        1. บันทึก user message
        2. Route → handler
        3. Apply StepResult
        4. บันทึก bot response
        """
        state.add_message("user", user_message)
        
        result = await self._route_to_handler(user_message, state)
        self._apply_result(result, state)
        
        state.add_message("assistant", result.response)
        return result.response, state
    
    # ===================================
    # Router
    # ===================================
    async def _route_to_handler(
        self, user_message: str, state: ConversationState
    ) -> StepResult:
        """Route ไปยัง handler ตาม current_step"""
        
        step = state.current_step
        
        # --- Structure Phase (Steps 1-6) ---
        handler_map = {
            ChatbotStep.GREETING:             lambda: self.structure_handlers.handle_greeting(state),
            ChatbotStep.COLLECT_PRODUCT_TYPE:  lambda: self.structure_handlers.handle_product_type(user_message, state),
            ChatbotStep.COLLECT_BOX_TYPE:      lambda: self.structure_handlers.handle_box_type(user_message, state),
            ChatbotStep.COLLECT_INNER:         lambda: self.structure_handlers.handle_inner(user_message, state),
            ChatbotStep.COLLECT_DIMENSIONS:    lambda: self.structure_handlers.handle_dimensions(user_message, state),
            ChatbotStep.CHECKPOINT_1:          lambda: self.structure_handlers.handle_checkpoint1(user_message, state),
            # --- Design Phase (Steps 7-10) ---
            ChatbotStep.COLLECT_MOOD_TONE:     lambda: self.design_handlers.handle_mood_tone(user_message, state),
            ChatbotStep.COLLECT_LOGO:          lambda: self.design_handlers.handle_logo(user_message, state),
            ChatbotStep.COLLECT_SPECIAL_EFFECTS: lambda: self.design_handlers.handle_special_effects(user_message, state),
            ChatbotStep.CHECKPOINT_2:          lambda: self.design_handlers.handle_checkpoint2(user_message, state),
            # --- Finalize Phase (Steps 11-14) ---
            ChatbotStep.GENERATE_MOCKUP:       lambda: self.finalize_handlers.handle_mockup(user_message, state),
            ChatbotStep.GENERATE_QUOTE:        lambda: self.finalize_handlers.handle_quote(user_message, state),
            ChatbotStep.CONFIRM_ORDER:         lambda: self.finalize_handlers.handle_confirm(user_message, state),
            ChatbotStep.END:                   lambda: self.finalize_handlers.handle_end(state),
        }
        
        handler = handler_map.get(step)
        if handler:
            return await handler()
        
        return StepResult(
            response="ขออภัยค่ะ มีข้อผิดพลาดเกิดขึ้น กรุณาเริ่มใหม่อีกครั้งค่ะ"
        )
    
    # ===================================
    # Apply StepResult → Update State
    # ===================================
    def _apply_result(self, result: StepResult, state: ConversationState):
        """นำ StepResult ไป update state"""
        
        # 1. Update collected_data
        if result.update_data:
            state.update_collected_data(result.update_data)
        
        # 2. Merge partial data
        if result.merge_partial:
            state.merge_partial_data(result.merge_partial)
        
        # 3. Update sub_step
        if result.update_sub_step is not None:
            state.sub_step = result.update_sub_step
        
        # 4. Handle edit mode exit → กลับไป checkpoint
        if result.exit_edit and state.edit_mode:
            state.exit_edit_mode()
            return
        
        # 5. Advance step (with smart skip logic)
        if result.advance:
            next_step = result.next_step_override or self._resolve_next_step(state)
            state.advance_step(next_step)
            # 6. Post-advance: restore waiting flag ถ้า handler pre-generated checkpoint
            #    (advance_step() จะ reset flag → ต้อง set คืนทีหลัง)
            if result.post_advance_waiting:
                state.is_waiting_for_confirmation = True
    
    # ===================================
    # Smart Step Skip Logic
    # ===================================
    def _resolve_next_step(self, state: ConversationState) -> Optional[int]:
        """
        ตัดสินใจ step ถัดไป โดยพิจารณา skip conditions
        None = ใช้ DEFAULT_NEXT_STEP
        """
        current = state.current_step
        
        # Step 3 (Box Type) → ถ้า RSC ข้ามไป Step 5 (ไม่ต้องถาม Inner)
        if current == ChatbotStep.COLLECT_BOX_TYPE:
            if state.should_skip_inner():
                return ChatbotStep.COLLECT_DIMENSIONS
        
        return None