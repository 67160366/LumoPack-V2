"""
Data Extractor
แยก logic การ extract ข้อมูลจากข้อความลูกค้าออกมาจาก flow manager
เพื่อให้ทดสอบง่ายและ reuse ได้

ปรับปรุงจากเดิม:
- ใช้ word boundary matching แทน substring เพื่อลด false positive
- เพิ่ม special effects ให้ครบทุกตัวเลือกจาก Requirement
- เพิ่ม extract_logo_positions, extract_material
- เพิ่ม detect_edit_target สำหรับ checkpoint edits
"""

import re
from typing import Optional, Dict, List, Any
from models.chat_state import EDIT_KEYWORDS_TO_STEP


# ===================================
# 1. Product Type (Step 2)
# ===================================
def extract_product_type(message: str) -> Optional[str]:
    """
    Extract ประเภทสินค้า
    Returns: "general" | "non_food" | "food_grade" | "cosmetic" | None
    """
    msg = message.lower().strip()
    
    # เช็คแบบเรียงลำดับความจำเพาะ (specific → general)
    # cosmetic ก่อน เพราะ "เครื่องสำอาง" ชัดเจน
    if any(w in msg for w in ["เครื่องสำอาง", "cosmetic", "สำอาง", "ครีม", "เซรั่ม"]):
        return "cosmetic"
    
    # food_grade ก่อน non_food เพราะ "food" อยู่ในทั้งคู่
    if any(w in msg for w in ["food-grade", "food grade", "อาหาร", "ขนม", "เบเกอรี่"]):
        return "food_grade"
    
    if any(w in msg for w in ["non-food", "non food", "ไม่ใช่อาหาร"]):
        return "non_food"
    
    if any(w in msg for w in ["ทั่วไป", "general", "ธรรมดา"]):
        return "general"
    
    # Match ตัวเลขเดี่ยวๆ (ต้อง standalone ไม่ใช่ส่วนหนึ่งของตัวเลขอื่น)
    match = re.match(r'^\s*([1-4])\s*$', msg)
    if match:
        return {"1": "general", "2": "non_food", "3": "food_grade", "4": "cosmetic"}[match.group(1)]
    
    return None


# ===================================
# 2. Box Type (Step 3)
# ===================================
def extract_box_type(message: str) -> Optional[str]:
    """
    Extract ประเภทกล่อง
    Returns: "rsc" | "die_cut" | None
    """
    msg = message.lower().strip()
    
    if any(w in msg for w in ["rsc", "มาตรฐาน", "standard"]):
        return "rsc"
    
    # เช็ค die-cut / die cut / ไดคัท เป็นคำรวม
    if re.search(r'die[\s-]?cut|ไดคัท|ไดค์ท', msg):
        return "die_cut"
    
    # Match ตัวเลข
    match = re.match(r'^\s*([12])\s*$', msg)
    if match:
        return {"1": "rsc", "2": "die_cut"}[match.group(1)]
    
    return None


# ===================================
# 3. Material (Step 3 sub-step)
# ===================================
def extract_material(message: str, box_type: str) -> Optional[str]:
    """
    Extract วัสดุกล่อง
    RSC: corrugated_2layer, kraft_200gsm
    Die-cut: corrugated_2layer, cardboard, art_300gsm, whiteboard_350gsm
    """
    msg = message.lower().strip()
    
    if any(w in msg for w in ["ลูกฟูก", "corrugated"]):
        return "corrugated_2layer"
    if any(w in msg for w in ["คราฟท์", "craft", "kraft"]):
        return "kraft_200gsm"
    if any(w in msg for w in ["จั่วปัง", "กระดาษแข็ง", "cardboard"]):
        return "cardboard"
    if any(w in msg for w in ["อาร์ต", "art"]):
        return "art_300gsm"
    if any(w in msg for w in ["กล่องขาว", "กล่องแป้ง", "whiteboard"]):
        return "whiteboard_350gsm"
    
    # Match ตัวเลข
    match = re.match(r'^\s*([1-5])\s*$', msg)
    if match:
        num = match.group(1)
        if box_type == "rsc":
            return {"1": "corrugated_2layer", "2": "kraft_200gsm"}.get(num)
        else:
            return {
                "1": "corrugated_2layer", "2": "cardboard",
                "3": "art_300gsm", "4": "whiteboard_350gsm"
            }.get(num)
    
    return None


