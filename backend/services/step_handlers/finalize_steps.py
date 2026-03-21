"""
Finalize Step Handlers (Steps 11-14)
จัดการขั้นตอนสุดท้าย: Mockup, ใบเสนอราคา, ยืนยัน, จบ

Steps:
11. Mockup (รอ user ดูก่อน → ไม่ auto-advance)
12. Quote (รอ user ดูก่อน → ไม่ auto-advance)
13. Confirm Order (รองรับย้อนกลับ step 11 ถ้าอยากแก้ mockup)
14. End

Critical fixes from original:
- Step 11-12 ไม่ auto-advance อีกต่อไป → รอ user response
- Step 12 ไม่ advance ถ้าคำนวณราคาล้มเหลว
- Step 13 รองรับ "แก้ไข mockup" → go back to step 11
"""

from typing import Dict
from models.chat_state import ConversationState, ChatbotStep
from models.requirement import CompleteRequirement
from services.data_extractor import is_confirmation, is_rejection
from services.pricing_calculator import get_price_estimate
from utils.prompts import SYSTEM_PROMPT, get_prompt_for_step


def _make_result(**kwargs):
    from services.chatbot_flow import StepResult
    return StepResult(**kwargs)


class FinalizeStepHandlers:
    """Handlers สำหรับ Steps 11-14"""

    def __init__(self, groq_service):
        self.groq = groq_service

    # ===================================
    # Step 11: Mockup (รอ user ดู)
    # ===================================
    async def handle_mockup(self, user_message: str, state: ConversationState):
        """
        แสดง Mockup + ใบเสนอราคาในรอบเดียว → advance ไป step 13 (confirm) ทันที

        ถูก call 2 แบบ:
        1. auto_execute จาก checkpoint 2 (user_message="") → generate mockup+quote → advance ไป step 13
        2. back-navigate จาก step 13 (user อยากแก้ mockup) → generate ใหม่อีกรอบ
        """
        # Generate mockup placeholder (อนาคต: ใช้ image generation)
        prompt11 = get_prompt_for_step(11)
        response_mockup = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt11,
            conversation_history=state.get_conversation_history(limit=3)
        )
        # TODO: แทน response_mockup ด้วย URL ภาพจริงเมื่อ implement image generation

        # Generate quote ทันที (ไม่รอ user)
        try:
            pricing_data = self._calculate_pricing(state.session_id, state.collected_data)
            state.temp_data["pricing"] = pricing_data
            prompt12 = get_prompt_for_step(12, pricing_data=pricing_data)
            response_quote = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT,
                user_message=prompt12,
                conversation_history=state.get_conversation_history(limit=3)
            )
        except Exception as e:
            response_quote = (
                f"เกิดข้อผิดพลาดในการคำนวณราคาค่ะ ({str(e)})\n"
                f"กรุณาแจ้งทีมงานเพื่อดำเนินการต่อค่ะ"
            )

        combined = response_mockup + "\n\n---\n\n" + response_quote
        # advance ไป step 13 (CONFIRM_ORDER) ข้าม sub_step 1 และ step 12 ที่เคย wait
        return _make_result(
            response=combined,
            advance=True,
            next_step_override=13,
        )

    # ===================================
    # Step 12: Quote (รอ user ดู)
    # ===================================
    async def handle_quote(self, user_message: str, state: ConversationState):
        """
        คำนวณราคา + แสดงใบเสนอราคา → รอ user ดู

        sub_step 0: คำนวณ + แสดง
        sub_step 1: รอ user response → advance ไป step 13
        """
        if state.sub_step == 0:
            try:
                pricing_data = self._calculate_pricing(state.session_id, state.collected_data)
                state.temp_data["pricing"] = pricing_data

                prompt = get_prompt_for_step(12, pricing_data=pricing_data)
                response = await self.groq.generate_response(
                    system_prompt=SYSTEM_PROMPT,
                    user_message=prompt,
                    conversation_history=state.get_conversation_history(limit=3)
                )

                return _make_result(response=response, update_sub_step=1)

            except Exception as e:
                # ไม่ advance ถ้า error (fix จากเดิม)
                return _make_result(
                    response=(
                        f"ขออภัยค่ะ เกิดข้อผิดพลาดในการคำนวณราคา\n"
                        f"รายละเอียด: {str(e)}\n\n"
                        f"กรุณาลองใหม่อีกครั้ง หรือพิมพ์ 'ลองใหม่' ค่ะ"
                    )
                )

        # sub_step 1: user ตอบแล้ว → advance ไป confirm
        return _make_result(
            response="ขอบคุณค่ะ! คุณต้องการยืนยันคำสั่งซื้อหรือไม่คะ?",
            advance=True
        )

    # ===================================
    # Step 13: Confirm Order
    # ===================================
    async def handle_confirm(self, user_message: str, state: ConversationState):
        """
        ยืนยันคำสั่งซื้อ
        - ยืนยัน → advance to step 14
        - แก้ mockup → go back to step 11
        - ปฏิเสธ → ถามว่าอยากแก้ไขอะไร
        """
        prompt = get_prompt_for_step(13, user_message=user_message)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=5)
        )

        if is_confirmation(user_message):
            return _make_result(response=response, advance=True, auto_execute=True)

        if is_rejection(user_message):
            msg_lower = user_message.lower()

            # อยากแก้ mockup → กลับไป step 11
            if any(w in msg_lower for w in ["mockup", "ม็อคอัพ", "ภาพ", "รูป", "กล่อง"]):
                return _make_result(
                    response="ได้เลยค่ะ! เดี๋ยวปรับ Mockup ให้ใหม่นะคะ",
                    advance=True,
                    next_step_override=ChatbotStep.GENERATE_MOCKUP
                )

            # อยากแก้ราคา/สเปค → กลับไป checkpoint 2
            if any(w in msg_lower for w in ["ราคา", "สเปค", "ลูกเล่น", "วัสดุ"]):
                return _make_result(
                    response="ได้เลยค่ะ! กลับไปตรวจสอบรายละเอียดใหม่นะคะ",
                    advance=True,
                    next_step_override=ChatbotStep.CHECKPOINT_2
                )

            # ไม่ระบุ → ถามให้ชัด
            return _make_result(
                response=(
                    "ไม่เป็นไรค่ะ บอกได้เลยว่าต้องการแก้ไขส่วนไหนคะ?\n\n"
                    "• แก้ไข Mockup (ภาพกล่อง)\n"
                    "• แก้ไขสเปค/ลูกเล่น\n"
                    "• หรือยืนยันคำสั่งซื้อ"
                )
            )

        # ไม่เข้าใจ
        return _make_result(
            response="ขอโทษค่ะ ไม่ค่อยเข้าใจ ช่วยตอบว่า 'ยืนยัน' หรือ 'ต้องการแก้ไข' ได้ไหมคะ?"
        )

    # ===================================
    # Step 14: End
    # ===================================
    async def handle_end(self, user_message: str, state: ConversationState):
        print(f"[handle_end] called for session {state.session_id}, sub_step={state.sub_step}")

        # sub_step 0: Ask for project name
        if state.sub_step == 0:
            return _make_result(
                response="เยี่ยมเลยค่ะ! ก่อนจบ ช่วยตั้งชื่อโปรเจกต์นี้ให้หน่อยนะคะ\nเช่น \"กล่องขนม A\" หรือ \"โปรเจกต์ทดสอบ\"",
                update_sub_step=1,
            )

        # sub_step 1: Receive project name → save + auto-download PDF
        project_name = user_message.strip()
        if not project_name:
            project_name = f"Project {state.session_id[:8]}"
        state.collected_data["project_name"] = project_name

        # Mark conversation as complete
        state.is_complete = True

        # Auto-save order & project to Supabase
        print(f"[handle_end] saving order, user_id={getattr(state, 'user_id', None)}")
        self._save_project_to_db(state)
        self._save_order_to_db(state)

        response = (
            f"บันทึกโปรเจกต์ \"{project_name}\" เรียบร้อยแล้วค่ะ\n\n"
            f"หมายเลขอ้างอิง: {state.session_id}\n\n"
            f"ขอบคุณที่ใช้บริการ LumoPack ค่ะ ทีมงานจะติดต่อกลับภายใน 1-2 วันทำการค่ะ"
        )

        return _make_result(
            response=response,
            update_data={"project_name": project_name},
            extra={"auto_download_pdf": f"/api/pricing/quote-pdf/{state.session_id}"},
        )

    # ===================================
    # Save Order to Supabase
    # ===================================
    def _save_order_to_db(self, state: ConversationState):
        """Save completed order to Supabase (best-effort, does not block chatbot)"""
        try:
            from services.supabase_client import get_supabase
            supabase = get_supabase()
            if not supabase:
                return

            pricing = state.temp_data.get("pricing") or state.collected_data.get("pricing", {})
            grand_total = pricing.get("grand_total", 0)

            order_data = {
                "session_id": state.session_id,
                "status": "pending",
                "collected_data": state.collected_data,
                "pricing": pricing,
                "grand_total": grand_total,
                "deposit_amount": round(grand_total * 0.5, 2),
            }
            # Include user_id if available (required for RLS)
            if getattr(state, 'user_id', None):
                order_data["user_id"] = state.user_id

            print(f"[save_order] inserting, grand_total={grand_total}")
            result = supabase.table("orders").insert(order_data).execute()
            print(f"[save_order] OK: {result.data[0]['id'] if result.data else 'NO DATA'}")
        except Exception as e:
            import traceback
            print(f"[save_order] FAILED: {e}")
            traceback.print_exc()

    def _save_project_to_db(self, state: ConversationState):
        """Save/Upsert project snapshot for customer project list."""
        try:
            from services.supabase_client import get_supabase
            from datetime import datetime
            supabase = get_supabase()
            if not supabase:
                return

            c = state.collected_data or {}
            dims = c.get("dimensions") or {}
            pricing = state.temp_data.get("pricing") or c.get("pricing", {}) or {}
            grand_total = pricing.get("grand_total", 0)
            box_type = c.get("box_type")
            qty = c.get("quantity")
            project_name = c.get("project_name") or f"{(box_type or 'project').upper()} {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"

            row = {
                "session_id": state.session_id,
                "name": project_name,
                "status": "ordered" if state.is_complete else "draft",
                "box_type": box_type,
                "dimensions": dims or None,
                "weight_kg": c.get("weight_kg"),
                "flute_type": c.get("flute_type"),
                "material": c.get("material"),
                "quantity": qty,
                "product_type": c.get("product_type"),
                "mood_tone": c.get("mood_tone"),
                "has_logo": bool(c.get("has_logo", False)),
                "logo_positions": c.get("logo_positions"),
                "inner_materials": c.get("inner"),
                "special_effects": c.get("special_effects"),
                "collected_data": c,
                "pricing": pricing if pricing else None,
                "grand_total": grand_total or None,
                "notes": "Auto-saved from chatbot flow",
            }
            if getattr(state, "user_id", None):
                row["user_id"] = state.user_id

            res = supabase.table("projects").insert(row).execute()
            print(f"[save_project] OK: {res.data[0]['id'] if res.data else 'NO DATA'}")
        except Exception as e:
            import traceback
            print(f"[save_project] FAILED: {e}")
            traceback.print_exc()

    # ===================================
    # Pricing Helper (ใช้ CompleteRequirement เป็น single source of truth)
    # ===================================
    def _calculate_pricing(self, session_id: str, collected_data: Dict) -> Dict:
        """
        คำนวณราคาจาก collected_data
        
        Flow:
        1. collected_data dict → CompleteRequirement (แปลง format)
        2. CompleteRequirement.to_pricing_request() → pricing request dict
        3. get_price_estimate(request) → pricing result
        
        Logic การแปลง inner (dict→str), แยก coatings/stampings,
        เลือก default material อยู่ใน CompleteRequirement เพียงที่เดียว
        """
        requirement = CompleteRequirement.from_collected_data(
            session_id=session_id,
            collected_data=collected_data
        )
        pricing_request = requirement.to_pricing_request()
        return get_price_estimate(pricing_request)