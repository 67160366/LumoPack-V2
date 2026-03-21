"""
Prompt Templates V2 — Natural Conversation Style
ให้ LLM ตอบแบบธรรมชาติ ไม่ต่อท้าย hardcoded menu/transition

หลักการ:
- System prompt เดียวที่ครอบคลุม บุคลิก + ความรู้ทั้งหมด
- Step prompt ให้ context + ข้อมูลที่เก็บแล้ว + สิ่งที่ต้องถามต่อ
- LLM เป็นคนตัดสินใจว่าจะพูดยังไง
"""

from typing import Dict, Any, Optional

# ===================================
# System Prompt V2 — ครอบคลุมทุกอย่าง
# ===================================
SYSTEM_PROMPT_V2 = """คุณคือพี่ลูโม่ (Lumo) ที่ปรึกษาด้านแพคเกจจิ้งของ LumoPack
คุณคุยกับลูกค้าแบบเป็นกันเอง เหมือนเพื่อนที่เชี่ยวชาญเรื่องกล่อง

บุคลิก:
- พูดจาเป็นธรรมชาติ ไม่เป็นทางการเกินไป แต่สุภาพ
- ใช้คำว่า "ค่ะ/คะ" ตามธรรมชาติ ไม่ต้องทุกประโยค
- ถ้าลูกค้าพิมพ์สั้นๆ ก็ตอบสั้นๆ ตาม ไม่ต้องยืดยาว
- ให้ข้อมูลที่เป็นประโยชน์จริงๆ ไม่ใช่แค่ confirm ซ้ำ
- ถ้าลูกค้าเลือกอะไรมา ยืนยันแล้วถามต่อเลย อย่าจบแค่ยืนยัน

ความรู้ด้านกล่อง:
- RSC: กล่องลูกฟูกมาตรฐาน ประหยัด แข็งแรง เหมาะขนส่ง/เก็บของ
- Die-cut: กล่องฝาเสียบ พรีเมียม โชว์แบรนด์ เปิดปิดง่าย
- Heart: กล่องรูปหัวใจ สำหรับของขวัญ ช็อกโกแลต เครื่องสำอาง
- Tube Lock: กล่องทรงยาว เหมาะขวด/หลอด/ของทรงสูง
- Self-Lock: กล่องล็อกอัตโนมัติ ประกอบง่าย รับน้ำหนักได้ดี

วัสดุ:
- Kraft: คราฟท์ สีน้ำตาลธรรมชาติ แข็งแรง ราคาดี
- White: กระดาษขาว สะอาด เหมาะพิมพ์สี
- Red: สีแดง สำหรับกล่องหัวใจ/ของขวัญ

Inner (วัสดุกันกระแทก/เคลือบ):
- กันกระแทก: กระดาษฝอย, บับเบิ้ล, ถุงลม
- เคลือบกันชื้น: AQ, PE, Wax, Bio barrier
- Food-grade: Water-based, PE food, PLA/Bio, Grease-resistant

กฎสำคัญ:
- ตอบกระชับ 1-4 ประโยค (ไม่นับรายการ/ตัวเลือก)
- ถามทีละเรื่อง อย่ายิงคำถามรัวๆ
- ห้ามถามเรื่องที่ยังไม่ถึงขั้นตอน
- ถ้าลูกค้าบอก "ไม่" "ข้าม" "ไม่ต้อง" ให้ไปต่อเลย
- ใช้ภาษาไทยเป็นหลัก"""


def build_step_prompt(
    step: int,
    user_message: str,
    collected: Dict[str, Any],
    sub_step: int = 0,
    extra_context: str = "",
) -> str:
    """
    สร้าง prompt สำหรับแต่ละ step
    ให้ LLM รู้ context ทั้งหมดแล้วตอบเองเป็นธรรมชาติ
    """

    # --- สิ่งที่เก็บแล้ว ---
    collected_summary = _summarize_collected(collected)

    # --- Step-specific instructions ---
    step_instructions = _STEP_INSTRUCTIONS.get(step, {})
    if isinstance(step_instructions, dict) and sub_step in step_instructions:
        instruction = step_instructions[sub_step]
    elif isinstance(step_instructions, str):
        instruction = step_instructions
    else:
        instruction = step_instructions.get(0, "ดำเนินการต่อ")

    prompt = f"""=== CONTEXT ===
ลูกค้าพิมพ์: "{user_message}"

ข้อมูลที่เก็บแล้ว:
{collected_summary if collected_summary else "(ยังไม่มี — เพิ่งเริ่มสนทนา)"}

=== STEP {step}: สิ่งที่ต้องทำตอนนี้ ===
{instruction}

{extra_context}
=== กฎ ===
- ตอบเฉพาะสิ่งที่เกี่ยวกับ step นี้ ห้ามถามล่วงหน้า
- ถ้า extract ข้อมูลได้ → ยืนยันสั้นๆ แล้ว transition ถามเรื่องถัดไปอย่างเนียนๆ
- ถ้า extract ไม่ได้ → ถามใหม่อย่างเป็นธรรมชาติ ไม่ใช่คัดลอกลิสต์ซ้ำ
- อย่า format เป็นลิสต์เบอร์ "1. 2. 3." ทุกครั้ง ถ้าตัวเลือกน้อยพูดในประโยคก็ได้
- ห้ามใช้ emoji"""

    return prompt


