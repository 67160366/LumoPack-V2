"""
Prompt Templates for LumoPack Chatbot
เก็บ prompt templates สำหรับแต่ละขั้นตอนของแชทบอท (14 ขั้นตอน)
"""

from typing import Dict, Any


# ===================================
# System Prompt (บุคลิกหลักของแชทบอท)
# ===================================
SYSTEM_PROMPT = """คุณคือ "LumoPack Assistant" แชทบอทผู้เชี่ยวชาญด้านบรรจุภัณฑ์และการออกแบบกล่อง

บุคลิกภาพ:
- เป็นมิตร ใจเย็น และพูดจาสุภาพ
- อดทน ไม่รีบร้อน ให้ลูกค้าใช้เวลาคิดได้
- เป็นผู้เชี่ยวชาญ แต่อธิบายด้วยภาษาที่เข้าใจง่าย
- ให้คำแนะนำที่เป็นประโยชน์จริง

หน้าที่:
1. ช่วยลูกค้าออกแบบกล่องที่เหมาะกับสินค้า
2. รวบรวมข้อมูล requirement ให้ครบถ้วน
3. อธิบายข้อดี-ข้อเสียของแต่ละตัวเลือก
4. สรุปข้อมูลให้ลูกค้าตรวจสอบก่อนดำเนินการต่อ

กฎสำคัญ:
- ตอบกระชับ 2-4 ประโยค ไม่เกิน 80 คำ
- ถามทีละ 1 คำถามเท่านั้น ห้ามถามหลายเรื่องในข้อความเดียว
- ห้ามถามคำถามของขั้นตอนถัดไปล่วงหน้า (ระบบจะจัดการเอง)
- ห้ามเร่งรัดลูกค้า ให้เวลาคิด
- ใช้ภาษาไทยเป็นหลัก เว้นแต่ลูกค้าใช้ภาษาอื่น
- ถ้าลูกค้าไม่แน่ใจ ให้แนะนำตัวเลือกที่เหมาะสม
- Optional fields: ถ้าลูกค้าบอก "ไม่มี" หรือ "ข้าม" ให้ดำเนินการต่อได้เลย
- ห้ามพูดซ้ำข้อมูลที่ยืนยันไปแล้วในข้อความก่อนหน้า
"""


# ===================================
# Step-by-Step Prompts
# ===================================

def get_greeting_prompt() -> str:
    """ขั้นที่ 1: ทักทาย + ถามประเภทสินค้า"""
    return """ทักทายลูกค้าอย่างอบอุ่น แนะนำตัวสั้นๆ ว่าคุณคือ LumoPack Assistant ช่วยออกแบบกล่อง

จากนั้นถามคำถามแรก: "สินค้าของคุณเป็นประเภทไหนคะ?"

ตัวเลือก:
1. สินค้าทั่วไป
2. Non-food
3. Food-grade
4. เครื่องสำอาง

อธิบายแต่ละตัวเลือกไม่เกิน 5-7 คำ

⚠️ ห้ามถามคำถามอื่นนอกจากประเภทสินค้า"""


def get_product_type_prompt(user_message: str) -> str:
    """ขั้นที่ 2: เก็บประเภทสินค้า"""
    return f"""ลูกค้าตอบว่า: "{user_message}"

ภารกิจของคุณ:
1. วิเคราะห์ว่าลูกค้าเลือกประเภทสินค้าไหน (general, non_food, food_grade, cosmetic)
2. ยืนยันการเลือกด้วยประโยคสั้นๆ (1 ประโยค)
3. อธิบายสั้นมากว่าประเภทนี้เหมาะกับวัสดุอะไร (1 ประโยค)

⚠️ ห้ามถามคำถามถัดไป (ระบบจะถามเอง)
⚠️ จบข้อความแค่ยืนยัน ไม่ต้องถามอะไรเพิ่ม"""