# ===================================
# 4. Inner (Step 4) — Approach B: Multi-select, แสดงตัวเลือกครบทั้ง 3 กลุ่ม
# ===================================

# ตาราง mapping หมายเลข → inner type (ตรงกับตัวเลือกที่แสดงให้ลูกค้า)
_INNER_NUMBER_MAP: Dict[str, Dict[str, str]] = {
    "1":  {"type": "shredded_paper",   "category": "cushion"},
    "2":  {"type": "air_bubble",        "category": "cushion"},
    "3":  {"type": "air_cushion",       "category": "cushion"},
    "4":  {"type": "aq_coating",        "category": "moisture"},
    "5":  {"type": "pe_coating",        "category": "moisture"},
    "6":  {"type": "wax_coating",       "category": "moisture"},
    "7":  {"type": "bio_barrier",       "category": "moisture"},
    "8":  {"type": "water_based_food",  "category": "food_grade"},
    "9":  {"type": "pe_food_grade",     "category": "food_grade"},
    "10": {"type": "pla_bio",           "category": "food_grade"},
    "11": {"type": "grease_resistant",  "category": "food_grade"},
}


def extract_inner(message: str) -> Optional[List[Dict[str, Any]]]:
    """
    Extract inner selections (multi-select, Approach B)
    
    รองรับทั้ง:
    - Number selection: "1", "1, 4", "1 และ 8"
    - Keyword selection: "กระดาษฝอย", "AQ coating กันชื้น"
    
    Returns: List[Dict] | "skip" | None
    Categories: cushion (กันกระแทก), moisture (กันชื้น), food_grade
    """
    msg = message.lower().strip()

    if is_skip_response(msg):
        return "skip"

    inners: List[Dict[str, Any]] = []
    seen_types: set = set()

    def _add(item: Dict[str, str]) -> None:
        """เพิ่ม inner โดยป้องกัน duplicate"""
        if item["type"] not in seen_types:
            inners.append(dict(item))
            seen_types.add(item["type"])

    # 1. Number-based selection (e.g. "1", "1, 3, 8", "ข้อ 2 และ 5")
    #    ใช้ \b เพื่อ match ตัวเลข 1-11 แบบ standalone เท่านั้น
    for num in re.findall(r'\b(1[01]?|[2-9])\b', msg):
        if num in _INNER_NUMBER_MAP:
            _add(_INNER_NUMBER_MAP[num])

    # 2. Keyword-based selection (fallback เมื่อลูกค้าพิมพ์ชื่อแทน)
    # --- กลุ่ม 1: แผ่นกันกระแทก ---
    if any(w in msg for w in ["กระดาษฝอย", "shredded", "ฝอย"]):
        _add({"type": "shredded_paper", "category": "cushion"})
    if any(w in msg for w in ["บับเบิ้ล", "bubble"]):
        _add({"type": "air_bubble", "category": "cushion"})
    if any(w in msg for w in ["ถุงลม", "air cushion"]):
        _add({"type": "air_cushion", "category": "cushion"})

    # --- กลุ่ม 2: เคลือบกันชื้น ---
    if any(w in msg for w in ["aq coating", "acrylic"]) and "กันชื้น" in msg:
        _add({"type": "aq_coating", "category": "moisture"})
    if any(w in msg for w in ["pe coating", "polyethylene"]) and "กันชื้น" in msg:
        _add({"type": "pe_coating", "category": "moisture"})
    if any(w in msg for w in ["wax", "paraffin"]):
        _add({"type": "wax_coating", "category": "moisture"})
    if any(w in msg for w in ["bio barrier", "water-based barrier"]):
        _add({"type": "bio_barrier", "category": "moisture"})

    # --- กลุ่ม 3: Food-grade coating ---
    if any(w in msg for w in ["water-based food", "food coating"]):
        _add({"type": "water_based_food", "category": "food_grade"})
    if any(w in msg for w in ["pe food", "pe food-grade"]):
        _add({"type": "pe_food_grade", "category": "food_grade"})
    if any(w in msg for w in ["pla", "bio coating"]):
        _add({"type": "pla_bio", "category": "food_grade"})
    if any(w in msg for w in ["grease", "กันน้ำมัน"]):
        _add({"type": "grease_resistant", "category": "food_grade"})

    return inners if inners else None


