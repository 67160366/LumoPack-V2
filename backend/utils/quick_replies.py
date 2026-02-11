"""
Quick Replies Mapper
สร้างปุ่มตัวเลือกสำหรับ Frontend ตาม current_step + sub_step

ใช้แทนการให้ LLM ส่ง quick_replies กลับมาเอง
"""

from typing import List, Dict, Any, Optional


def get_quick_replies(
    current_step: int,
    sub_step: int = 0,
    collected_data: Optional[Dict[str, Any]] = None,
    is_waiting_confirmation: bool = False,
) -> List[str]:
    """
    คืน quick_replies ตาม step ปัจจุบัน

    Args:
        current_step: step หลัง process แล้ว (1-14)
        sub_step: sub_step ปัจจุบัน (0, 1, ...)
        collected_data: ข้อมูลที่เก็บแล้ว (ใช้ตัดสิน material options)
        is_waiting_confirmation: กำลังรอยืนยันอยู่หรือไม่

    Returns:
        list ของ string ที่จะแสดงเป็นปุ่ม
    """
    data = collected_data or {}

    # ===================================
    # Step 2: ประเภทสินค้า
    # ===================================
    if current_step == 2:
        return ["สินค้าทั่วไป", "Non-food", "Food-grade", "เครื่องสำอาง"]

    # ===================================
    # Step 3: กล่อง + วัสดุ (มี sub_step)
    # ===================================
    if current_step == 3:
        if sub_step == 0:
            return ["RSC (มาตรฐาน)", "Die-cut (พรีเมียม)"]
        if sub_step == 1:
            box_type = data.get("box_type", "")
            if box_type == "rsc":
                return ["กระดาษลูกฟูก 2 ชั้น", "กระดาษคราฟท์ 200 GSM"]
            else:
                return ["กระดาษลูกฟูก", "กระดาษแข็ง", "กระดาษอาร์ต 300 GSM", "กล่องขาว 350 GSM"]

    # ===================================
    # Step 4: Inner (Optional)
    # ===================================
    if current_step == 4:
        return ["ไม่ต้องการ", "กระดาษฝอย", "บับเบิ้ล", "ถุงลม"]

    # ===================================
    # Step 5: ขนาด + จำนวน → พิมพ์เอง
    # ===================================
    if current_step == 5:
        # ถ้ามี dimensions แล้ว ถามจำนวน
        if data.get("dimensions") or (collected_data and "dimensions" in str(collected_data)):
            return ["500", "1,000", "2,000", "5,000"]
        # ยังไม่มี dimensions → พิมพ์เอง
        return []

    # ===================================
    # Step 6: Checkpoint 1 — สรุปรอ confirm
    # ===================================
    if current_step == 6:
        if is_waiting_confirmation:
            return ["ยืนยัน ✓", "ขอแก้ไข"]
        return []

    # ===================================
    # Step 7: Mood & Tone (Optional)
    # ===================================
    if current_step == 7:
        return ["มินิมอล", "น่ารัก/สดใส", "หรูหรา/พรีเมียม", "ข้าม"]

    # ===================================
    # Step 8: Logo (มี sub_step)
    # ===================================
    if current_step == 8:
        if sub_step == 0:
            return ["มีโลโก้", "ไม่มีโลโก้"]
        if sub_step == 1:
            return ["ด้านบน", "ด้านกว้าง", "ด้านยาว", "ทุกด้าน"]

    # ===================================
    # Step 9: Special Effects (Optional)
    # ===================================
    if current_step == 9:
        if sub_step == 0:
            return ["ไม่ต้องการ", "เคลือบเงา", "เคลือบด้าน", "ปั๊มนูน"]
        if sub_step == 1:
            return ["เคยทำบล็อก", "ยังไม่เคย"]

    # ===================================
    # Step 10: Checkpoint 2 — สรุปรอ confirm
    # ===================================
    if current_step == 10:
        if is_waiting_confirmation:
            return ["ยืนยัน ✓", "ขอแก้ไข"]
        return []

    # ===================================
    # Step 11-12: Mockup / Quote → ไม่ต้องมีปุ่ม
    # ===================================

    # ===================================
    # Step 13: ยืนยันคำสั่งซื้อ
    # ===================================
    if current_step == 13:
        return ["ยืนยันสั่งผลิต ✓", "ขอแก้ไข", "ยกเลิก"]

    # ===================================
    # Default — ไม่มีปุ่ม
    # ===================================
    return []