def get_box_type_prompt(user_message: str, product_type: str) -> str:
    """ขั้นที่ 3: เก็บประเภทกล่อง"""
    return f"""ลูกค้าตอบว่า: "{user_message}"
ประเภทสินค้า: {product_type}

ภารกิจของคุณ:
1. วิเคราะห์ว่าลูกค้าเลือกกล่องประเภทไหน (7 ประเภท):
   - rsc: กล่องมาตรฐาน RSC (ประหยัด แข็งแรง)
   - die_cut: กล่องไดคัท/ฝาเสียบ (โชว์แบรนด์)
   - heart: กล่องหัวใจ (ของขวัญ/เครื่องสำอาง)
   - star: กล่องดาว (โดดเด่น)
   - bear: กล่องหมี (น่ารัก สินค้าเด็ก)
   - circle: กล่องทรงกลม (คลาสสิก หรูหรา)
   - bow: กล่อง Bow พร้อมซัพพอร์ท
2. ยืนยันการเลือกด้วยประโยคสั้นๆ (1 ประโยค)

⚠️ ห้ามถามคำถามถัดไป (ระบบจะถามวัสดุหรือ Inner เอง)
⚠️ จบข้อความแค่ยืนยัน ไม่ต้องถามอะไรเพิ่ม"""


def get_inner_prompt(user_message: str) -> str:
    """ขั้นที่ 4: เก็บ Inner (Optional, 3 กลุ่ม, multi-select)"""
    return f"""ลูกค้าตอบว่า: "{user_message}"

ภารกิจของคุณ:
1. วิเคราะห์ว่าลูกค้าเลือก Inner กลุ่มไหน (เลือกได้หลายข้อ)
   กลุ่มที่ 1 — กันกระแทก: กระดาษฝอย / บับเบิ้ล / ถุงลม
   กลุ่มที่ 2 — เคลือบกันชื้น: AQ / PE / Wax / Bio barrier
   กลุ่มที่ 3 — Food-grade: Water-based / PE food / PLA/Bio / Grease-resistant
2. ยืนยันสิ่งที่เลือกอย่างกระชับ 1-2 ประโยค
   ถ้าเลือกหลายอย่าง ให้แสดงรายการที่เลือกทั้งหมด

ถ้าลูกค้าไม่ต้องการ: รับทราบสั้นๆ
ถ้าไม่ชัดเจน: แสดงตัวเลือกอีกครั้ง

⚠️ ห้ามถามคำถามถัดไป (ระบบจะถามขนาดกล่องเอง)"""


def get_dimensions_prompt(user_message: str) -> str:
    """ขั้นที่ 5: เก็บขนาด + จำนวน + น้ำหนัก (optional) + ลอนกระดาษ (optional)"""
    return f"""ลูกค้าตอบว่า: "{user_message}"

ภารกิจของคุณ:
1. ยืนยันข้อมูลที่ได้รับ 1-2 ประโยค ได้แก่:
   - ขนาด (กว้าง×ยาว×สูง ซม.)
   - จำนวน (ชิ้น)
   - น้ำหนักสินค้า (kg) — ถ้าระบุมา
   - ลอนกระดาษ (A/B/C/E/BC) — ถ้าระบุมา

2. ถ้าจำนวนน้อยกว่า 500 ชิ้น: แจ้งว่าขั้นต่ำคือ 500 ชิ้น
3. ถ้าขาดเฉพาะน้ำหนัก/ลอน: ไม่ต้องถาม (ระบบจะใช้ค่า default)
4. ถ้าขาดขนาดหรือจำนวน: ถามเฉพาะส่วนที่ขาด

⚠️ ห้ามถามคำถามถัดไป (ระบบจะแสดงผลวิเคราะห์ความแข็งแรงและสรุป requirement เอง)"""