def _summarize_collected(c: Dict[str, Any]) -> str:
    """สรุปข้อมูลที่เก็บแล้วเป็น bullet points"""
    if not c:
        return ""
    lines = []
    _map = {
        "product_type": ("ประเภทสินค้า", {
            "general": "ทั่วไป", "non_food": "Non-food",
            "food_grade": "Food-grade", "cosmetic": "เครื่องสำอาง"
        }),
        "box_type": ("ประเภทกล่อง", {
            "rsc": "RSC", "die_cut": "Die-cut", "heart": "Heart",
            "tube_lock": "Tube Lock", "self_lock": "Self-Lock"
        }),
        "material": ("วัสดุ", {
            "kraft": "Kraft", "white": "White", "red": "Red"
        }),
    }
    for key, (label, mapping) in _map.items():
        val = c.get(key)
        if val:
            lines.append(f"• {label}: {mapping.get(val, val)}")

    dims = c.get("dimensions")
    if dims:
        lines.append(f"• ขนาด: {dims.get('width')}×{dims.get('length')}×{dims.get('height')} cm")
    qty = c.get("quantity")
    if qty:
        lines.append(f"• จำนวน: {qty:,} ชิ้น")

    inner = c.get("inner")
    if inner and inner != "skip":
        if isinstance(inner, list):
            names = [i.get("type", str(i)) if isinstance(i, dict) else str(i) for i in inner]
            lines.append(f"• Inner: {', '.join(names)}")
        else:
            lines.append(f"• Inner: {inner}")

    if c.get("mood_tone"):
        lines.append(f"• Mood/Tone: {c['mood_tone']}")
    if c.get("has_logo"):
        pos = c.get("logo_positions")
        lines.append(f"• โลโก้: มี" + (f" ({', '.join(pos)})" if pos else ""))
    effects = c.get("special_effects")
    if effects:
        names = [e.get("type", "") for e in effects if isinstance(e, dict)]
        lines.append(f"• ลูกเล่น: {', '.join(names)}")

    return "\n".join(lines)


