"""
Chatbot Flow V2 — Natural Conversation
ใช้ LLM สร้างคำตอบแบบธรรมชาติ ไม่ต่อ hardcoded text

ความแตกต่างจาก V1:
- ไม่มี response += "เลือกวัสดุ..." hardcoded menu
- System prompt เดียวที่ครอบคลุม บุคลิก+ความรู้
- Step prompt ให้ context แล้ว LLM ตอบเอง
- Data extraction ใช้ตัวเดิม (regex/rules)
- State machine logic เหมือนเดิม
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, Tuple, List
from models.chat_state import ConversationState, ChatbotStep
from services.groq_service import get_groq_service
from services.data_extractor import (
    extract_product_type, extract_box_type, extract_material,
    extract_inner, extract_dimensions, extract_heart_dimensions,
    extract_quantity, extract_weight, extract_flute,
    extract_support_required,
    is_confirmation, is_rejection, is_skip_response,
    is_add_request, detect_edit_target,
)
from utils.constants import BOX_TYPES
from utils.prompts_v2 import (
    SYSTEM_PROMPT_V2, build_step_prompt,
    get_checkpoint_prompt, get_quote_prompt,
)


# ===================================
# StepResult (same as V1)
# ===================================
@dataclass
class StepResult:
    response: str
    advance: bool = False
    next_step_override: Optional[int] = None
    update_data: Optional[Dict[str, Any]] = None
    update_sub_step: Optional[int] = None
    merge_partial: Optional[Dict[str, Any]] = None
    exit_edit: bool = False
    post_advance_waiting: bool = False
    auto_execute: bool = False
    extra: Optional[Dict[str, Any]] = None


# ===================================
# V2 Flow Manager
# ===================================
class ChatbotFlowManagerV2:
    """
    State Machine + LLM Natural Response

    Same 14-step flow, same data extraction, but:
    - LLM generates ALL response text
    - No hardcoded transitions/menus appended
    - Single comprehensive system prompt
    """

    def __init__(self):
        self.groq = get_groq_service()

    # ===================================
    # Main Entry
    # ===================================
    async def process_message(
        self,
        user_message: str,
        state: ConversationState,
    ) -> Tuple[str, ConversationState, Optional[Dict[str, Any]]]:
        """Process user message, return (response, updated_state, extra)."""

        step = state.current_step

        # Edit mode: route to edit target
        if state.edit_mode:
            result = await self._handle_edit(user_message, state)
        else:
            result = await self._dispatch(step, user_message, state)

        # Apply result
        extra = self._apply_result(result, state)

        return result.response, state, extra

    # ===================================
    # Dispatch to step handler
    # ===================================
    async def _dispatch(self, step: int, msg: str, state: ConversationState) -> StepResult:
        handlers = {
            1: self._step_greeting,
            2: self._step_product_type,
            3: self._step_box_type,
            4: self._step_inner,
            5: self._step_dimensions,
            6: self._step_checkpoint1,
            7: self._step_mood_tone,
            8: self._step_logo,
            9: self._step_special_effects,
            10: self._step_checkpoint2,
            11: self._step_mockup,
            12: self._step_quote,
            13: self._step_confirm,
            14: self._step_end,
        }
        handler = handlers.get(step)
        if handler:
            return await handler(msg, state)
        return StepResult(response="ขออภัยค่ะ เกิดข้อผิดพลาด")

    # ===================================
    # LLM-based extraction (fallback when regex fails)
    # ===================================
    async def _classify_box_type(self, user_message: str) -> Optional[str]:
        """Use LLM to classify box type from natural language when regex fails."""
        prompt = (
            "จากข้อความลูกค้าด้านล่าง จงตอบเฉพาะ 1 คำ ว่าต้องการกล่องแบบไหน:\n"
            "- rsc (กล่องลูกฟูก, กล่องส่งของ, กล่องขนส่ง, กล่องแข็งแรง, กล่องมาตรฐาน)\n"
            "- die_cut (กล่องฝาเสียบ, กล่องไดคัท, กล่องเปิดฝา, กล่องโชว์สินค้า, กล่องพรีเมียม, กล่องสวย)\n"
            "- heart (กล่องหัวใจ, กล่องรูปหัวใจ, กล่องวาเลนไทน์, กล่องของขวัญรูปหัวใจ)\n"
            "- tube_lock (กล่องทรงยาว, กล่องใส่ขวด, กล่องทรงสูง, กล่องท่อ)\n"
            "- self_lock (กล่องเซลฟ์ล็อก, กล่องล็อกอัตโนมัติ, กล่องใส่ของหนัก)\n"
            "- none (ไม่สามารถระบุได้)\n\n"
            f"ข้อความลูกค้า: \"{user_message}\"\n\n"
            "ตอบเฉพาะคำเดียว: rsc / die_cut / heart / tube_lock / self_lock / none"
        )
        try:
            result = await self.groq.generate_response(
                system_prompt="คุณเป็น classifier ตอบเฉพาะ 1 คำเท่านั้น ห้ามอธิบาย",
                user_message=prompt,
                conversation_history=[],
            )
            result = result.strip().lower().replace(" ", "_")
            valid = {"rsc", "die_cut", "heart", "tube_lock", "self_lock"}
            if result in valid:
                return result
        except Exception:
            pass
        return None

    async def _classify_product_type(self, user_message: str) -> Optional[str]:
        """Use LLM to classify product type from natural language when regex fails."""
        prompt = (
            "จากข้อความลูกค้าด้านล่าง จงตอบเฉพาะ 1 คำ ว่าสินค้าเป็นประเภทไหน:\n"
            "- food (อาหาร, ขนม, เบเกอรี่, เครื่องดื่ม)\n"
            "- cosmetic (เครื่องสำอาง, ครีม, สกินแคร์, น้ำหอม, สบู่)\n"
            "- electronic (อิเล็กทรอนิกส์, มือถือ, อุปกรณ์ไฟฟ้า)\n"
            "- clothing (เสื้อผ้า, แฟชั่น, เครื่องแต่งกาย)\n"
            "- jewelry (เครื่องประดับ, แหวน, สร้อย)\n"
            "- general (อื่นๆ, ของใช้ทั่วไป, ไม่ระบุ)\n"
            "- none (ไม่สามารถระบุได้)\n\n"
            f"ข้อความลูกค้า: \"{user_message}\"\n\n"
            "ตอบเฉพาะคำเดียว: food / cosmetic / electronic / clothing / jewelry / general / none"
        )
        try:
            result = await self.groq.generate_response(
                system_prompt="คุณเป็น classifier ตอบเฉพาะ 1 คำเท่านั้น ห้ามอธิบาย",
                user_message=prompt,
                conversation_history=[],
            )
            result = result.strip().lower()
            valid = {"food", "cosmetic", "electronic", "clothing", "jewelry", "general"}
            if result in valid:
                return result
        except Exception:
            pass
        return None

    # ===================================
    # LLM call helper
    # ===================================
    async def _ask_llm(
        self, step: int, user_message: str, state: ConversationState,
        sub_step: int = 0, extra_context: str = "",
    ) -> str:
        prompt = build_step_prompt(
            step=step,
            user_message=user_message,
            collected=state.collected_data or {},
            sub_step=sub_step,
            extra_context=extra_context,
        )
        return await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT_V2,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=6),
        )

    # ===================================
    # Step 1: Greeting (auto-advance)
    # ===================================
    async def _step_greeting(self, msg: str, state: ConversationState) -> StepResult:
        response = await self._ask_llm(1, msg, state)
        return StepResult(response=response, advance=True)

    # ===================================
    # Step 2: Product Type
    # ===================================
    async def _step_product_type(self, msg: str, state: ConversationState) -> StepResult:
        product_type = extract_product_type(msg)
        # Also try to extract box_type if user said "ต้องการกล่องหัวใจ" etc.
        box_type = extract_box_type(msg)

        # LLM fallback: if regex can't extract, ask LLM to classify
        if not product_type:
            product_type = await self._classify_product_type(msg)
        if not box_type:
            box_type = await self._classify_box_type(msg)

        extra = ""
        if product_type and box_type:
            extra = f"ลูกค้าบอกทั้งประเภทสินค้า ({product_type}) และกล่อง ({box_type}) มาพร้อมกัน ยืนยันทั้งคู่แล้วถามวัสดุเลย"

        response = await self._ask_llm(2, msg, state, extra_context=extra)

        if product_type and box_type:
            # Got both — advance past box_type step too
            return StepResult(
                response=response, advance=True,
                next_step_override=3,
                update_data={"product_type": product_type, "box_type": box_type},
                update_sub_step=1,
            )

        if not product_type and box_type:
            # User skipped product type but named a box → default to "general"
            product_type = "general"
            if box_type == "heart":
                product_type = "cosmetic"
            extra = f"ลูกค้าข้ามประเภทสินค้า บอกตรงๆ ว่าต้องการกล่อง {box_type} → ยืนยันแล้วถามวัสดุเลย"
            response = await self._ask_llm(2, msg, state, extra_context=extra)
            return StepResult(
                response=response, advance=True,
                next_step_override=3,
                update_data={"product_type": product_type, "box_type": box_type},
                update_sub_step=1,
            )

        if product_type:
            result = StepResult(
                response=response, advance=True,
                update_data={"product_type": product_type},
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        return StepResult(response=response)

    # ===================================
    # Step 3: Box Type + Material
    # ===================================
    async def _step_box_type(self, msg: str, state: ConversationState) -> StepResult:
        if state.sub_step == 0:
            return await self._step_box_type_select(msg, state)
        else:
            return await self._step_material_select(msg, state)

    async def _step_box_type_select(self, msg: str, state: ConversationState) -> StepResult:
        box_type = extract_box_type(msg)

        # LLM fallback: if regex can't extract, ask LLM to classify
        if not box_type:
            box_type = await self._classify_box_type(msg)

        if box_type:
            hint = self._get_material_hint(box_type)
            response = await self._ask_llm(3, msg, state, sub_step=0,
                extra_context=f"ลูกค้าเลือก: {box_type}\nวัสดุที่มี: {hint}")
            return StepResult(
                response=response,
                merge_partial={"box_type": box_type},
                update_sub_step=1,
            )

        response = await self._ask_llm(3, msg, state, sub_step=0)
        return StepResult(response=response)

    async def _step_material_select(self, msg: str, state: ConversationState) -> StepResult:
        box_type = state.partial_data.get("box_type") or (state.collected_data or {}).get("box_type") or "rsc"
        material = extract_material(msg, box_type)

        if material:
            state.commit_partial_data()
            box_info = BOX_TYPES.get(box_type, {})
            has_inner = box_info.get("has_inner", False)
            extra = f"ลูกค้าเลือกวัสดุ: {material}, กล่อง: {box_type}"
            if has_inner:
                extra += "\nกล่องนี้มี inner → ถามเรื่อง inner ต่อ"
            else:
                extra += "\nกล่อง RSC → ข้าม inner, ถามขนาดกล่องเลย"

            response = await self._ask_llm(3, msg, state, sub_step=1, extra_context=extra)

            result = StepResult(
                response=response, advance=True,
                update_data={"box_type": box_type, "material": material},
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        response = await self._ask_llm(3, msg, state, sub_step=1,
            extra_context=f"ลูกค้าตอบไม่ตรง วัสดุที่มีสำหรับ {box_type}: {self._get_material_hint(box_type)}")
        return StepResult(response=response)

    # ===================================
    # Step 4: Inner
    # ===================================
    async def _step_inner(self, msg: str, state: ConversationState) -> StepResult:
        inner = extract_inner(msg)

        if inner == "skip" or is_skip_response(msg):
            response = await self._ask_llm(4, msg, state,
                extra_context="ลูกค้าข้าม inner → ถามขนาดกล่องต่อ")
            result = StepResult(response=response, advance=True)
            if state.edit_mode:
                result.exit_edit = True
            return result

        if inner:
            response = await self._ask_llm(4, msg, state,
                extra_context=f"ลูกค้าเลือก inner: {inner} → ถามขนาดกล่องต่อ")
            result = StepResult(
                response=response, advance=True,
                update_data={"inner": inner},
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        response = await self._ask_llm(4, msg, state)
        return StepResult(response=response)

    # ===================================
    # Step 5: Dimensions + Quantity (ใช้ form fields)
    # ===================================
    async def _step_dimensions(self, msg: str, state: ConversationState) -> StepResult:
        box_type = (state.collected_data or {}).get("box_type", "rsc")
        is_heart = box_type == "heart"

        # Heart box: extract shape/tilt + length/height
        if is_heart:
            heart_dims = extract_heart_dimensions(msg)
            dims = heart_dims if heart_dims else extract_dimensions(msg)
        else:
            dims = extract_dimensions(msg)

        qty = extract_quantity(msg)
        w = extract_weight(msg)
        fl = extract_flute(msg)

        prev = state.partial_data
        final_dims = dims or prev.get("dimensions")
        final_qty = qty or prev.get("quantity")
        final_w = w if w is not None else prev.get("weight_kg")
        final_fl = fl or prev.get("flute_type")

        partial = {}
        if final_dims:
            partial["dimensions"] = final_dims
        if final_qty:
            partial["quantity"] = final_qty
        if final_w is not None:
            partial["weight_kg"] = final_w
        if final_fl:
            partial["flute_type"] = final_fl

        # Heart: also store shape_pct / tilt_deg at top level
        if is_heart and final_dims:
            if "shape_pct" in final_dims:
                partial["shape_pct"] = final_dims["shape_pct"]
            if "tilt_deg" in final_dims:
                partial["tilt_deg"] = final_dims["tilt_deg"]

        # ถ้ายังไม่ครบ
        if not final_dims or not final_qty:
            missing = []
            if not final_dims:
                if is_heart:
                    missing.append("ขนาดกล่อง (ยาว×สูง + Shape/Tilt)")
                else:
                    missing.append("ขนาดกล่อง (กว้าง×ยาว×สูง ซม.)")
            if not final_qty:
                missing.append("จำนวน (ขั้นต่ำ 500)")
            extra = f"ยังขาด: {', '.join(missing)}"
            response = await self._ask_llm(5, msg, state, extra_context=extra)
            return StepResult(response=response, merge_partial=partial)

        # qty < 500
        if final_qty < 500:
            response = await self._ask_llm(5, msg, state,
                extra_context="จำนวนน้อยกว่า 500 → แจ้งว่าขั้นต่ำ 500 ชิ้นค่ะ")
            partial["quantity"] = None
            return StepResult(response=response, merge_partial=partial)

        # ครบแล้ว — commit + strength analysis
        state.partial_data.update(partial)
        state.commit_partial_data()

        # Strength analysis (skip for heart — no flute/weight relevance)
        analysis_text = ""
        if not is_heart:
            analysis_text = await self._run_strength_analysis(state)
        extra = f"ข้อมูลครบแล้ว ยืนยันขนาดและจำนวน"
        if analysis_text:
            extra += f"\n\nผลวิเคราะห์ความแข็งแรง:\n{analysis_text}"

        response = await self._ask_llm(5, msg, state, extra_context=extra)

        data = {
            "dimensions": final_dims,
            "quantity": final_qty,
        }
        if is_heart and final_dims:
            if "shape_pct" in final_dims:
                data["shape_pct"] = final_dims["shape_pct"]
            if "tilt_deg" in final_dims:
                data["tilt_deg"] = final_dims["tilt_deg"]
        if final_w is not None:
            data["weight_kg"] = final_w
        if final_fl:
            data["flute_type"] = final_fl

        result = StepResult(response=response, advance=True, update_data=data)
        if state.edit_mode:
            result.exit_edit = True
        return result

    async def _run_strength_analysis(self, state: ConversationState) -> str:
        """Run strength analysis and return summary text."""
        try:
            from api.analyze import analyze_box_strength_v2
            c = state.collected_data or {}
            dims = c.get("dimensions", {})
            result = analyze_box_strength_v2(
                length=dims.get("length", 0),
                width=dims.get("width", 0),
                height=dims.get("height", 0),
                weight=c.get("weight_kg", 0),
                flute_type=c.get("flute_type", "C"),
            )
            verdict = result.get("verdict", "")
            if verdict == "DANGER":
                state.collected_data["strength_warning"] = True
                return f"ผลวิเคราะห์: DANGER — กล่องอาจไม่แข็งแรงพอ แนะนำเปลี่ยนลอนกระดาษ"
            elif verdict == "WARNING":
                return f"ผลวิเคราะห์: WARNING — ควรพิจารณาลอนกระดาษที่หนาขึ้น"
            return f"ผลวิเคราะห์: OK — กล่องแข็งแรงเพียงพอ"
        except Exception:
            return ""

    # ===================================
    # Step 6: Checkpoint 1
    # ===================================
    async def _step_checkpoint1(self, msg: str, state: ConversationState) -> StepResult:
        if not state.is_waiting_for_confirmation:
            # First time — generate summary
            prompt = get_checkpoint_prompt(1, state.collected_data or {})
            response = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT_V2,
                user_message=prompt,
                conversation_history=state.get_conversation_history(limit=4),
            )
            return StepResult(response=response, post_advance_waiting=True)

        # Waiting for confirmation
        if is_confirmation(msg):
            response = await self._ask_llm(6, msg, state,
                extra_context="ลูกค้ายืนยันแล้ว → ถามว่ามีโลโก้หรือรูปที่ต้องการพิมพ์บนกล่องไหม")
            return StepResult(response=response, advance=True)

        # Edit request
        target = detect_edit_target(msg)
        if target:
            return self._enter_edit_mode(target, state, checkpoint_step=6)

        response = await self._ask_llm(6, msg, state,
            extra_context="ลูกค้ายังไม่ได้ยืนยัน ถามว่าจะยืนยันหรือแก้ไข")
        return StepResult(response=response)

    # ===================================
    # Step 7: Mood/Tone
    # ===================================
    async def _step_mood_tone(self, msg: str, state: ConversationState) -> StepResult:
        if is_skip_response(msg) or is_rejection(msg):
            response = await self._ask_llm(7, msg, state,
                extra_context="ลูกค้าข้าม → ถามเรื่องโลโก้ต่อ")
            result = StepResult(response=response, advance=True)
            if state.edit_mode:
                result.exit_edit = True
            return result

        # Extract mood/tone (free text — just save what they said)
        mood = msg.strip() if len(msg.strip()) > 1 else None
        if mood:
            response = await self._ask_llm(7, msg, state,
                extra_context=f"ลูกค้าบอก mood: {mood} → ถามเรื่องโลโก้ต่อ")
            result = StepResult(
                response=response, advance=True,
                update_data={"mood_tone": mood},
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        response = await self._ask_llm(7, msg, state)
        return StepResult(response=response)

    # ===================================
    # Step 8: Logo
    # ===================================
    async def _step_logo(self, msg: str, state: ConversationState) -> StepResult:
        if state.sub_step == 0:
            if is_rejection(msg) or is_skip_response(msg):
                response = await self._ask_llm(8, msg, state, sub_step=0,
                    extra_context="ลูกค้าไม่มีโลโก้ → ถามเรื่องลูกเล่นพิเศษต่อ")
                result = StepResult(
                    response=response, advance=True,
                    update_data={"has_logo": False},
                )
                if state.edit_mode:
                    result.exit_edit = True
                return result

            if is_confirmation(msg) or "มี" in msg or "โลโก้" in msg:
                response = await self._ask_llm(8, msg, state, sub_step=0,
                    extra_context="ลูกค้ามีโลโก้ → ถามตำแหน่ง (บน ข้าง หน้า หลัง)")
                return StepResult(
                    response=response,
                    merge_partial={"has_logo": True},
                    update_sub_step=1,
                )

            response = await self._ask_llm(8, msg, state, sub_step=0)
            return StepResult(response=response)

        else:  # sub_step 1: logo positions
            positions = self._extract_logo_positions(msg)
            if positions:
                state.commit_partial_data()
                response = await self._ask_llm(8, msg, state, sub_step=1,
                    extra_context=f"ลูกค้าเลือกตำแหน่ง: {positions} → ถามเรื่องลูกเล่นพิเศษต่อ")
                result = StepResult(
                    response=response, advance=True,
                    update_data={"has_logo": True, "logo_positions": positions},
                )
                if state.edit_mode:
                    result.exit_edit = True
                return result

            response = await self._ask_llm(8, msg, state, sub_step=1,
                extra_context="ยังไม่ชัดเจน ถามตำแหน่งโลโก้อีกครั้ง")
            return StepResult(response=response)

    def _extract_logo_positions(self, msg: str) -> List[str]:
        positions = []
        mapping = {
            "บน": "top", "ฝาบน": "top", "top": "top",
            "หน้า": "front", "front": "front",
            "หลัง": "back", "back": "back",
            "ข้าง": "side", "side": "side", "ซ้าย": "side", "ขวา": "side",
        }
        lower = msg.lower()
        for th, en in mapping.items():
            if th in lower and en not in positions:
                positions.append(en)
        return positions if positions else (["front"] if is_confirmation(msg) else [])

    # ===================================
    # Step 9: Special Effects
    # ===================================
    async def _step_special_effects(self, msg: str, state: ConversationState) -> StepResult:
        from services.data_extractor import extract_special_effects
        if state.sub_step == 0:
            if is_rejection(msg) or is_skip_response(msg):
                response = await self._ask_llm(9, msg, state, sub_step=0,
                    extra_context="ลูกค้าไม่ต้องการลูกเล่น → ไปสรุปรอบ 2")
                result = StepResult(response=response, advance=True)
                if state.edit_mode:
                    result.exit_edit = True
                return result

            effects = extract_special_effects(msg)
            if effects:
                # Check if any stamping needs block check
                needs_block = any(e.get("type", "").startswith(("emboss", "deboss", "foil")) for e in effects)
                if needs_block:
                    response = await self._ask_llm(9, msg, state, sub_step=0,
                        extra_context=f"ลูกค้าเลือก: {effects} → ถามว่ามีบล็อกป๊ัมอยู่แล้วหรือยัง")
                    return StepResult(
                        response=response,
                        merge_partial={"special_effects": effects},
                        update_sub_step=1,
                    )

                response = await self._ask_llm(9, msg, state, sub_step=0,
                    extra_context=f"ลูกค้าเลือก: {effects} → ไปสรุปรอบ 2")
                result = StepResult(
                    response=response, advance=True,
                    update_data={"special_effects": effects},
                )
                if state.edit_mode:
                    result.exit_edit = True
                return result

            response = await self._ask_llm(9, msg, state, sub_step=0)
            return StepResult(response=response)

        else:  # sub_step 1: block check
            has_block = is_confirmation(msg)
            effects = state.partial_data.get("special_effects", [])
            for e in effects:
                e["has_block"] = has_block
            state.commit_partial_data()

            response = await self._ask_llm(9, msg, state, sub_step=1,
                extra_context=f"บล็อกป๊ัม: {'มีแล้ว' if has_block else 'ต้องทำใหม่'} → ไปสรุปรอบ 2")
            result = StepResult(
                response=response, advance=True,
                update_data={"special_effects": effects},
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

    # ===================================
    # Step 10: Checkpoint 2
    # ===================================
    async def _step_checkpoint2(self, msg: str, state: ConversationState) -> StepResult:
        if not state.is_waiting_for_confirmation:
            prompt = get_checkpoint_prompt(2, state.collected_data or {})
            response = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT_V2,
                user_message=prompt,
                conversation_history=state.get_conversation_history(limit=4),
            )
            return StepResult(response=response, post_advance_waiting=True)

        if is_confirmation(msg):
            response = await self._ask_llm(10, msg, state,
                extra_context="ลูกค้ายืนยันแล้ว → เตรียม mockup และใบเสนอราคา")
            return StepResult(response=response, advance=True, auto_execute=True)

        target = detect_edit_target(msg)
        if target:
            return self._enter_edit_mode(target, state, checkpoint_step=10)

        response = await self._ask_llm(10, msg, state,
            extra_context="ลูกค้ายังไม่ยืนยัน ถามว่าจะยืนยันหรือแก้ไข")
        return StepResult(response=response)

    # ===================================
    # Steps 11-14: Finalize (reuse finalize_steps logic)
    # ===================================
    async def _step_mockup(self, msg: str, state: ConversationState) -> StepResult:
        response = await self._ask_llm(11, msg, state,
            extra_context="กำลังเตรียม mockup + คำนวณราคาให้ลูกค้า")
        return StepResult(response=response, advance=True, auto_execute=True)

    async def _step_quote(self, msg: str, state: ConversationState) -> StepResult:
        # Calculate pricing
        pricing = self._calculate_pricing(state)
        if not pricing:
            return StepResult(response="ขออภัยค่ะ คำนวณราคาไม่สำเร็จ กรุณาลองใหม่")

        state.temp_data["pricing"] = pricing
        prompt = get_quote_prompt(pricing)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT_V2,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=4),
        )
        response += "\n\nต้องการสั่งผลิตเลยไหมคะ?"
        return StepResult(
            response=response,
            advance=True,
            extra={"auto_download_pdf": f"/api/pricing/quote-pdf/{state.session_id}"},
        )

    async def _step_confirm(self, msg: str, state: ConversationState) -> StepResult:
        if is_confirmation(msg):
            response = await self._ask_llm(13, msg, state,
                extra_context="ลูกค้ายืนยัน → ขอบคุณ บันทึกออเดอร์")
            return StepResult(response=response, advance=True, auto_execute=True)

        if is_rejection(msg):
            response = await self._ask_llm(13, msg, state,
                extra_context="ลูกค้าไม่ยืนยัน → ถามว่าอยากแก้ไขอะไร กลับไป checkpoint 2")
            return StepResult(response=response, next_step_override=10)

        response = await self._ask_llm(13, msg, state)
        return StepResult(response=response)

    async def _step_end(self, msg: str, state: ConversationState) -> StepResult:
        # Auto-generate project name if not set
        c = state.collected_data or {}
        if not c.get("project_name"):
            box_type = c.get("box_type", "project")
            from datetime import datetime
            c["project_name"] = f"{box_type.upper()} {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"

        # Mark complete BEFORE saving so DB gets correct status
        state.is_complete = True

        # Save project + order (best-effort)
        try:
            from services.step_handlers.finalize_steps import FinalizeStepHandlers
            finalizer = FinalizeStepHandlers(self.groq)
            finalizer._save_project_to_db(state)
            finalizer._save_order_to_db(state)
        except Exception as e:
            print(f"[step_end] save error (non-blocking): {e}")

        project_name = c.get("project_name", "โปรเจกต์")
        response = (
            f"บันทึกโปรเจกต์ \"{project_name}\" เรียบร้อยแล้วค่ะ\n\n"
            f"หมายเลขอ้างอิง: {state.session_id}\n\n"
            f"ขอบคุณที่ใช้บริการ LumoPack ค่ะ ทีมงานจะติดต่อกลับภายใน 1-2 วันทำการค่ะ"
        )
        return StepResult(
            response=response,
            extra={"auto_download_pdf": f"/api/pricing/quote-pdf/{state.session_id}"},
        )

    # ===================================
    # Edit mode
    # ===================================
    def _enter_edit_mode(self, target, state: ConversationState, checkpoint_step: int) -> StepResult:
        """Enter edit mode. target can be int (step number) or str (field name)."""
        # detect_edit_target returns int (step number), map to step directly
        if isinstance(target, int):
            target_step = target
            # Reverse-map step number to a target name for display
            step_to_name = {
                2: "ประเภทสินค้า", 3: "วัสดุ/กล่อง", 4: "inner",
                5: "ขนาด/จำนวน", 7: "mood", 8: "โลโก้", 9: "ลูกเล่นพิเศษ",
            }
            target_name = step_to_name.get(target_step, str(target_step))
        else:
            # Legacy string target
            target_map = {
                "product_type": 2, "box_type": 3, "material": 3,
                "inner": 4, "dimensions": 5, "quantity": 5,
                "mood_tone": 7, "logo": 8, "special_effects": 9,
            }
            target_step = target_map.get(target)
            target_name = target
            if not target_step:
                return StepResult(response="ไม่เข้าใจว่าต้องการแก้ไขอะไรค่ะ ลองบอกใหม่ได้ไหม เช่น 'แก้ขนาด' หรือ 'เปลี่ยนวัสดุ'")

        state.edit_mode = {"target": target_name, "checkpoint": checkpoint_step}
        state.current_step = target_step
        state.sub_step = 0
        if target_step == 3:
            # Material is sub_step 1 of step 3
            state.sub_step = 1

        return StepResult(
            response=f"ได้เลยค่ะ แก้ไข{target_name} บอกมาได้เลยนะคะ",
        )

    async def _handle_edit(self, msg: str, state: ConversationState) -> StepResult:
        result = await self._dispatch(state.current_step, msg, state)
        if result.exit_edit:
            checkpoint = state.edit_mode.get("checkpoint", 6) if isinstance(state.edit_mode, dict) else 6
            state.edit_mode = None
            state.current_step = checkpoint
            state.sub_step = 0
            state.is_waiting_for_confirmation = False
            # Will re-generate checkpoint summary on next call
        return result

    # ===================================
    # Pricing helper
    # ===================================
    def _calculate_pricing(self, state: ConversationState) -> Optional[Dict]:
        try:
            from models.requirement import CompleteRequirement
            from services.pricing_calculator import get_price_estimate
            c = state.collected_data or {}
            requirement = CompleteRequirement.from_collected_data(
                session_id=state.session_id,
                collected_data=c,
            )
            return get_price_estimate(requirement.to_pricing_request())
        except Exception as e:
            print(f"[V2] Pricing error: {e}")
            return None

    # ===================================
    # Apply StepResult to state
    # ===================================
    def _apply_result(self, result: StepResult, state: ConversationState) -> Optional[Dict]:
        if result.update_data:
            state.collected_data = state.collected_data or {}
            state.collected_data.update(result.update_data)

        if result.merge_partial:
            state.partial_data.update(result.merge_partial)

        if result.update_sub_step is not None:
            state.sub_step = result.update_sub_step

        if result.advance:
            if result.next_step_override:
                state.current_step = result.next_step_override
            else:
                state.current_step = self._resolve_next_step(state)
            state.sub_step = result.update_sub_step if result.update_sub_step is not None else 0
            state.is_waiting_for_confirmation = False

        if result.post_advance_waiting:
            state.is_waiting_for_confirmation = True

        extra = result.extra
        if result.auto_execute:
            extra = extra or {}
            extra["auto_execute"] = True

        return extra

    def _resolve_next_step(self, state: ConversationState) -> int:
        """Determine next step (skip inner for RSC, etc.)"""
        current = state.current_step
        next_step = current + 1

        # Skip inner (step 4) for RSC / self_lock
        if next_step == 4:
            box_type = (state.collected_data or {}).get("box_type", "rsc")
            box_info = BOX_TYPES.get(box_type, {})
            if not box_info.get("has_inner", False):
                next_step = 5

        # Skip mood/tone (step 7) → go straight to logo (step 8)
        if next_step == 7:
            next_step = 8

        return min(next_step, 14)

    # ===================================
    # Material hints
    # ===================================
    def _get_material_hint(self, box_type: str) -> str:
        opts = ["Kraft (คราฟท์)", "White (ขาว)"]
        if box_type == "heart":
            opts.append("Red (แดง)")
        eco = ["Recycled (รีไซเคิล)", "FSC (ปลูกทดแทน)", "Bagasse (ชานอ้อย)"]
        return ", ".join(opts) + " | Eco: " + ", ".join(eco)