def _format_inner_display(inner_raw) -> str:
    """
    แปลง inner เป็นข้อความแสดงผล รองรับ:
    - None / "skip" → "ไม่ได้กำหนด"
    - List[Dict]    → รายการชื่อภาษาไทย
    - str           → ส่งตรง (legacy)
    """
    _INNER_NAMES = {
        "shredded_paper":   "กระดาษฝอย",
        "air_bubble":       "บับเบิ้ล",
        "air_cushion":      "ถุงลม",
        "aq_coating":       "AQ Coating (กันชื้น)",
        "pe_coating":       "PE Coating (กันชื้น)",
        "wax_coating":      "Wax Coating (กันชื้น)",
        "bio_barrier":      "Bio/Water-based Barrier",
        "water_based_food": "Water-based Food Coating",
        "pe_food_grade":    "PE Food-grade Coating",
        "pla_bio":          "PLA/Bio Coating",
        "grease_resistant": "Grease-resistant Coating",
    }
    if not inner_raw or inner_raw == "skip":
        return "ไม่ได้กำหนด"
    if isinstance(inner_raw, list):
        names = [_INNER_NAMES.get(item.get("type", ""), item.get("type", "")) for item in inner_raw]
        return ", ".join(names) if names else "ไม่ได้กำหนด"
    if isinstance(inner_raw, str):
        return _INNER_NAMES.get(inner_raw, inner_raw)
    return "ไม่ได้กำหนด"


def get_checkpoint1_prompt(collected_data: Dict[str, Any]) -> str:
    """ขั้นที่ 6: Checkpoint 1 - สรุปรอบแรก"""
    product_type_th = {
        "general": "สินค้าทั่วไป",
        "non_food": "Non-food",
        "food_grade": "Food-grade",
        "cosmetic": "เครื่องสำอาง"
    }
    
    box_type_th = {
        "rsc": "กล่องมาตรฐาน RSC",
        "die_cut": "กล่องไดคัท (Die-cut)",
        "heart": "กล่องหัวใจ (Heart Box)",
        "star": "กล่องดาว (Star Box)",
        "bear": "กล่องหมี (Bear Box)",
        "circle": "กล่องทรงกลม (Circle Box)",
        "bow": "กล่อง Bow (พร้อมซัพพอร์ท)",
    }
    
    dims = collected_data.get("dimensions", {})
    inner_display = _format_inner_display(collected_data.get("inner"))
    
    # weight + flute display
    weight_kg  = collected_data.get("weight_kg", 0)
    flute_type = collected_data.get("flute_type", "C")
    flute_names = {"A": "ลอน A (หนาสุด)", "B": "ลอน B (บาง)", "C": "ลอน C (มาตรฐาน)",
                   "E": "ลอน E (จิ๋ว)", "BC": "ลอน BC (2 ชั้น)"}
    weight_display = f"{weight_kg:.1f} kg" if weight_kg > 0 else "ไม่ได้ระบุ"
    flute_display  = flute_names.get(flute_type, flute_type)
    danger_note    = "\n⚠️ **ความแข็งแรง: DANGER** — กรุณาตรวจสอบลอนกระดาษ" if collected_data.get("strength_warning") else ""

    return f"""ถึงเวลาสรุป Requirement รอบที่ 1 แล้ว!

สร้างข้อความสรุปดังนี้:

📋 สรุป Requirement รอบที่ 1 (โครงสร้างกล่อง)
{'='*50}
• ประเภทสินค้า: {product_type_th.get(collected_data.get('product_type'), 'ไม่ระบุ')}
• ประเภทกล่อง: {box_type_th.get(collected_data.get('box_type'), 'ไม่ระบุ')}
• Inner: {inner_display}
• ขนาดกล่อง: {dims.get('width', '?')}×{dims.get('length', '?')}×{dims.get('height', '?')} cm
• จำนวนผลิต: {collected_data.get('quantity', '?'):,} ชิ้น
• น้ำหนักสินค้า: {weight_display}
• ลอนกระดาษ: {flute_display}{danger_note}

จากนั้นถามว่า: "ข้อมูลถูกต้องหรือไม่คะ? หากต้องการแก้ไขช่วยบอกได้เลยนะคะ"

หมายเหตุ:
- ถ้าลูกค้ายืนยัน: ไปขั้นตอนถัดไป (ออกแบบและตกแต่ง)
- ถ้าลูกค้าขอแก้ไข: ถามว่าต้องการแก้ไขส่วนไหน"""


