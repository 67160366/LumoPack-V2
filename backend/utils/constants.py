"""
LumoPack Constants
เก็บข้อมูลทั้งหมดจาก Requirement.pdf
- ประเภทสินค้า, ประเภทกล่อง, วัสดุ
- ราคาวัสดุ, Inner, Coating, ลูกเล่นพิเศษ
"""

# ===================================
# 1. ประเภทสินค้า (Product Types)
# ===================================
PRODUCT_TYPES = {
    "general": "สินค้าทั่วไป",
    "non_food": "Non-food",
    "food_grade": "Food-grade",
    "cosmetic": "เครื่องสำอาง"
}

# ===================================
# 2. ประเภทกล่อง (Box Types)
# ===================================
BOX_TYPES = {
    "rsc": {
        "name": "กล่องมาตรฐาน RSC",
        "suitable_for": ["general"],
        "production_factor": 1.1,  # เผื่อผลิตจริง
        "description": "ประหยัด แข็งแรง เหมาะกับการขนส่ง"
    },
    "die_cut": {
        "name": "กล่องไดคัท (Die-cut)",
        "suitable_for": ["non_food", "food_grade", "cosmetic"],
        "production_factor": 1.5,
        "description": "เน้นโชว์แบรนด์ ไม่ต้องใช้เทปปิด"
    }
}

# ===================================
# 3. วัสดุกล่อง - ประเภท RSC
# ===================================
RSC_MATERIALS = {
    "corrugated_2layer": {
        "name": "กระดาษลูกฟูก 2 ชั้น",
        "thickness_cm": 0.25,  # 2.5mm
        "density": 0.6,  # กรัม/ลูกบาศเซนติเมตร
        "paper_cost_per_kg": 22,  # บาท
        "labor_cost": 1.2,  # บาท/ใบ (เทป+แรง)
        "base_size": "10*10*10"
    },
    "kraft_200gsm": {
        "name": "กระดาษคราฟท์หนา 200 GSM",
        "gsm": 200,
        "density": 0.8,
        "paper_cost_per_kg": 30,
        "labor_cost": 1.2,
        "base_size": "10*10*10"
    }
}

# ===================================
# 4. วัสดุกล่อง - ประเภท Die-cut
# ===================================
DIE_CUT_MATERIALS = {
    "corrugated_2layer": {
        "name": "กระดาษลูกฟูก 2 ชั้น",
        "thickness_cm": 0.25,
        "density": 0.6,
        "paper_cost_per_kg": 22,
        "labor_cost": 0.6,  # บาท/ใบ (ไม่มีเทป)
        "base_size": "10*10*10"
    },
    "cardboard": {
        "name": "กระดาษแข็ง กระดาษจั๊วปัง",
        "thickness_cm": 0.25,
        "density": 0.9,
        "paper_cost_per_kg": 40,
        "labor_cost": 0.6,
        "base_size": "10*10*10"
    },
    "art_300gsm": {
        "name": "กระดาษอาร์ต 300 GSM",
        "gsm": 300,
        "density": 0.9,
        "paper_cost_per_kg": 200,
        "labor_cost": 0.6,
        "base_size": "10*10*10"
    },
    "ivory_350gsm": {
        "name": "กระดาษกล่องขาว/กล่องแป้ง 350 GSM",
        "gsm": 350,
        "density": 0.85,
        "paper_cost_per_kg": 40,
        "labor_cost": 0.6,
        "base_size": "10*10*10"
    }
}

# ===================================
# 5. Inner (วัสดุกันกระแทก) - Optional
# ===================================
INNER_MATERIALS = {
    "shredded_paper": {
        "name": "กระดาษฝอย (Shredded Paper)",
        "price_per_kg": (120, 170),  # (min, max) บาท
        "category": "cushion"
    },
    "air_bubble": {
        "name": "บับเบิ้ล (Air Bubble Roll)",
        "price_per_kg": (60, 90),
        "category": "cushion"
    },
    "air_cushion": {
        "name": "ถุงลม (Air Cushion)",
        "price_per_kg": (120, 200),
        "category": "cushion"
    }
}

# ===================================
# 6. Moisture Barrier Coating (เคลือบกันชื้น)
# ===================================
MOISTURE_COATINGS = {
    "aq_coating": {
        "name": "AQ Coating (Acrylic polymer)",
        "price_range_10x10x10": (0.48, 1.2),  # บาท/กล่อง
        "suitable_for": ["non_food"]
    },
    "pe_coating": {
        "name": "PE Coating (Polyethylene)",
        "price_range_10x10x10": (1.2, 3.6),
        "suitable_for": ["non_food"]
    },
    "wax_coating": {
        "name": "Wax Coating (Paraffin wax)",
        "price_range_10x10x10": (1.2, 3.0),
        "suitable_for": ["non_food"]
    },
    "bio_barrier": {
        "name": "Bio/Water-based Barrier",
        "price_range_10x10x10": (2.0, 5.0),
        "materials": ["PLA", "PVOH", "Bio-resin"],
        "suitable_for": ["non_food", "food_grade"]
    }
}

