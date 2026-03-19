"""
Structure Step Handlers (Steps 1-6)
จัดการขั้นตอนเก็บ requirement โครงสร้างกล่อง

Steps:
1. Greeting
2. Product Type (บังคับ)
3. Box Type + Material (บังคับ, มี sub_step)
4. Inner (Optional, สำหรับ box types ที่มี has_inner=True)
5. Dimensions + Quantity (บังคับ, รับแยกรอบได้ผ่าน partial_data)
6. Checkpoint 1 (สรุป + รองรับแก้ไข/เพิ่ม ผ่าน edit_mode)
"""

import re
from models.chat_state import ConversationState, ChatbotStep
from services.data_extractor import (
    extract_product_type, extract_box_type, extract_material,
    extract_inner, extract_dimensions, extract_quantity,
    extract_weight, extract_flute,
    is_confirmation, is_rejection, is_skip_response,
    is_add_request, detect_edit_target,
)
from api.analyze import analyze_box_strength, suggest_alternatives, format_analysis_for_chat, FLUTE_SPECS
from utils.constants import BOX_TYPES
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
            # เพิ่ม transition ถามประเภทกล่อง (ถ้าไม่ได้อยู่ใน edit mode)
            if not state.edit_mode:
                response += (
                    "\n\nคุณต้องการกล่องประเภทไหนคะ?\n"
                    "1. RSC (มาตรฐาน) — ประหยัด แข็งแรง เหมาะขนส่ง\n"
                    "2. Die-cut (ฝาเสียบ) — พรีเมียม โชว์แบรนด์\n"
                    "3. Heart (หัวใจ) — ของขวัญ/เครื่องสำอาง\n"
                    "4. Star (ดาว) — โดดเด่น ดึงดูดสายตา\n"
                    "5. Bear (หมี) — น่ารัก สินค้าเด็ก/ของขวัญ\n"
                    "6. Circle (ทรงกลม) — คลาสสิก หรูหรา\n"
                    "7. Bow (ซัพพอร์ท) — ฝาเสียบพร้อมซัพพอร์ทภายใน"
                )

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

            # สร้าง response หลัก
            response = f"เรียบร้อยค่ะ! เลือกกล่อง {box_type.upper()} วัสดุ {material} 📦"

            # เพิ่ม transition ตาม path (ถ้าไม่ได้อยู่ใน edit mode)
            if not state.edit_mode:
                box_info = BOX_TYPES.get(box_type, {})
                if box_info.get("has_inner", False):
                    # Die-cut / Heart / Star / Bear / Circle / Bow → ถาม Inner
                    response += (
                        "\n\nต้องการ Inner เพิ่มในกล่องไหมคะ? เลือกได้หลายตัวเลือก "
                        "เพียงพิมพ์หมายเลขรวมกัน เช่น '1' หรือ '2, 5'\n\n"
                        "🛡️ กันกระแทก\n"
                        "  1. กระดาษฝอย (Shredded Paper)\n"
                        "  2. บับเบิ้ล (Air Bubble Roll)\n"
                        "  3. ถุงลม (Air Cushion)\n\n"
                        "💧 เคลือบกันชื้น\n"
                        "  4. AQ Coating (Acrylic polymer)\n"
                        "  5. PE Coating (Polyethylene)\n"
                        "  6. Wax Coating (Paraffin wax)\n"
                        "  7. Bio/Water-based Barrier\n\n"
                        "🍽️ Food-grade Coating\n"
                        "  8. Water-based Food Coating\n"
                        "  9. PE Food-grade Coating\n"
                        "  10. PLA/Bio Coating\n"
                        "  11. Grease-resistant Coating\n\n"
                        "*(หรือพิมพ์ 'ไม่ต้องการ' เพื่อข้ามค่ะ)*"
                    )
                else:
                    # RSC ข้าม Inner → ไปถามขนาดเลย
                    response += (
                        "\n\n📐 ต่อไป ขอทราบขนาดกล่องที่ต้องการนะคะ "
                        "(กว้าง×ยาว×สูง เป็น ซม.) และจำนวนที่ต้องการผลิต (ขั้นต่ำ 500 ชิ้น)"
                    )

            result = _make_result(
                response=response, advance=True,
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
        material_group = BOX_TYPES.get(box_type, {}).get("material_group", "die_cut")
        if material_group == "rsc":
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
    # Step 4: Inner (Optional, สำหรับ box types ที่มี has_inner=True)
    # ===================================
    async def handle_inner(self, user_message: str, state: ConversationState):
        inner = extract_inner(user_message)

        prompt = get_prompt_for_step(4, user_message=user_message)
        response = await self.groq.generate_response(
            system_prompt=SYSTEM_PROMPT,
            user_message=prompt,
            conversation_history=state.get_conversation_history(limit=5)
        )

        # Transition สำหรับถามขนาดกล่อง (ใช้ร่วมกัน)
        dims_transition = (
            "\n\n📐 ต่อไป ขอทราบขนาดกล่องที่ต้องการนะคะ "
            "(กว้าง×ยาว×สูง เป็น ซม.) และจำนวนที่ต้องการผลิต (ขั้นต่ำ 500 ชิ้น)"
        )

        if inner == "skip":
            if not state.edit_mode:
                response += dims_transition
            result = _make_result(response=response, advance=True)
            if state.edit_mode:
                result.exit_edit = True
            return result

        if inner:
            if not state.edit_mode:
                response += dims_transition
            result = _make_result(
                response=response, advance=True,
                update_data={"inner": inner}
            )
            if state.edit_mode:
                result.exit_edit = True
            return result

        # extract ไม่ได้ → ถามซ้ำ (ไม่ advance เพื่อป้องกันข้อมูลหาย)
        return _make_result(response=response)

    # ===================================
    # Step 5: Dimensions + Quantity (รับแยกรอบได้)
    # ===================================
    async def handle_dimensions(self, user_message: str, state: ConversationState):
        """
        รองรับ:
        1. ส่งพร้อมกัน: "20x15x10 จำนวน 1000 น้ำหนัก 2kg ลอน C"
        2. dims ก่อน → ถาม qty
        3. qty ก่อน → ถาม dims
        weight + flute เป็น optional (default: 0 / "C")
        หลังได้ dims+qty ครบ → run strength analysis → แสดงผล → checkpoint 1
        """
        dims = extract_dimensions(user_message)
        qty  = extract_quantity(user_message)
        w    = extract_weight(user_message)
        fl   = extract_flute(user_message)

        # Merge กับ partial จากรอบก่อน
        prev_dims  = state.partial_data.get("dimensions")
        prev_qty   = state.partial_data.get("quantity")
        prev_w     = state.partial_data.get("weight_kg")
        prev_fl    = state.partial_data.get("flute_type")
        final_dims = dims or prev_dims
        final_qty  = qty  or prev_qty
        final_w    = w    if w is not None else prev_w   # 0 ก็เป็น valid
        final_fl   = fl   or prev_fl

        # ได้ dims+qty ครบ → commit และดำเนินการต่อ
        if final_dims and final_qty:
            state.commit_partial_data()

            # ค่า default ถ้าลูกค้าไม่ระบุ
            weight_kg  = final_w  if final_w  is not None else 0.0
            flute_type = final_fl if final_fl is not None else "C"

            collected = {
                "dimensions": final_dims,
                "quantity":   final_qty,
                "weight_kg":  weight_kg,
                "flute_type": flute_type,
            }

            # --- Run Strength Analysis ---
            analysis = analyze_box_strength(
                length_cm=final_dims["length"],
                width_cm=final_dims["width"],
                height_cm=final_dims["height"],
                weight_kg=weight_kg,
                flute_type=flute_type,
            )
            analysis_text = format_analysis_for_chat(analysis, weight_kg, flute_type)

            # DANGER → เพิ่ม recommendation จาก suggest_alternatives
            if analysis["status"] == "DANGER" and weight_kg > 0:
                alts = suggest_alternatives(
                    weight_kg=weight_kg,
                    length_cm=final_dims["length"],
                    width_cm=final_dims["width"],
                    height_cm=final_dims["height"],
                    current_flute=flute_type,
                )
                rec_lines = ["\n💡 **แนะนำ:**"]

                if alts["needs_larger_box"]:
                    # กล่องเล็กเกินไป → ต้องเพิ่มขนาดก่อน
                    rec_lines.append(
                        f"  • กล่องขนาดนี้เล็กเกินไปสำหรับ {weight_kg:.1f} kg ทุกลอนกระดาษ"
                    )
                    if alts["min_perimeter_cm"]:
                        cur_perim = 2 * (final_dims["length"] + final_dims["width"])
                        extra = alts["min_perimeter_cm"] - cur_perim
                        rec_lines.append(
                            f"  • ต้องการขอบรอบรวม (กว้าง+ยาว)×2 ≥ {alts['min_perimeter_cm']} ซม. "
                            f"(เพิ่มอีก {extra:.1f} ซม.) + ใช้ลอน BC"
                        )
                else:
                    if alts["recommended_flutes"]:
                        best = alts["recommended_flutes"][0]
                        rec_lines.append(
                            f"  • เปลี่ยนเป็น **{best['name']}** — รับน้ำหนักได้ {best['max_load_kg']} kg "
                            f"(safety factor {best['safety_factor']}×)"
                        )
                    if alts["min_perimeter_cm"]:
                        cur_perim = 2 * (final_dims["length"] + final_dims["width"])
                        if alts["min_perimeter_cm"] > cur_perim:
                            rec_lines.append(
                                f"  • หรือเพิ่มขนาดกล่อง ขอบรอบรวมขั้นต่ำ {alts['min_perimeter_cm']} ซม."
                            )

                analysis_text += "\n" + "\n".join(rec_lines)
                collected["strength_warning"] = True

            if state.edit_mode:
                result = _make_result(
                    response=analysis_text, advance=True,
                    update_data=collected
                )
                result.exit_edit = True
                return result

            # Normal flow → analysis + checkpoint 1 ในรอบเดียว
            state.update_collected_data(collected)
            prompt6 = get_prompt_for_step(6, collected_data=state.collected_data)
            response6 = await self.groq.generate_response(
                system_prompt=SYSTEM_PROMPT,
                user_message=prompt6,
                conversation_history=state.get_conversation_history(limit=3)
            )

            combined = analysis_text + "\n\n---\n\n" + response6
            return _make_result(
                response=combined,
                advance=True,
                update_data=collected,
                post_advance_waiting=True,
            )

        # ได้แค่ dimensions → ถาม quantity
        if dims and not final_qty:
            # ตรวจสอบว่าลูกค้าพิมพ์ quantity มาแต่ต่ำกว่า 500 หรือไม่
            qty_pattern = re.search(
                r'(?:จำนวน|quantity)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:ชิ้น|กล่อง|ใบ)',
                user_message, re.IGNORECASE
            )
            below_min_msg = ""
            if qty_pattern:
                raw_num = int((qty_pattern.group(1) or qty_pattern.group(2)).replace(",", ""))
                if raw_num < 500:
                    below_min_msg = f"\n\n⚠️ จำนวน {raw_num:,} ชิ้น ต่ำกว่าขั้นต่ำค่ะ"

            return _make_result(
                response=(
                    f"ขนาดกล่อง {dims['width']}×{dims['length']}×{dims['height']} ซม. "
                    f"รับทราบค่ะ 📐{below_min_msg}\n\n"
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

        # เช็ค quantity < 500 โดยใช้ context word เพื่อหลีกเลี่ยง false positive จาก dimensions
        qty_ctx = re.search(
            r'(?:จำนวน|quantity)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:ชิ้น|กล่อง|ใบ)',
            user_message, re.IGNORECASE
        )
        if qty_ctx:
            raw_num = int((qty_ctx.group(1) or qty_ctx.group(2)).replace(",", ""))
            if 0 < raw_num < 500:
                response += f"\n\n⚠️ จำนวน {raw_num:,} ชิ้น ต่ำกว่าขั้นต่ำค่ะ จำนวนขั้นต่ำคือ 500 ชิ้น"

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
                response=(
                    "เยี่ยมเลยค่ะ! ✅ ต่อไปเราจะมาดูเรื่องการออกแบบกล่องกันนะคะ 🎨\n\n"
                    "คุณอยากให้กล่องออกมาเป็นสไตล์ไหนคะ?\n"
                    "เช่น: สดใส สนุกสนาน / เรียบหรู สุขุม / มินิมอล / พรีเมียม\n"
                    "(หรือพิมพ์ 'ข้าม' ถ้ายังไม่กำหนด)"
                ),
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

            # detect ไม่ได้ → แสดงตัวเลือกชัดเจน
            state.is_waiting_for_confirmation = False
            return _make_result(
                response=(
                    "ต้องการแก้ไขส่วนไหนคะ? พิมพ์ได้เลย เช่น:\n\n"
                    "• แก้ไขขนาด\n"
                    "• แก้ไขจำนวน\n"
                    "• แก้ไขลอนกระดาษ\n"
                    "• แก้ไขประเภทสินค้า\n"
                    "• เพิ่ม Inner"
                )
            )

        # ไม่เข้าใจ → hint
        state.is_waiting_for_confirmation = True
        return _make_result(
            response=(
                "ตอบ 'ถูกต้อง' เพื่อไปต่อ หรือบอกส่วนที่ต้องการแก้ไขได้เลยค่ะ 🙏\n"
                "เช่น: แก้ไขขนาด / แก้ไขจำนวน / แก้ไขลอนกระดาษ"
            )
        )