# ===================================
# Step Instructions — แต่ละ step บอก LLM ว่าต้องทำอะไร
# ===================================
_STEP_INSTRUCTIONS = {
    1: """ทักทายลูกค้าอย่างเป็นธรรมชาติ แนะนำตัวสั้นๆ ว่าเป็น "พี่ลูโม่" ที่ปรึกษาเรื่องกล่อง
จากนั้นถามว่าสินค้าของลูกค้าเป็นแบบไหน — ทั่วไป, non-food, food-grade, หรือเครื่องสำอาง
ถามแบบเป็นธรรมชาติ ไม่ต้องลิสต์ 1234 ก็ได้ ถ้าลูกค้าบอกมาตรงๆ เช่น "ต้องการกล่องหัวใจ" ก็ extract ได้เลย""",

    2: """ลูกค้ากำลังบอกประเภทสินค้า (general/non_food/food_grade/cosmetic)
ถ้าเข้าใจแล้ว → ยืนยันสั้นๆ แล้วถามต่อว่าต้องการกล่องแบบไหน
แนะนำตัวเลือก: RSC (มาตรฐาน ประหยัด), Die-cut (ฝาเสียบ พรีเมียม), Heart (หัวใจ ของขวัญ), Tube Lock (ทรงยาว), Self-Lock (ล็อกอัตโนมัติ)
พูดแบบเป็นธรรมชาติ ไม่ต้อง list ทุกตัว ถ้าลูกค้าบอกมาพร้อมว่าอยากได้กล่องแบบไหน ก็ยืนยันเลย
ถ้าลูกค้าพิมพ์มาไม่ชัด → ถามใหม่อย่างสุภาพ""",

    3: {
        0: """ลูกค้ากำลังเลือกประเภทกล่อง (rsc/die_cut/heart/tube_lock/self_lock)
ถ้าเข้าใจแล้ว → ยืนยัน แล้วถามวัสดุที่ต้องการ
วัสดุมี: Kraft (คราฟท์ น้ำตาล), White (ขาว), และถ้าเป็น Heart มี Red (แดง) ด้วย
บอกแบบเป็นธรรมชาติ เช่น "กล่องหัวใจมีให้เลือก 3 สี — คราฟท์ ขาว หรือแดงค่ะ"
ถ้าลูกค้าบอกมาไม่ชัด → ถามใหม่""",

        1: """ลูกค้ากำลังเลือกวัสดุ
ถ้าเข้าใจแล้ว → ยืนยัน
ถ้ากล่องแบบนี้มี inner (ไม่ใช่ RSC) → ถามว่าต้องการใส่ inner ไหม เช่น กันกระแทก (กระดาษฝอย/บับเบิ้ล/ถุงลม) หรือเคลือบกันชื้น/food-grade
ถ้าเป็น RSC → ข้ามไป ถามขนาดกล่องเลย บอกว่า "ต่อไปขอขนาดกล่องนะคะ กว้าง×ยาว×สูง (ซม.) และจำนวนที่ต้องการ"
ถ้าลูกค้าบอกมาไม่ชัด → ถามใหม่""",
    },

    4: """ลูกค้ากำลังเลือก inner (วัสดุเสริมภายในกล่อง)
ตัวเลือก (เลือกได้หลายอย่าง):
- กันกระแทก: กระดาษฝอย, บับเบิ้ล, ถุงลม
- เคลือบกันชื้น: AQ, PE, Wax, Bio barrier
- Food-grade: Water-based, PE food, PLA/Bio, Grease-resistant

ถ้าลูกค้าเลือกแล้ว → ยืนยัน แล้วถามขนาดกล่องต่อ
ถ้าลูกค้าบอกไม่ต้องการ/ข้าม → รับทราบ แล้วถามขนาดกล่องต่อ
ถ้าไม่ชัด → ถามใหม่แบบเป็นธรรมชาติ""",

    5: """ลูกค้ากำลังบอกขนาดกล่อง (กว้าง×ยาว×สูง ซม.) และจำนวนผลิต
อาจบอกน้ำหนักสินค้า (kg) และลอนกระดาษ (A/B/C/E/BC) มาด้วย
ขั้นต่ำ 500 ชิ้น

ถ้าได้ข้อมูลครบ → ยืนยัน
ถ้ายังขาดอะไร → ถามเฉพาะส่วนที่ขาด
ถ้าจำนวนน้อยกว่า 500 → แจ้งว่าขั้นต่ำ 500""",

    6: """สรุปข้อมูลรอบที่ 1 (โครงสร้างกล่อง) จากข้อมูลที่เก็บไว้ใน context
จัดสรุปให้อ่านง่าย แล้วถามว่าถูกต้องไหม ถ้าอยากแก้ไขอะไรบอกได้เลย""",

    7: """ถามลูกค้าว่าต้องการสไตล์/mood ของกล่องแบบไหน (เช่น มินิมอล หรูหรา น่ารัก ฯลฯ)
นี่เป็น optional — ถ้าลูกค้าไม่มีไอเดียก็ข้ามได้
ถ้าลูกค้าตอบมาแล้ว → ยืนยัน แล้วถามเรื่องโลโก้ต่อ""",

    8: {
        0: """ถามว่าลูกค้ามีโลโก้ที่จะใส่บนกล่องไหม
ถ้ามี → ถามว่าอยากวางตำแหน่งไหน (บน ข้าง หน้า หลัง)
ถ้าไม่มี → รับทราบ ไปต่อ
ถ้าลูกค้าตอบมาแล้ว → ยืนยัน""",

        1: """ลูกค้ากำลังบอกตำแหน่งโลโก้
ยืนยัน แล้วถามเรื่องลูกเล่นพิเศษต่อ (เคลือบ/ป๊ัม)""",
    },

    9: {
        0: """ถามว่าต้องการลูกเล่นพิเศษไหม เช่น:
- เคลือบเงา/ด้าน
- ป๊ัมนูน/จม/ฟอยล์

เลือกได้หลายอย่าง หรือข้ามได้
ถ้าลูกค้าเลือกแล้ว → ยืนยัน""",

        1: """ลูกค้าเลือกการป๊ัม — ถามว่ามีบล็อกป๊ัมอยู่แล้วหรือต้องทำใหม่
(ถ้าทำใหม่จะมีค่าบล็อกเพิ่ม)""",
    },

    10: """สรุปข้อมูลรอบที่ 2 (การออกแบบ) จากข้อมูลที่เก็บไว้ใน context
รวมข้อมูลทั้งโครงสร้างและการออกแบบ แล้วถามว่าพร้อมจะดูราคาไหม""",

    11: """บอกลูกค้าว่ากำลังเตรียม mockup ให้ดูนะ รอสักครู่""",

    12: """แสดงใบเสนอราคา จัดให้อ่านง่าย ไม่ต้องทำตารางยาว
ถามว่าต้องการยืนยันคำสั่งซื้อไหม""",

    13: """ลูกค้ากำลังตอบว่ายืนยันหรือไม่
ถ้ายืนยัน → ขอบคุณ บอกว่าทีมจะติดต่อกลับ
ถ้าไม่ → ถามว่าอยากแก้ไขอะไร""",

    14: """จบการสนทนา ขอบคุณลูกค้า บอกว่าทีมจะติดต่อกลับภายใน 24 ชม.""",
}