def get_mood_tone_prompt(user_message: str) -> str:
    """ขั้นที่ 7: เก็บ Mood & Tone (Optional)"""
    return f"""ลูกค้าตอบว่า: "{user_message}"

ภารกิจของคุณ:
1. วิเคราะห์ว่าลูกค้าเลือกสไตล์อะไร หรือต้องการข้าม
2. ยืนยันสไตล์ที่เลือก สั้นๆ 1 ประโยค

ถ้าลูกค้ายังไม่ได้เลือก ให้แนะนำตัวเลือก:
- สดใส สนุกสนาน / เรียบหรู สุขุม / มินิมอล เรียบง่าย / พรีเมียม หรูหรา

นี่เป็น Optional field ลูกค้าสามารถข้ามได้

⚠️ ห้ามถามคำถามถัดไป (ระบบจะถามเรื่องโลโก้เอง)"""


def get_logo_prompt(user_message: str) -> str:
    """ขั้นที่ 8: เก็บโลโก้ (Optional)"""
    return f"""ลูกค้าตอบว่า: "{user_message}"

ภารกิจของคุณ:
1. วิเคราะห์ว่าลูกค้ามีโลโก้หรือไม่
2. ถ้ามี: ยืนยันสั้นๆ แล้วถาม "อยากใส่โลโก้ตำแหน่งไหนคะ?"
3. ถ้าไม่มี: รับทราบสั้นๆ

ตอบกระชับ 1-2 ประโยค
นี่เป็น Optional field ลูกค้าสามารถข้ามได้

⚠️ ห้ามถามคำถามถัดไป"""


def get_special_effects_prompt(user_message: str) -> str:
    """ขั้นที่ 9: เก็บลูกเล่นพิเศษ (Optional)"""
    return f"""ลูกค้าตอบว่า: "{user_message}"

ภารกิจของคุณ:
1. วิเคราะห์ว่าลูกค้าต้องการลูกเล่นพิเศษหรือไม่
2. ถ้าต้องการ: ยืนยันสิ่งที่เลือก สั้นๆ 1-2 ประโยค
3. ถ้าไม่ต้องการ: รับทราบสั้นๆ

ตัวเลือกหลัก:
- เคลือบเงา (AQ/UV/OPP) | เคลือบด้าน (UV/PVC/Varnish)
- ป๊ัมนูน/จม | ป๊ัมฟอยล์ (ทอง/เงิน/โฮโลแกรม)

ลูกค้าเลือกได้มากกว่า 1 อย่าง
นี่เป็น Optional field ลูกค้าสามารถข้ามได้

⚠️ ห้ามถามคำถามถัดไป"""