# ===================================
# 5. Dimensions & Quantity (Step 5)
# ===================================
def extract_dimensions(message: str) -> Optional[Dict[str, float]]:
    """
    Extract ขนาดกล่อง (กว้าง × ยาว × สูง)
    
    รองรับ:
    - "20x15x10", "20*15*10", "20×15×10"
    - "กว้าง 20 ยาว 15 สูง 10"
    - "width 20 length 15 height 10"
    """
    text = re.sub(r'[,\s]+', ' ', message)
    
    # Pattern 1: 20x15x10
    match = re.search(r'(\d+(?:\.\d+)?)\s*[x*×]\s*(\d+(?:\.\d+)?)\s*[x*×]\s*(\d+(?:\.\d+)?)', text, re.IGNORECASE)
    if match:
        return _make_dims(match.group(1), match.group(2), match.group(3))
    
    # Pattern 2: กว้าง X ยาว Y สูง Z
    match = re.search(r'กว้าง\s*(\d+(?:\.\d+)?).{0,10}ยาว\s*(\d+(?:\.\d+)?).{0,10}สูง\s*(\d+(?:\.\d+)?)', text)
    if match:
        return _make_dims(match.group(1), match.group(2), match.group(3))
    
    # Pattern 3: width X length Y height Z
    match = re.search(r'width\s*(\d+(?:\.\d+)?).{0,10}length\s*(\d+(?:\.\d+)?).{0,10}height\s*(\d+(?:\.\d+)?)', text, re.IGNORECASE)
    if match:
        return _make_dims(match.group(1), match.group(2), match.group(3))
    
    return None


def _make_dims(w: str, l: str, h: str) -> Dict[str, float]:
    return {"width": float(w), "length": float(l), "height": float(h)}


