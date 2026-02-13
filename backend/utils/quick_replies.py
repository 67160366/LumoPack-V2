"""
Quick Replies Mapper v2
สร้างปุ่มตัวเลือกสำหรับ Frontend ตาม current_step + sub_step

อิงจาก:
- structure_steps.py (steps 1-6)
- design_steps.py (steps 7-10)
- finalize_steps.py (steps 11-14)
- system_prompt.py (quick_replies rules)

หลักการ:
- ทำหน้าที่เป็น FALLBACK — ถ้า LLM ส่ง quick_replies ใน <extracted_data> มา ใช้ของ LLM ก่อน
- ถ้า LLM ไม่ส่ง → ใช้ mapping จากไฟล์นี้
- mapping ต้อง match กับ data_extractor ที่แต่ละ step ใช้ parse
"""

from typing import List, Dict, Any, Optional


def get_quick_replies(
    current_step: int,
    sub_step: int = 0,
    collected_data: Optional[Dict[str, Any]] = None,
    partial_data: Optional[Dict[str, Any]] = None,
    is_waiting_confirmation: bool = False,
    is_edit_mode: bool = False,
) -> List[str]:
    """
    คืน quick_replies ตาม step ปัจจุบัน

    Args:
        current_step: step หลัง process (1-14)
        sub_step: sub_step ปัจจุบัน (0, 1, ...)
        collected_data: ข้อมูลที่ commit แล้ว
        partial_data: ข้อมูลที่เก็บชั่วคราว (ยังไม่ commit)
        is_waiting_confirmation: กำลังรอยืนยัน (checkpoint)
        is_edit_mode: อยู่ใน edit mode (กลับมาแก้จาก checkpoint)

    Returns:
        list ของ string ที่จะแสดงเป็นปุ่ม (ว่าง = ไม่แสดงปุ่ม)
    """
    data = collected_data or {}
    partial = partial_data or {}

    # === Edit Mode: ไม่แสดงปุ่ม ให้ user พิมพ์เอง ===
    # เพราะ user กำลังแก้ไขข้อมูลเฉพาะจุด
    if is_edit_mode:
        return []

    # ===================================
    # Step 1: Greeting (auto-advance ไม่ต้องมีปุ่ม)
    # ===================================
    if current_step == 1:
        return []

    # ===================================
    # Step 2: Product Type
    # structure_steps: extract_product_type(user_message)
    # 4 ตัวเลือกตาม Requirement: general / non_food / food_grade / cosmetic
    # ===================================
    if current_step == 2:
        return [
            "สินค้าทั่วไป",
            "Non-food",
            "Food-grade",
            "เครื่องสำอาง",
        ]

    # ===================================
    # Step 3: Box Type + Material (มี sub_step)
    # structure_steps: sub_step 0 → extract_box_type
    #                  sub_step 1 → extract_material(msg, box_type)
    # ===================================
    if current_step == 3:
        if sub_step == 0:
            # ถามประเภทกล่อง
            return ["RSC (มาตรฐาน)", "Die-cut (พรีเมียม)"]
        if sub_step == 1:
            # ถามวัสดุ — ตัวเลือกขึ้นอยู่กับ box_type
            box_type = partial.get("box_type", data.get("box_type", ""))
            if box_type == "rsc":
                return [
                    "กระดาษลูกฟูก 2 ชั้น",
                    "กระดาษคราฟท์ 200 GSM",
                ]
            else:
                # die-cut มี 4 ตัวเลือก
                return [
                    "กระดาษลูกฟูก 2 ชั้น",
                    "กระดาษแข็ง/จั่วปัง",
                    "กระดาษอาร์ต 300 GSM",
                    "กล่องขาว 350 GSM",
                ]

    # ===================================
    # Step 4: Inner (Optional, Approach B — 3 กลุ่ม, multi-select)
    # structure_steps: extract_inner → List[Dict] | "skip" | None
    # ถามเฉพาะ Die-cut (RSC skip ผ่าน _resolve_next_step)
    # แสดงตัวเลือกตัวเริ่มต้นที่ใช้บ่อยที่สุด + ไม่ต้องการ
    # ===================================
    if current_step == 4:
        return [
            "ไม่ต้องการ",
            "1 (กระดาษฝอย)",
            "2 (บับเบิ้ล)",
            "3 (ถุงลม)",
            "4 (AQ กันชื้น)",
            "8 (Food Coating)",
        ]

    # ===================================
    # Step 5: Dimensions + Quantity (รับแยกรอบ)
    # structure_steps: extract_dimensions + extract_quantity
    #   - ได้ทั้งคู่ → advance
    #   - ได้แค่ dims → ถาม qty (แสดงปุ่มจำนวน)
    #   - ได้แค่ qty → ถาม dims (แสดง form)
    #   - ไม่ได้เลย → แสดง form (กว้าง/ยาว/สูง/จำนวน)
    #
    # "__FORM_DIMENSIONS__" = marker บอก frontend ให้แสดง form input
    # แทนปุ่ม quick reply ปกติ
    # ===================================
    if current_step == 5:
        has_dims = (
            partial.get("dimensions") is not None
            or data.get("dimensions") is not None
        )
        has_qty = (
            partial.get("quantity") is not None
            or data.get("quantity") is not None
        )

        if has_dims and not has_qty:
            # มี dimensions แล้ว → ถามจำนวน
            return ["500", "1,000", "2,000", "5,000"]

        if not has_dims:
            # ยังไม่มี dimensions → แสดง form ให้กรอก
            # ถ้ามี qty แล้ว form จะแสดงแค่ช่องขนาด (frontend จัดการ)
            return ["__FORM_DIMENSIONS__"]

        # มีทั้งคู่แล้ว → ไม่แสดงอะไร
        return []

    # ===================================
    # Step 6: Checkpoint 1 (สรุปโครงสร้าง)
    # structure_steps: is_waiting_for_confirmation → ยืนยัน/แก้ไข
    # ===================================
    if current_step == 6:
        if is_waiting_confirmation:
            return ["ถูกต้อง ✓", "ขอแก้ไข"]
        return []

    # ===================================
    # Step 7: Mood & Tone (Optional)
    # design_steps: is_skip_response → skip | เก็บ free text
    # ===================================
    if current_step == 7:
        return ["มินิมอล/เรียบหรู", "น่ารัก/สดใส", "หรูหรา/พรีเมียม", "ข้าม"]

    # ===================================
    # Step 8: Logo (มี sub_step)
    # design_steps: sub_step 0 → extract_has_logo (True/False/None)
    #               sub_step 1 → extract_logo_positions
    # ===================================
    if current_step == 8:
        if sub_step == 0:
            return ["มีโลโก้", "ไม่มีโลโก้"]
        if sub_step == 1:
            return ["ด้านบน", "ด้านกว้าง", "ด้านยาว", "ทุกด้าน"]

    # ===================================
    # Step 9: Special Effects (มี sub_step)
    # design_steps: sub_step 0 → extract_special_effects → "skip" | effects[] | None
    #               sub_step 1 → extract_has_existing_block (True/False)
    # system_prompt: เคลือบ + ปั๊ม
    # ===================================
    if current_step == 9:
        if sub_step == 0:
            return ["ไม่ต้องการ", "เคลือบเงา", "เคลือบด้าน", "ปั๊มนูน"]
        if sub_step == 1:
            # ถามเรื่องบล็อกป๊ัม
            return ["เคยทำบล็อกแล้ว", "ยังไม่เคย (ทำใหม่)"]

    # ===================================
    # Step 10: Checkpoint 2 (สรุป design)
    # design_steps: is_waiting_for_confirmation → ยืนยัน/แก้ไข
    # ===================================
    if current_step == 10:
        if is_waiting_confirmation:
            return ["ถูกต้อง ✓", "ขอแก้ไข"]
        return []

    # ===================================
    # Step 11: Mockup
    # finalize_steps: sub_step 0 → แสดง mockup (ไม่ต้องมีปุ่ม)
    #                 sub_step 1 → รอ user ดู → advance
    # ===================================
    if current_step == 11:
        if sub_step == 0:
            return []  # กำลังสร้าง mockup
        if sub_step == 1:
            return ["สวยมาก ไปต่อเลย! ✓", "ขอปรับ Mockup"]

    # ===================================
    # Step 12: Quote
    # finalize_steps: sub_step 0 → แสดงราคา (ไม่ต้องมีปุ่ม)
    #                 sub_step 1 → รอ user ดู → advance
    # ===================================
    if current_step == 12:
        if sub_step == 0:
            return []  # กำลังคำนวณราคา
        if sub_step == 1:
            return ["เข้าใจแล้ว ไปต่อ ✓", "สอบถามเพิ่มเติม"]

    # ===================================
    # Step 13: Confirm Order
    # finalize_steps: is_confirmation → advance
    #                 is_rejection → ดู keyword:
    #                   mockup/ภาพ/รูป → กลับ step 11
    #                   ราคา/สเปค → กลับ checkpoint 2
    # ===================================
    if current_step == 13:
        return ["ยืนยันสั่งผลิต ✓", "ขอแก้ไข Mockup", "ขอแก้ไขสเปค"]

    # ===================================
    # Step 14: End (จบสนทนา — ไม่ต้องมีปุ่ม)
    # ===================================

    return []