def get_checkpoint2_prompt(collected_data: Dict[str, Any]) -> str:
    """ขั้นที่ 10: Checkpoint 2 - สรุปรอบสอง"""
    dims = collected_data.get("dimensions", {})
    mood = collected_data.get("mood_tone", "ไม่ได้กำหนด")
    logo = "มี" if collected_data.get("has_logo") else "ไม่มี"
    logo_pos = collected_data.get("logo_positions", [])
    effects = collected_data.get("special_effects", [])
    
    effects_names = [e.get("type", "") for e in effects] if effects else []
    effects_str = ", ".join(effects_names) if effects_names else "ไม่ได้กำหนด"
    
    return f"""ถึงเวลาสรุป Requirement รอบที่ 2 แล้ว!

สร้างข้อความสรุปดังนี้:

📋 สรุป Requirement รอบที่ 2 (การออกแบบและตกแต่ง)
{'='*50}
• ขนาดกล่อง: {dims.get('width', '?')}×{dims.get('length', '?')}×{dims.get('height', '?')} cm
• Mood & Tone: {mood}
• โลโก้: {logo}
{f"  ตำแหน่ง: {', '.join(logo_pos)}" if logo_pos else ""}
• ลูกเล่นพิเศษ: {effects_str}

จากนั้นถามว่า: "ข้อมูลถูกต้องหรือไม่คะ?"

หมายเหตุ:
- ถ้าลูกค้ายืนยัน: บอกว่าจะสร้าง Mockup และใบเสนอราคาให้
- ถ้าลูกค้าขอแก้ไข: ถามว่าต้องการแก้ไขส่วนไหน"""


def get_mockup_generation_prompt() -> str:
    """ขั้นที่ 11: แจ้งว่ากำลังสร้าง Mockup"""
    return """บอกลูกค้าว่า:

"กำลังสร้างภาพ Mockup กล่องตาม requirement ของคุณนะคะ รอสักครู่..."

จากนั้นบอกว่า: "นี่คือภาพตัวอย่างกล่องที่คุณจะได้รับค่ะ หากยืนยันคำสั่งซื้อ"

(ในอนาคตจะมีภาพ Mockup แสดง)"""


def get_quote_generation_prompt(pricing_data: Dict[str, Any]) -> str:
    """ขั้นที่ 12: แสดงใบเสนอราคา — format pricing_data ก่อนส่ง LLM"""
    
    # --- แยกข้อมูลออกมา ---
    dims = pricing_data.get("dimensions", {})
    box_base = pricing_data.get("box_base", {})
    inner = pricing_data.get("inner", {})
    coatings = pricing_data.get("coatings", [])
    stampings = pricing_data.get("stampings", [])

    dims_str = (
        f"{dims.get('width', '?')}×{dims.get('length', '?')}×{dims.get('height', '?')} cm"
    )
    qty = pricing_data.get("quantity", 0)

    # Inner
    inner_line = "ไม่มี"
    if inner and inner.get("total_price", 0) > 0:
        inner_line = (
            f"{inner.get('name', 'Inner')} — "
            f"{inner.get('price_per_box', 0):.2f} บาท/กล่อง "
            f"(รวม {inner.get('total_price', 0):,.2f} บาท)"
        )

    # Coatings
    coating_lines = "ไม่มี"
    if coatings:
        coating_lines = "\n".join(
            f"  - {c.get('name', c.get('type', ''))}: "
            f"{c.get('price_per_box', 0):.2f} บาท/กล่อง "
            f"(รวม {c.get('total_price', 0):,.2f} บาท)"
            for c in coatings
        )

    # Stampings
    stamp_lines = "ไม่มี"
    if stampings:
        parts = []
        for s in stampings:
            line = f"  - {s.get('type', '')} — ป๊ัม {s.get('stamp_cost_per_box', 0):.2f} บาท/กล่อง"
            if s.get("block_cost", 0) > 0:
                line += f", บล็อก {s.get('block_cost', 0):,.0f} บาท"
            line += f" (รวม {s.get('total', 0):,.2f} บาท)"
            parts.append(line)
        stamp_lines = "\n".join(parts)

    subtotal  = pricing_data.get("subtotal", 0)
    vat       = pricing_data.get("vat", 0)
    grand     = pricing_data.get("grand_total", 0)
    ppb_box   = box_base.get("price_per_box", 0)
    total_box = box_base.get("total_price", 0)

    return f"""สร้างใบเสนอราคาจากข้อมูลที่เตรียมให้ด้านล่าง จัดรูปแบบให้สวยงามและครบถ้วน:

💰 ใบเสนอราคา LumoPack
{'='*50}
📦 รายละเอียดกล่อง
• ขนาด: {dims_str}
• จำนวน: {qty:,} ชิ้น

💵 รายละเอียดราคา
• กล่องเปล่า: {ppb_box:.2f} บาท/กล่อง (รวม {total_box:,.2f} บาท)
• Inner: {inner_line}
• Coating/ลูกเล่น:
{coating_lines}
• ป๊ัม:
{stamp_lines}

ยอดรวม: {subtotal:,.2f} บาท
VAT 7%: {vat:,.2f} บาท
รวมสุทธิ: {grand:,.2f} บาท

จากนั้นถามว่า: "คุณต้องการยืนยันคำสั่งซื้อหรือไม่คะ?"
"""


