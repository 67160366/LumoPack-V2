"""
Structure Step Handlers (Steps 1-6)
จัดการขั้นตอนเก็บ requirement โครงสร้างกล่อง

Steps:
1. Greeting
2. Product Type (บังคับ)
3. Box Type + Material (บังคับ, มี sub_step)
4. Inner (Optional, เฉพาะ Die-cut)
5. Dimensions + Quantity (บังคับ, รับแยกรอบได้ผ่าน partial_data)
6. Checkpoint 1 (สรุป + รองรับแก้ไข/เพิ่ม ผ่าน edit_mode)
"""

import re
from models.chat_state import ConversationState, ChatbotStep
from services.data_extractor import (
    extract_product_type, extract_box_type, extract_material,
    extract_inner, extract_dimensions, extract_quantity,
    is_confirmation, is_rejection, is_skip_response,
    is_add_request, detect_edit_target,
)
from utils.prompts import SYSTEM_PROMPT, get_prompt_for_step


def _make_result(**kwargs):
    """สร้าง StepResult (lazy import เพื่อหลีกเลี่ยง circular)"""
    from services.chatbot_flow import StepResult
    return StepResult(**kwargs)


class StructureStepHandlers:
    """Handlers สำหรับ Steps 1-6"""

    def __init__(self, groq_service):
        self.groq = groq_service

    # ===================================
    # Step 1: Greeting
    # ===================================
    async def handle_greeting(self, state: ConversationState):
        prompt = get_prompt_for_step(1)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=[]
        )
        return _make_result(response=response, advance=True)

    # ===================================
    # Step 2: Product Type (บังคับ)
    # ===================================
    async def handle_product_type(self, user_message: str, state: ConversationState):
        product_type = extract_product_type(user_message)

        prompt = get_prompt_for_step(2, user_message=user_message)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=5)
        )

        if product_type:
            result = _make_result(
                response=response, advance=True,
                update_data={"product_type": product_type}
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        # ไม่สามารถ extract ได้ → LLM ถามซ้ำ
        return _make_result(response=response)

    # ===================================
    # Step 3: Box Type + Material (sub_step)
    # ===================================
    async def handle_box_type(self, user_message: str, state: ConversationState):
        """
        sub_step 0: ถามประเภทกล่อง (RSC / Die-cut)
        sub_step 1: ถามวัสดุ
        """
        if state.sub_step == 0:
            return await self._handle_box_type_selection(user_message, state)
        elif state.sub_step == 1:
            return await self._handle_material_selection(user_message, state)

        return _make_result(response="ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ")

    async def _handle_box_type_selection(self, user_message: str, state: ConversationState):
        """Sub-step 0: เก็บ box_type"""
        box_type = extract_box_type(user_message)

        if box_type:
            material_opts = self._get_material_options(box_type)
            prompt = get_prompt_for_step(
                3, user_message=user_message,
                product_type=state.collected_data.get("product_type", "")
            )
            response = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT,
                user_message=prompt,
                conversation_history=state.get_conversation_history(limit=5)
            )
            mat_msg = self._format_material_question(box_type, material_opts)
            response += f"\n\n{mat_msg}"

            return _make_result(
                response=response,
                merge_partial={"box_type": box_type},
                update_sub_step=1
            )

        # ไม่รู้จัก → ถามใหม่
        prompt = get_prompt_for_step(
            3, user_message=user_message,
            product_type=state.collected_data.get("product_type", "")
        )
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=5)
        )
        return _make_result(response=response)

    async def _handle_material_selection(self, user_message: str, state: ConversationState):
        """Sub-step 1: เก็บ material"""
        box_type = state.partial_data.get("box_type", "rsc")
        material = extract_material(user_message, box_type)

        if material:
            state.commit_partial_data()
            result = _make_result(
                response=f"เรียบร้อยค่ะ! เลือกกล่อง {box_type.upper()} วัสดุ {material} 📦",
                advance=True,
                update_data={"box_type": box_type, "material": material}
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        # ไม่รู้จัก → ถามใหม่
        material_opts = self._get_material_options(box_type)
        return _make_result(
            response=f"ขออภัยค่ะ ไม่ค่อยเข้าใจ กรุณาเลือกวัสดุอีกครั้งนะคะ\n\n"
                     f"{self._format_material_question(box_type, material_opts)}"
        )

    def _get_material_options(self, box_type: str) -> dict:
        if box_type == "rsc":
            return {
                "corrugated_2layer": "กระดาษลูกฟูก 2 ชั้น (แข็งแรง ราคาประหยัด)",
                "kraft_200gsm": "กระดาษคราฟท์ 200 GSM (ลุค Eco-friendly)",
            }
        return {
            "corrugated_2layer": "กระดาษลูกฟูก 2 ชั้น",
            "cardboard": "กระดาษแข็ง/จั่วปัง (หนา ทนทาน)",
            "art_300gsm": "กระดาษอาร์ต 300 GSM (พิมพ์สวย สีสด)",
            "whiteboard_350gsm": "กล่องขาว/กล่องแป้ง 350 GSM (ราคาประหยัด)",
        }

    def _format_material_question(self, box_type: str, options: dict) -> str:
        lines = ["🧱 เลือกวัสดุสำหรับกล่องค่ะ:"]
        for i, (_, desc) in enumerate(options.items(), 1):
            lines.append(f"  {i}. {desc}")
        return "\n".join(lines)

    # ===================================
    # Step 4: Inner (Optional, เฉพาะ Die-cut)
    # ===================================
    async def handle_inner(self, user_message: str, state: ConversationState):
        inner = extract_inner(user_message)

        prompt = get_prompt_for_step(4, user_message=user_message)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=5)
        )

        if inner == "skip":
            result = _make_result(response=response, advance=True)
            if state.edit_mode:
                result.exit_edit = True
            return result

        if inner:
            result = _make_result(
                response=response, advance=True,
                update_data={"inner": inner}
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        # extract ไม่ได้ → ถามซ้ำ (ไม่ advance เพื่อป้องกันข้อมูลหาย)
        # LLM response จะถามลูกค้าอีกครั้งว่าต้องการ Inner หรือไม่
        return _make_result(response=response)

    # ===================================
    # Step 5: Dimensions + Quantity (รับแยกรอบได้)
    # ===================================
    async def handle_dimensions(self, user_message: str, state: ConversationState):
        """
        รองรับ:
        1. ส่งมาพร้อมกัน: "20x15x10 จำนวน 1000"
        2. dimensions ก่อน → ถาม quantity
        3. quantity ก่อน → ถาม dimensions
        """
        dims = extract_dimensions(user_message)
        qty = extract_quantity(user_message)

        # Merge กับ partial จากรอบก่อน
        prev_dims = state.partial_data.get("dimensions")
        prev_qty = state.partial_data.get("quantity")
        final_dims = dims or prev_dims
        final_qty = qty or prev_qty

        # ได้ทั้งคู่ → advance
        if final_dims and final_qty:
            state.commit_partial_data()
            prompt = get_prompt_for_step(5, user_message=user_message)
            response = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT,
                user_message=prompt,
                conversation_history=state.get_conversation_history(limit=5)
            )
            result = _make_result(
                response=response, advance=True,
                update_data={"dimensions": final_dims, "quantity": final_qty}
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        # ได้แค่ dimensions → ถาม quantity
        if dims and not final_qty:
            return _make_result(
                response=(
                    f"ขนาดกล่อง {dims['width']}×{dims['length']}×{dims['height']} ซม. "
                    f"รับทราบค่ะ 📐\n\n"
                    f"ขอทราบจำนวนที่ต้องการผลิตด้วยนะคะ (ขั้นต่ำ 500 ชิ้น)"
                ),
                merge_partial={"dimensions": dims}
            )

        # ได้แค่ quantity → ถาม dimensions
        if qty and not final_dims:
            return _make_result(
                response=(
                    f"จำนวน {qty:,} ชิ้น รับทราบค่ะ 📦\n\n"
                    f"ขอทราบขนาดกล่องด้วยนะคะ (กว้าง×ยาว×สูง เป็น ซม.)"
                ),
                merge_partial={"quantity": qty}
            )

        # ไม่ได้เลย → ถามใหม่
        prompt = get_prompt_for_step(5, user_message=user_message)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=5)
        )

        # เช็ค quantity < 500
        small_nums = [int(n) for n in re.findall(r'\d+', user_message) if 0 < int(n) < 500]
        if small_nums:
            response += "\n\n⚠️ จำนวนขั้นต่ำในการสั่งผลิตคือ 500 ชิ้นค่ะ"

        return _make_result(response=response)

    # ===================================
    # Step 6: Checkpoint 1
    # ===================================
    async def handle_checkpoint1(self, user_message: str, state: ConversationState):
        """
        สรุป + ยืนยัน/แก้ไข/เพิ่ม
        
        - แสดง summary → state.is_waiting_for_confirmation = True
        - ยืนยัน → advance to step 7
        - แก้ไข → enter_edit_mode → handler ของ target step → กลับมา step 6
        - เพิ่ม → enter_edit_mode (append) → กลับมา step 6
        """
        # แสดง summary ครั้งแรก
        if not state.is_waiting_for_confirmation:
            prompt = get_prompt_for_step(6, collected_data=state.collected_data)
            response = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT,
                user_message=prompt,
                conversation_history=state.get_conversation_history(limit=3)
            )
            state.is_waiting_for_confirmation = True
            return _make_result(response=response)

        # ยืนยัน
        if is_confirmation(user_message):
            state.is_structure_confirmed = True
            state.is_waiting_for_confirmation = False
            return _make_result(
                response="เยี่ยมเลยค่ะ! ✅ ตอนนี้เราจะมาดูเรื่องการออกแบบและตกแต่งกล่องกันนะคะ 🎨",
                advance=True
            )

        # แก้ไข / เพิ่ม
        if is_rejection(user_message):
            target = detect_edit_target(user_message)
            if target:
                action = "append" if is_add_request(user_message) else "replace"
                state.enter_edit_mode(
                    target_step=target,
                    checkpoint=ChatbotStep.CHECKPOINT_1,
                    action=action
                )
                label = "เพิ่ม" if action == "append" else "แก้ไข"
                return _make_result(response=f"ได้เลยค่ะ! {label}ข้อมูลได้เลยนะคะ 📝")

            # detect ไม่ได้ → ถามให้ชัด
            state.is_waiting_for_confirmation = False
            return _make_result(
                response=(
                    "ไม่เป็นไรค่ะ บอกได้เลยว่าต้องการแก้ไขส่วนไหนคะ?\n\n"
                    "เช่น: แก้ไขประเภทสินค้า / แก้ไขขนาด / เพิ่ม Inner"
                )
            )

        # ไม่เข้าใจ
        return _make_result(
            response="ขอโทษค่ะ ไม่ค่อยเข้าใจ ช่วยตอบว่า 'ถูกต้อง' หรือ บอกส่วนที่ต้องการแก้ไขได้เลยค่ะ 🙏"
        )