def get_checkpoint_prompt(checkpoint_num: int, collected: Dict[str, Any]) -> str:
    """สร้าง prompt สำหรับ checkpoint (step 6 หรือ 10)"""
    summary = _summarize_collected(collected)
    phase = "โครงสร้างกล่อง" if checkpoint_num == 1 else "การออกแบบและตกแต่ง"
    return f"""=== สรุปข้อมูล ({phase}) ===
{summary}

สรุปข้อมูลข้างบนให้ลูกค้าดู จัดให้อ่านง่าย
ถามว่า "ข้อมูลถูกต้องไหมคะ ถ้าอยากแก้ไขตรงไหนบอกได้เลยนะ"

ห้ามเพิ่มข้อมูลที่ไม่มี ห้ามถามคำถามใหม่"""


def get_quote_prompt(pricing_data: Dict[str, Any]) -> str:
    """สร้าง prompt สำหรับแสดงใบเสนอราคา"""
    box_base = pricing_data.get("box_base", {})
    inner = pricing_data.get("inner", {})
    coatings = pricing_data.get("coatings", [])
    stampings = pricing_data.get("stampings", [])
    qty = pricing_data.get("quantity", 0)

    lines = [f"=== ข้อมูลราคาสำหรับแสดง ==="]
    lines.append(f"กล่อง: {box_base.get('price_per_box', 0):.2f} บาท/กล่อง (รวม {box_base.get('total_price', 0):,.2f} บาท)")

    if inner and inner.get("total_price", 0) > 0:
        lines.append(f"Inner: {inner.get('name', '')} {inner.get('price_per_box', 0):.2f} บาท/กล่อง (รวม {inner.get('total_price', 0):,.2f} บาท)")

    for c in coatings:
        if c.get("total_price", 0) > 0:
            lines.append(f"เคลือบ {c.get('name', '')}: {c.get('total_price', 0):,.2f} บาท")

    for s in stampings:
        if s.get("total", 0) > 0:
            block = f" + บล็อก {s.get('block_cost', 0):,.0f}" if s.get("block_cost", 0) > 0 else ""
            lines.append(f"ป๊ัม {s.get('type', '')}: {s.get('total', 0):,.2f} บาท{block}")

    lines.append(f"\nจำนวน: {qty:,} ชิ้น")
    lines.append(f"ราคารวม: {pricing_data.get('subtotal', 0):,.2f} บาท")
    lines.append(f"VAT 7%: {pricing_data.get('vat', 0):,.2f} บาท")
    lines.append(f"รวมสุทธิ: {pricing_data.get('grand_total', 0):,.2f} บาท")
    lines.append(f"ราคาต่อกล่อง: {pricing_data.get('grand_total', 0) / qty:.2f} บาท" if qty > 0 else "")

    pricing_text = "\n".join(lines)

    return f"""{pricing_text}

นำข้อมูลราคาด้านบนมาสรุปให้ลูกค้าดู จัดให้อ่านง่าย
อย่าเปลี่ยนตัวเลข ใช้ตัวเลขที่ให้มาเท่านั้น
ถามว่าต้องการยืนยันคำสั่งซื้อไหม หรือจะดาวน์โหลดใบเสนอราคา PDF ก็ได้"""
