"""
Design Step Handlers (Steps 7-10)
จัดการขั้นตอนเก็บ requirement การออกแบบและตกแต่ง

Steps:
7.  Mood & Tone (Optional)
8.  Logo (Optional, มี sub_step: มีไหม → ตำแหน่ง)
9.  Special Effects (Optional, ถามบล็อกป๊ัม, รับหลายตัวเลือก)
10. Checkpoint 2 (สรุป + ยืนยัน/แก้ไข/เพิ่ม)
"""

from models.chat_state import ConversationState, ChatbotStep
from services.data_extractor import (
    extract_has_logo, extract_logo_positions,
    extract_special_effects, extract_has_existing_block,
    is_confirmation, is_rejection, is_skip_response,
    is_add_request, detect_edit_target,
)
from utils.prompts import SYSTEM_PROMPT, get_prompt_for_step


def _make_result(**kwargs):
    from services.chatbot_flow import StepResult
    return StepResult(**kwargs)


class DesignStepHandlers:
    """Handlers สำหรับ Steps 7-10"""

    def __init__(self, groq_service):
        self.groq = groq_service

    # ===================================
    # Step 7: Mood & Tone (Optional)
    # ===================================
    async def handle_mood_tone(self, user_message: str, state: ConversationState):
        prompt = get_prompt_for_step(7, user_message=user_message)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=5)
        )

        # Transition ไปถามโลโก้
        logo_transition = (
            "\n\nคุณมีโลโก้ที่อยากใส่บนกล่องไหมคะ? 🎨\n"
            "(หรือพิมพ์ 'ข้าม' ถ้ายังไม่มี)"
        )

        if is_skip_response(user_message):
            if not state.edit_mode:
                response += logo_transition
            result = _make_result(response=response, advance=True)
        else:
            if not state.edit_mode:
                response += logo_transition
            result = _make_result(
                response=response, advance=True,
                update_data={"mood_tone": user_message.strip()}
            )

        if state.edit_mode:
            result.exit_edit = True
        return result

    # ===================================
    # Step 8: Logo (Optional, มี sub_step)
    # ===================================
    async def handle_logo(self, user_message: str, state: ConversationState):
        """
        sub_step 0: ถาม "มีโลโก้ไหม?"
        sub_step 1: ถาม "ตำแหน่งไหน?"
        """
        if state.sub_step == 0:
            return await self._handle_logo_has(user_message, state)
        elif state.sub_step == 1:
            return await self._handle_logo_position(user_message, state)

        return _make_result(response="ขออภัยค่ะ เกิดข้อผิดพลาด")

    async def _handle_logo_has(self, user_message: str, state: ConversationState):
        """Sub-step 0: มีโลโก้ไหม?"""
        has_logo = extract_has_logo(user_message)

        prompt = get_prompt_for_step(8, user_message=user_message)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=5)
        )

        if has_logo is True:
            # มีโลโก้ → ถามตำแหน่ง (sub_step 1)
            return _make_result(
                response=response,
                update_data={"has_logo": True},
                update_sub_step=1
            )

        if has_logo is False:
            # ไม่มี → ข้ามไป step 9 พร้อม transition ถามลูกเล่นพิเศษ
            if not state.edit_mode:
                response += (
                    "\n\nสุดท้ายก่อนสรุป: คุณต้องการลูกเล่นพิเศษบนกล่องไหมคะ? ✨\n"
                    "เช่น: เคลือบเงา / เคลือบด้าน / ป๊ัมนูน / ป๊ัมฟอยล์\n"
                    "(หรือพิมพ์ 'ข้าม' ถ้าไม่ต้องการ)"
                )
            result = _make_result(
                response=response, advance=True,
                update_data={"has_logo": False}
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        # ไม่แน่ใจ → ถามอีกครั้ง
        return _make_result(response=response)

    async def _handle_logo_position(self, user_message: str, state: ConversationState):
        """Sub-step 1: ตำแหน่งโลโก้"""
        positions = extract_logo_positions(user_message)

        if positions:
            response = f"รับทราบค่ะ! จะใส่โลโก้ที่ตำแหน่ง: {', '.join(positions)} ✨"

            # เพิ่ม transition ไปถามลูกเล่นพิเศษ
            if not state.edit_mode:
                response += (
                    "\n\nคุณต้องการลูกเล่นพิเศษบนกล่องไหมคะ? ✨\n"
                    "เช่น: เคลือบเงา / เคลือบด้าน / ป๊ัมนูน / ป๊ัมฟอยล์\n"
                    "(หรือพิมพ์ 'ข้าม' ถ้าไม่ต้องการ)"
                )

            result = _make_result(
                response=response,
                advance=True,
                update_data={"logo_positions": positions}
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        # ไม่เข้าใจตำแหน่ง → ถามใหม่
        return _make_result(
            response=(
                "ขออภัยค่ะ ไม่ค่อยเข้าใจตำแหน่ง กรุณาเลือกจากตัวเลือกเหล่านี้นะคะ:\n\n"
                "• ด้านบน / ด้านล่าง / บนและล่าง\n"
                "• ด้านกว้าง 1 ด้าน / ด้านกว้าง 2 ด้าน\n"
                "• ด้านยาว 1 ด้าน / ด้านยาว 2 ด้าน\n"
                "• ด้านกว้างและยาว / ทุกด้าน"
            )
        )

    # ===================================
    # Step 9: Special Effects (Optional)
    # ===================================
    async def handle_special_effects(self, user_message: str, state: ConversationState):
        """
        sub_step 0: ถามลูกเล่นพิเศษ
        sub_step 1: ถ้าเลือกป๊ัม → ถามเรื่องบล็อกป๊ัม
        """
        if state.sub_step == 0:
            return await self._handle_effects_selection(user_message, state)
        elif state.sub_step == 1:
            return await self._handle_block_question(user_message, state)

        return _make_result(response="ขออภัยค่ะ เกิดข้อผิดพลาด")

    async def _handle_effects_selection(self, user_message: str, state: ConversationState):
        """Sub-step 0: เลือกลูกเล่นพิเศษ"""
        effects = extract_special_effects(user_message)

        prompt = get_prompt_for_step(9, user_message=user_message)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=5)
        )

        if effects == "skip":
            if state.edit_mode:
                result = _make_result(response=response, advance=True)
                result.exit_edit = True
                return result
            # Normal flow → pre-generate checkpoint 2
            prompt10 = get_prompt_for_step(10, collected_data=state.collected_data)
            response10 = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT,
                user_message=prompt10,
                conversation_history=state.get_conversation_history(limit=3)
            )
            return _make_result(
                response=response + "\n\n---\n\n" + response10,
                advance=True,
                post_advance_waiting=True,
            )

        if effects:
            # เช็คว่ามี stamping (ป๊ัม) หรือไม่ → ต้องถามเรื่องบล็อก
            has_stamping = any(e.get("category") == "stamping" for e in effects)

            if has_stamping:
                return _make_result(
                    response=(
                        f"{response}\n\n"
                        f"สำหรับการป๊ัม: เคยทำบล็อกป๊ัมกับทางเรามาก่อนหรือเปล่าคะ?\n"
                        f"(ถ้าไม่เคย จะมีค่าทำบล็อกพิมพ์เพิ่มค่ะ)"
                    ),
                    merge_partial={"special_effects": effects},
                    update_sub_step=1
                )

            # ไม่มี stamping → advance เลย
            if state.edit_mode:
                result = _make_result(
                    response=response, advance=True,
                    update_data={"special_effects": effects}
                )
                result.exit_edit = True
                return result

            # Normal flow → pre-generate checkpoint 2 ในรอบเดียวกัน
            # (ป้องกัน dead-end เหมือน step 5→6)
            state.update_collected_data({"special_effects": effects})
            prompt10 = get_prompt_for_step(10, collected_data=state.collected_data)
            response10 = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT,
                user_message=prompt10,
                conversation_history=state.get_conversation_history(limit=3)
            )
            return _make_result(
                response=response + "\n\n---\n\n" + response10,
                advance=True,
                update_data={"special_effects": effects},
                post_advance_waiting=True,
            )

        # extract ไม่ได้ → ถามซ้ำ (ไม่ advance เพื่อป้องกันข้อมูลหาย)
        # LLM response จะถามลูกค้าอีกครั้งว่าต้องการลูกเล่นพิเศษหรือไม่
        return _make_result(response=response)

    async def _handle_block_question(self, user_message: str, state: ConversationState):
        """Sub-step 1: ถามเรื่องบล็อกป๊ัม"""
        has_block = extract_has_existing_block(user_message)

        if has_block is not None:
            # อัปเดต has_block ในแต่ละ stamping effect
            effects = state.partial_data.get("special_effects", [])
            for e in effects:
                if e.get("category") == "stamping":
                    e["has_block"] = has_block

            state.commit_partial_data()

            block_text = "มีบล็อกเดิม" if has_block else "ต้องทำบล็อกใหม่"
            response = f"รับทราบค่ะ ({block_text}) 📝"

            if state.edit_mode:
                result = _make_result(
                    response=response,
                    advance=True,
                    update_data={"special_effects": effects}
                )
                result.exit_edit = True
                return result

            # Normal flow → pre-generate checkpoint 2
            state.update_collected_data({"special_effects": effects})
            prompt10 = get_prompt_for_step(10, collected_data=state.collected_data)
            response10 = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT,
                user_message=prompt10,
                conversation_history=state.get_conversation_history(limit=3)
            )
            return _make_result(
                response=response + "\n\n---\n\n" + response10,
                advance=True,
                update_data={"special_effects": effects},
                post_advance_waiting=True,
            )

        return _make_result(
            response="ขอโทษค่ะ ไม่ค่อยเข้าใจ ช่วยตอบว่า 'เคย' หรือ 'ไม่เคย' ทำบล็อกป๊ัมกับเราได้ไหมคะ?"
        )

    # ===================================
    # Step 10: Checkpoint 2
    # ===================================
    async def handle_checkpoint2(self, user_message: str, state: ConversationState):
        """
        สรุป design requirements + ยืนยัน/แก้ไข/เพิ่ม
        Logic เหมือน Checkpoint 1 แต่ scope เป็น design fields
        """
        if not state.is_waiting_for_confirmation:
            prompt = get_prompt_for_step(10, collected_data=state.collected_data)
            response = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT,
                user_message=prompt,
                conversation_history=state.get_conversation_history(limit=3)
            )
            state.is_waiting_for_confirmation = True
            return _make_result(response=response)

        # ยืนยัน
        if is_confirmation(user_message):
            state.is_design_confirmed = True
            state.is_waiting_for_confirmation = False
            return _make_result(
                response="ขอบคุณค่ะ! ✅ กำลังสร้าง Mockup และใบเสนอราคาให้นะคะ รอสักครู่... ⏳",
                advance=True
            )

        # แก้ไข / เพิ่ม
        if is_rejection(user_message):
            target = detect_edit_target(user_message)
            if target:
                action = "append" if is_add_request(user_message) else "replace"
                state.enter_edit_mode(
                    target_step=target,
                    checkpoint=ChatbotStep.CHECKPOINT_2,
                    action=action
                )
                label = "เพิ่ม" if action == "append" else "แก้ไข"
                return _make_result(response=f"ได้เลยค่ะ! {label}ข้อมูลได้เลยนะคะ 📝")

            state.is_waiting_for_confirmation = False
            return _make_result(
                response=(
                    "ไม่เป็นไรค่ะ บอกได้เลยว่าต้องการแก้ไขส่วนไหนคะ?\n\n"
                    "เช่น: แก้ไข Mood&Tone / แก้ไขโลโก้ / เพิ่มลูกเล่นพิเศษ"
                )
            )

        return _make_result(
            response="ขอโทษค่ะ ไม่ค่อยเข้าใจ ช่วยตอบว่า 'ถูกต้อง' หรือ บอกส่วนที่ต้องการแก้ไขได้เลยค่ะ 🙏"
        )