def extract_quantity(message: str) -> Optional[int]:
    """
    Extract จำนวนกล่อง (ขั้นต่ำ 500)
    
    รองรับ:
    - "จำนวน 1000", "1000 ชิ้น", "1000 กล่อง"
    - "quantity 1000"
    """
    patterns = [
        r'จำนวน\s*(\d[\d,]*)',
        r'(\d[\d,]*)\s*ชิ้น',
        r'(\d[\d,]*)\s*กล่อง',
        r'(\d[\d,]*)\s*ใบ',
        r'quantity\s*[:\s]*(\d[\d,]*)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            qty = int(match.group(1).replace(",", ""))
            if qty >= 500:
                return qty
    
    # Fallback: หาตัวเลข >= 500 ที่ไม่ใช่ส่วนหนึ่งของ dimensions
    # (ต้องไม่มี x หรือ * อยู่ข้างๆ)
    for match in re.finditer(r'(?<![x*×\d])(\d[\d,]*)(?![x*×\d])', message):
        num = int(match.group(1).replace(",", ""))
        if num >= 500:
            return num
    
    return None


# ===================================
# 6. Logo (Step 8)
# ===================================
def extract_has_logo(message: str) -> Optional[bool]:
    """เช็คว่าลูกค้ามีโลโก้หรือไม่"""
    msg = message.lower().strip()
    
    if is_skip_response(msg):
        return False
    # เช็ค negative compound ก่อน positive เสมอ
    # เพราะ "ไม่มี" มี "มี" เป็น substring → ต้องเช็ค "ไม่มี" ก่อน
    if any(w in msg for w in ["ไม่มี", "ไม่ต้อง", "ไม่เอา", "no"]):
        return False
    if any(w in msg for w in ["มี", "ใช่", "yes", "ต้องการ", "อยาก"]):
        return True
    return None


def extract_logo_positions(message: str) -> Optional[List[str]]:
    """
    Extract ตำแหน่งโลโก้
    ตาม Requirement: ด้านบน/ล่าง/บนและล่าง/กว้าง 1-2 ด้าน/ยาว 1-2 ด้าน/ทุกด้าน
    """
    msg = message.lower().strip()
    positions = []
    
    position_map = {
        "ทุกด้าน": "all_sides",
        "ด้านบนและล่าง": "top_bottom",
        "บนและล่าง": "top_bottom",
        "ด้านบน": "top",
        "ด้านล่าง": "bottom",
        "ด้านกว้าง 2 ด้าน": "width_both",
        "กว้าง 2 ด้าน": "width_both",
        "ด้านกว้าง 1 ด้าน": "width_one",
        "กว้าง 1 ด้าน": "width_one",
        "ด้านกว้าง": "width_one",
        "ด้านยาว 2 ด้าน": "length_both",
        "ยาว 2 ด้าน": "length_both",
        "ด้านยาว 1 ด้าน": "length_one",
        "ยาว 1 ด้าน": "length_one",
        "ด้านยาว": "length_one",
        "ด้านกว้างและยาว": "width_and_length",
        "กว้างและยาว": "width_and_length",
    }
    
    # เช็ค compound terms ก่อน (ยาวกว่า = specific กว่า)
    for thai_term, code in sorted(position_map.items(), key=lambda x: -len(x[0])):
        if thai_term in msg and code not in positions:
            positions.append(code)
    
    return positions if positions else None


# ===================================
# 7. Special Effects (Step 9)
# ===================================
def extract_special_effects(message: str) -> Optional[List[Dict[str, Any]]]:
    """
    Extract ลูกเล่นพิเศษ — ครบทุกตัวเลือกจาก Requirement
    รองรับการเลือกหลายตัวเลือกพร้อมกัน
    """
    msg = message.lower().strip()
    
    if is_skip_response(msg):
        return "skip"
    
    effects = []
    
    # --- เคลือบเงา (Gloss) ---
    if any(w in msg for w in ["opp", "opp gloss"]):
        effects.append({"type": "opp_gloss", "category": "gloss"})
    elif any(w in msg for w in ["uv gloss", "uv เงา"]):
        effects.append({"type": "uv_gloss", "category": "gloss"})
    elif "aq" in msg and any(w in msg for w in ["เงา", "gloss"]):
        effects.append({"type": "aq_gloss", "category": "gloss"})
    elif any(w in msg for w in ["เคลือบเงา"]):
        # Default gloss ถ้าไม่ระบุชนิด
        effects.append({"type": "aq_gloss", "category": "gloss"})
    
    # --- เคลือบด้าน (Matte) ---
    if any(w in msg for w in ["วานิช", "varnish"]):
        effects.append({"type": "varnish_matte", "category": "matte"})
    elif any(w in msg for w in ["ลามิเนต", "laminate", "pvc matte", "pvc"]):
        effects.append({"type": "pvc_matte", "category": "matte"})
    elif any(w in msg for w in ["uv ด้าน", "uv matte"]):
        effects.append({"type": "uv_matte", "category": "matte"})
    elif any(w in msg for w in ["เคลือบด้าน"]):
        effects.append({"type": "uv_matte", "category": "matte"})
    
    # --- ป๊ัมนูน ---
    if any(w in msg for w in ["ป๊ัมนูน", "emboss", "นูน"]) and "ฟอยล์" not in msg:
        effects.append({"type": "emboss", "category": "stamping", "has_block": False})
    
    # --- ป๊ัมจม ---
    if any(w in msg for w in ["ป๊ัมจม", "deboss", "จม"]):
        effects.append({"type": "deboss", "category": "stamping", "has_block": False})
    
    # --- ป๊ัมฟอยล์ ---
    if any(w in msg for w in ["ฟอยล์", "foil"]):
        # ฟอยล์ + นูน
        if any(w in msg for w in ["นูน", "emboss", "ฟอยล์+นูน", "foil+emboss"]):
            effects.append({"type": "foil_emboss", "category": "stamping", "has_block": False})
        # ฟอยล์พิเศษ
        elif any(w in msg for w in ["โฮโลแกรม", "hologram", "rainbow", "เรนโบว์", "ลาย"]):
            effects.append({"type": "foil_special", "category": "stamping", "has_block": False})
        # ฟอยล์ทั่วไป (ทอง/เงิน/โรสโกลด์)
        else:
            foil_type = "foil_regular"
            if any(w in msg for w in ["ละเอียด", "ลายใหญ่", "detailed"]):
                foil_type = "foil_detailed"
            effects.append({"type": foil_type, "category": "stamping", "has_block": False})
    
    return effects if effects else None


def extract_has_existing_block(message: str) -> Optional[bool]:
    """เช็คว่าลูกค้าเคยทำบล็อกป๊ัมกับเรามาก่อนหรือไม่"""
    msg = message.lower().strip()
    
    # เช็ค negative compound ก่อน positive เสมอ
    # เพราะ "ไม่เคย" มี "เคย" เป็น substring → ต้องเช็ค "ไม่เคย" ก่อน
    # ไม่ใช้ bare "ไม่" เพราะ match "จำไม่ได้" ซึ่งเป็นความไม่แน่ใจ
    if any(w in msg for w in ["ไม่เคย", "ไม่มี", "ยังไม่", "ครั้งแรก", "no"]):
        return False
    if any(w in msg for w in ["เคย", "มี", "ใช่", "yes", "มีบล็อก"]):
        return True
    return None


# ===================================
# 8. Confirmation Responses
# ===================================
def is_confirmation(message: str) -> bool:
    """เช็คว่าลูกค้ายืนยัน"""
    msg = message.lower().strip()
    return any(w in msg for w in [
        "ใช่", "ถูก", "ถูกต้อง", "yes", "ok", "โอเค",
        "ยืนยัน", "confirm", "correct", "ครับ", "ค่ะ",
    ])


def is_rejection(message: str) -> bool:
    """เช็คว่าลูกค้าปฏิเสธ/ขอแก้ไข"""
    msg = message.lower().strip()
    return any(w in msg for w in [
        "แก้", "เปลี่ยน", "ไม่ถูก", "ไม่ใช่", "ผิด",
        "no", "wrong", "แก้ไข", "เพิ่ม", "ลด",
    ])


def is_skip_response(message: str) -> bool:
    """เช็คว่าลูกค้าอยากข้าม (สำหรับ optional steps)"""
    msg = message.lower().strip()
    
    # Exact match สำหรับคำสั้นๆ
    if msg in ("ไม่", "no", "pass", "skip", "ไม่ครับ", "ไม่ค่ะ"):
        return True
    
    # Compound keywords (ไม่ใช้ bare "ไม่" เพราะจะ match "ยังไม่แน่ใจ", "จำไม่ได้" ฯลฯ)
    return any(w in msg for w in [
        "ไม่ต้อง", "ไม่ต้องการ", "ไม่เอา", "ไม่มี",
        "ข้าม", "skip", "pass",
    ])


def is_add_request(message: str) -> bool:
    """เช็คว่าลูกค้าอยาก 'เพิ่ม' (ไม่ใช่ 'แก้ไข')"""
    msg = message.lower().strip()
    return any(w in msg for w in ["เพิ่ม", "add", "อยากได้เพิ่ม", "เพิ่มเติม"])


# ===================================
# 9. Edit Target Detection (สำหรับ Checkpoint)
# ===================================
def detect_edit_target(message: str) -> Optional[int]:
    """
    ตรวจจับว่าลูกค้าต้องการแก้ไข step ไหน
    ใช้ EDIT_KEYWORDS_TO_STEP จาก chat_state
    
    Returns: step number | None
    """
    msg = message.lower().strip()
    
    for step_num, keywords in EDIT_KEYWORDS_TO_STEP.items():
        if any(kw in msg for kw in keywords):
            return step_num
    
    return None