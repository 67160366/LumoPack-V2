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
                f"⚠️ เกิดข้อผิดพลาดในการคำนวณราคาค่ะ ({str(e)})\n"
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
                # ❌ ไม่ advance ถ้า error (fix จากเดิม)
                return _make_result(
                    response=(
                        f"ขออภัยค่ะ เกิดข้อผิดพลาดในการคำนวณราคา 😔\n"
                        f"รายละเอียด: {str(e)}\n\n"
                        f"กรุณาลองใหม่อีกครั้ง หรือพิมพ์ 'ลองใหม่' ค่ะ"
                    )
                )

        # sub_step 1: user ตอบแล้ว → advance ไป confirm
        return _make_result(
            response="ขอบคุณค่ะ! คุณต้องการยืนยันคำสั่งซื้อหรือไม่คะ? ✅",
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
            state.is_complete = True
            return _make_result(response=response, advance=True)

        if is_rejection(user_message):
            msg_lower = user_message.lower()

            # อยากแก้ mockup → กลับไป step 11
            if any(w in msg_lower for w in ["mockup", "ม็อคอัพ", "ภาพ", "รูป", "กล่อง"]):
                return _make_result(
                    response="ได้เลยค่ะ! เดี๋ยวปรับ Mockup ให้ใหม่นะคะ 🎨",
                    advance=True,
                    next_step_override=ChatbotStep.GENERATE_MOCKUP
                )

            # อยากแก้ราคา/สเปค → กลับไป checkpoint 2
            if any(w in msg_lower for w in ["ราคา", "สเปค", "ลูกเล่น", "วัสดุ"]):
                return _make_result(
                    response="ได้เลยค่ะ! กลับไปตรวจสอบรายละเอียดใหม่นะคะ 📝",
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
            response="ขอโทษค่ะ ไม่ค่อยเข้าใจ ช่วยตอบว่า 'ยืนยัน' หรือ 'ต้องการแก้ไข' ได้ไหมคะ? 🙏"
        )

    # ===================================
    # Step 14: End
    # ===================================
    async def handle_end(self, state: ConversationState):
        prompt = get_prompt_for_step(14)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=[]
        )
        response += f"\n\n📌 หมายเลขอ้างอิง: {state.session_id}"

        # Auto-save order to Supabase (if configured)
        self._save_order_to_db(state)

        return _make_result(response=response)

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

            supabase.table("orders").insert({
                "session_id": state.session_id,
                "status": "pending",
                "collected_data": state.collected_data,
                "pricing": pricing,
                "grand_total": grand_total,
                "deposit_amount": round(grand_total * 0.5, 2),
            }).execute()
        except Exception as e:
            print(f"⚠️ Failed to save order to DB: {e}")

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