# ===================================
# 7. Food-grade Coating
# ===================================
FOOD_GRADE_COATINGS = {
    "water_based": {
        "name": "Water-based Food Coating",
        "price_range_10x10x10": (0.8, 1.5),
        "materials": ["Acrylic / PVOH (food safe)"]
    },
    "pe_food": {
        "name": "PE Food-grade Coating",
        "price_range_10x10x10": (1.2, 2.0),
        "materials": ["LDPE (food-grade resin)"]
    },
    "pla_bio": {
        "name": "PLA/Bio Coating",
        "price_range_10x10x10": (2.0, 3.5),
        "materials": ["PLA (Polylactic Acid)", "Bio-resin"]
    },
    "grease_resistant": {
        "name": "Grease-resistant Coating",
        "price_range_10x10x10": (1.5, 3.0),
        "materials": ["Fluorine-free grease barrier", "Modified starch"]
    }
}

# ===================================
# 8. การเคลือบเงา (Gloss Coating)
# ===================================
GLOSS_COATINGS = {
    "aq_gloss": {
        "name": "Gloss AQ Coating",
        "price_range_10x10x10": (0.6, 1.2),
        "materials": ["Acrylic polymer (water-based)"],
        "description": "เน้นต้นทุนต่ำ / งานจำนวนมาก มีกลิ่นการเคลือบน้อย"
    },
    "uv_gloss": {
        "name": "UV Gloss Coating",
        "price_range_10x10x10": (1.2, 2.4),
        "materials": ["UV-curable resin"],
        "description": "เงามาก ชัดลึก ทนรอยขีดข่วนกว่า AQ"
    },
    "opp_gloss": {
        "name": "OPP Gloss Film",
        "price_range_10x10x10": (1.8, 3.6),
        "materials": ["OPP film + กาว"],
        "description": "ต้องการความทนสูง กันน้ำกันรอยจริงจัง งาน premium มาก"
    }
}

# ===================================
# 9. การเคลือบด้าน (Matte Coating)
# ===================================
MATTE_COATINGS = {
    "uv_matte": {
        "name": "เคลือบ UV ด้าน",
        "price_range_10x10x10": (4.0, 8.0),
        "description": "ราคาประหยัดสุด ผิวเรียบด้าน ป้องกันรอยขีดข่วนได้เล็กน้อย"
    },
    "pvc_matte": {
        "name": "เคลือบลามิเนตด้าน (PVC Matte)",
        "price_range_10x10x10": (6.0, 12.0),
        "description": "ได้รับความนิยมสูงสุด ทนทานต่อความชื้นและรอยขีดข่วนได้ดี ให้ความรู้สึกพรีเมียม"
    },
    "varnish_matte": {
        "name": "เคลือบวานิชด้าน (Varnish)",
        "price_range_10x10x10": (8.0, 15.0),
        "description": "ใช้เครื่องจักรเฉพาะ ให้ความเรียบเนียนเป็นพิเศษ"
    }
}

# ===================================
# 10. ป๊ัมนูน & ป๊ัมจม (Emboss/Deboss)
# ===================================
EMBOSS_PRICING = {
    "block_cost": (800, 1500),  # บาท/บล็อก (ขึ้นกับขนาดโลโก้ + ความละเอียด)
    "stamp_cost_per_box": 2.0   # บาท/กล่อง
}

# ===================================
# 11. ป๊ัมฟอยล์ (Foil Stamping)
# ===================================
FOIL_STAMPING = {
    "regular": {
        "name": "ฟอยล์ธรรมดา (โลโก้ทั่วไป)",
        "block_cost": (1000, 2000),  # บาท/บล็อก
        "stamp_cost_per_box": (2, 5)  # บาท/กล่อง
    },
    "detailed": {
        "name": "ฟอยล์ละเอียด / ลายใหญ่",
        "block_cost": (2000, 3500),
        "stamp_cost_per_box": (5, 10)
    },
    "foil_emboss": {
        "name": "ฟอยล์+ นูน (Foil + Emboss)",
        "block_cost": (2500, 5000),
        "stamp_cost_per_box": (6, 12)
    }
}

# ===================================
# 12. ขนาดมาตรฐาน (Standard Base)
# ===================================
STANDARD_BOX = {
    "dimensions": {
        "width": 10,   # cm
        "length": 10,  # cm
        "height": 10   # cm
    },
    "surface_area_cm2": 600,  # 2*((10*10)+(10*10)+(10*10))
    "min_quantity": 500       # ขั้นต่ำ
}

# ===================================
# 13. ตัวเลือก Mood & Tone
# ===================================
MOOD_TONES = [
    "สดใส", "เรียบหรู", "มินิมอล", "สนุก", 
    "พรีเมียม", "หดหู่", "อื่นๆ"
]

# ===================================
# 14. ตำแหน่งโลโก้
# ===================================
LOGO_POSITIONS = [
    "ด้านบน", "ด้านล่าง", "บนและล่าง",
    "ด้านกว้าง 1 ด้าน", "ด้านกว้าง 2 ด้าน",
    "ด้านยาว 1 ด้าน", "ด้านยาว 2 ด้าน",
    "ด้านกว้างและยาว", "ทุกด้าน"
]

# ===================================
# 15. Chatbot Steps
# ===================================
CHATBOT_STEPS = {
    1: "greeting",
    2: "collect_product_type",
    3: "collect_box_type",
    4: "collect_inner",
    5: "collect_dimensions",
    6: "checkpoint_1",
    7: "collect_mood_tone",
    8: "collect_logo",
    9: "collect_special_effects",
    10: "checkpoint_2",
    11: "generate_mockup",
    12: "generate_quote",
    13: "confirm_order",
    14: "end"
}