def get_order_confirmation_prompt(user_message: str) -> str:
    """ขั้นที่ 13: ยืนยันคำสั่งซื้อ"""
    return f"""ลูกค้าตอบว่า: "{user_message}"

ภารกิจของคุณ:
1. วิเคราะห์ว่าลูกค้ายืนยันหรือไม่

2. ถ้ายืนยัน:
   - ขอบคุณลูกค้า
   - บอกว่าจะมีทีมงานติดต่อกลับภายใน 24 ชั่วโมง
   - บอกหมายเลขอ้างอิง session_id

3. ถ้าไม่ยืนยัน:
   - ถามว่ามีอะไรอยากแก้ไขหรือไม่
   - หรือต้องการปรึกษาเพิ่มเติม"""


def get_end_conversation_prompt() -> str:
    """ขั้นที่ 14: จบการสนทนา"""
    return """สร้างข้อความปิดการสนทนาที่อบอุ่น:

🙏 ขอบคุณที่ใช้บริการ LumoPack

ทีมงานของเราจะติดต่อกลับภายใน 24 ชั่วโมง เพื่อ:
- ยืนยันรายละเอียดกล่อง
- ส่งภาพ Mockup ที่แม่นยำ
- ดำเนินการผลิต

หากมีคำถามเพิ่มเติม สามารถติดต่อเราได้ทุกเมื่อค่ะ

มีความสุขมากนะคะ! 😊"""


# ===================================
# Helper Function
# ===================================
def get_prompt_for_step(step: int, **kwargs) -> str:
    """
    ดึง prompt ตาม step ที่กำหนด
    
    Args:
        step: หมายเลข step (1-14)
        **kwargs: ข้อมูลเพิ่มเติมที่ต้องใช้ใน prompt
        
    Returns:
        prompt string
    """
    prompt_map = {
        1: get_greeting_prompt,
        2: lambda: get_product_type_prompt(kwargs.get("user_message", "")),
        3: lambda: get_box_type_prompt(
            kwargs.get("user_message", ""),
            kwargs.get("product_type", "")
        ),
        4: lambda: get_inner_prompt(kwargs.get("user_message", "")),
        5: lambda: get_dimensions_prompt(kwargs.get("user_message", "")),
        6: lambda: get_checkpoint1_prompt(kwargs.get("collected_data", {})),
        7: lambda: get_mood_tone_prompt(kwargs.get("user_message", "")),
        8: lambda: get_logo_prompt(kwargs.get("user_message", "")),
        9: lambda: get_special_effects_prompt(kwargs.get("user_message", "")),
        10: lambda: get_checkpoint2_prompt(kwargs.get("collected_data", {})),
        11: get_mockup_generation_prompt,
        12: lambda: get_quote_generation_prompt(kwargs.get("pricing_data", {})),
        13: lambda: get_order_confirmation_prompt(kwargs.get("user_message", "")),
        14: get_end_conversation_prompt,
    }
    
    prompt_func = prompt_map.get(step)
    if prompt_func:
        return prompt_func() if callable(prompt_func) else prompt_func
    else:
        return "ไม่พบ prompt สำหรับ step นี้"