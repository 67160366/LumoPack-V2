"""
Pricing Calculator
คำนวณราคากล่องตาม Requirement.pdf (หน้า 6-14)

Logic หลัก:
1. คำนวณพื้นที่ผิวกล่อง (Surface Area)
2. หา Factor เทียบกับกล่องมาตรฐาน 10x10x10
3. คำนวณราคาวัสดุ
4. บวกราคา Inner, Coating, ลูกเล่นพิเศษ
"""

from typing import Dict, Optional, List, Tuple
from utils.constants import (
    STANDARD_BOX, BOX_TYPES, RSC_MATERIALS, DIE_CUT_MATERIALS,
    INNER_MATERIALS, MOISTURE_COATINGS, FOOD_GRADE_COATINGS,
    GLOSS_COATINGS, MATTE_COATINGS, EMBOSS_PRICING, FOIL_STAMPING
)


class PricingCalculator:
    """คำนวณราคากล่อง"""
    
    def __init__(self):
        self.standard_area = STANDARD_BOX["surface_area_cm2"]
    
    # ===================================
    # 1. คำนวณพื้นที่ผิว
    # ===================================
    def calculate_surface_area(
        self, 
        width: float, 
        length: float, 
        height: float
    ) -> float:
        """
        คำนวณพื้นที่ผิวทั้ง 6 ด้าน
        Formula: 2 × ((กว้าง×ยาว) + (กว้าง×สูง) + (ยาว×สูง))
        
        Args:
            width: กว้าง (cm)
            length: ยาว (cm)  
            height: สูง (cm)
            
        Returns:
            พื้นที่ผิวในหน่วย ตร.ซม.
        """
        return 2 * ((width * length) + (width * height) + (length * height))
    
    # ===================================
    # 2. คำนวณ Factor เทียบกับกล่องมาตรฐาน
    # ===================================
    def calculate_price_ratio(
        self,
        width: float,
        length: float,
        height: float,
        box_type: str
    ) -> float:
        """
        คำนวณอัตราส่วนเทียบกับกล่อง 10x10x10
        
        Args:
            width, length, height: ขนาดกล่อง (cm)
            box_type: "rsc" หรือ "die_cut"
            
        Returns:
            Factor สำหรับคูณราคา
        """
        # ดึงค่า production factor (RSC=1.1, Die-cut=1.5)
        production_factor = BOX_TYPES[box_type]["production_factor"]
        
        # พื้นที่กล่องมาตรฐาน 10x10x10 + factor
        standard_with_factor = self.standard_area * production_factor
        
        # พื้นที่กล่องที่ลูกค้าสั่ง + factor
        custom_area = self.calculate_surface_area(width, length, height)
        custom_with_factor = custom_area * production_factor
        
        # หาอัตราส่วน
        ratio = custom_with_factor / standard_with_factor
        
        return ratio
    
    # ===================================
    # 3. คำนวณราคากล่องเปล่า (โครงสร้าง)
    # ===================================
    def calculate_box_base_price(
        self,
        width: float,
        length: float,
        height: float,
        box_type: str,
        material: str,
        quantity: int
    ) -> Dict:
        """
        คำนวณราคากล่องเปล่า (ไม่รวม Inner, Coating, ลูกเล่น)
        
        Args:
            width, length, height: ขนาด (cm)
            box_type: "rsc" หรือ "die_cut"
            material: ชื่อวัสดุ (เช่น "corrugated_2layer")
            quantity: จำนวนกล่อง
            
        Returns:
            {
                "price_per_box": ราคาต่อใบ,
                "total_price": ราคารวม,
                "material_info": ข้อมูลวัสดุ,
                "ratio": Factor ที่ใช้คำนวณ
            }
        """
        # เลือก material database
        materials_db = RSC_MATERIALS if box_type == "rsc" else DIE_CUT_MATERIALS
        
        if material not in materials_db:
            raise ValueError(f"ไม่มีวัสดุ '{material}' สำหรับกล่อง {box_type}")
        
        mat_data = materials_db[material]
        
        # คำนวณราคาวัสดุขนาด 10x10x10 (base price)
        base_price = self._calculate_material_cost(
            10, 10, 10, box_type, mat_data
        )
        
        # หา Factor
        ratio = self.calculate_price_ratio(width, length, height, box_type)
        
        # ราคาต่อกล่อง = base_price × ratio
        price_per_box = base_price * ratio
        
        # ถ้าสั่งมากอาจได้ส่วนลด (ตอนนี้ยังไม่ใส่)
        total_price = price_per_box * quantity
        
        return {
            "price_per_box": round(price_per_box, 2),
            "total_price": round(total_price, 2),
            "material_info": mat_data,
            "ratio": round(ratio, 2),
            "quantity": quantity
        }
    
    def _calculate_material_cost(
        self,
        width: float,
        length: float,
        height: float,
        box_type: str,
        material_data: Dict
    ) -> float:
        """
        คำนวณต้นทุนวัสดุ (ภายใน function)
        ตามสูตรในหน้า 6-7 ของ Requirement.pdf
        """
        # คำนวณพื้นที่ + production factor
        surface_area = self.calculate_surface_area(width, length, height)
        production_factor = BOX_TYPES[box_type]["production_factor"]
        area_with_factor = surface_area * production_factor
        
        # คำนวณน้ำหนักกระดาษ
        if "gsm" in material_data:
            # กระดาษ GSM (เช่น คราฟท์, อาร์ต)
            thickness = material_data["gsm"] / (material_data["density"] * 10000)
        else:
            # กระดาษลูกฟูก
            thickness = material_data["thickness_cm"]
        
        # น้ำหนัก = พื้นที่(cm²) × ความหนา(cm) × ความหนาแน่น(g/cm³)
        weight_grams = area_with_factor * thickness * material_data["density"]
        weight_kg = weight_grams / 1000
        
        # ต้นทุนกระดาษ
        paper_cost = weight_kg * material_data["paper_cost_per_kg"]
        
        # ต้นทุนแรงงาน
        labor_cost = material_data["labor_cost"]
        
        # ราคารวม
        total_cost = paper_cost + labor_cost
        
        return total_cost
    
    # ===================================
    # 4. คำนวณราคา Inner (วัสดุกันกระแทก)
    # ===================================
    def calculate_inner_price(
        self,
        inner_type: str,
        width: float,
        length: float,
        height: float,
        quantity: int
    ) -> Dict:
        """
        คำนวณราคา Inner (ยังทำแบบง่ายๆ ใช้ factor)
        
        Args:
            inner_type: ประเภท inner (เช่น "shredded_paper")
            width, length, height: ขนาดกล่อง
            quantity: จำนวน
            
        Returns:
            {"price_per_box": X, "total_price": Y}
        """
        if inner_type not in INNER_MATERIALS:
            return {"price_per_box": 0, "total_price": 0}
        
        inner_data = INNER_MATERIALS[inner_type]
        
        # ใช้ราคาเฉลี่ย (ไว้ใช้ในอนาคตถ้าต้องการคำนวณแบบละเอียด)
        avg_price_per_kg = sum(inner_data["price_per_kg"]) / 2
        
        # Inner pricing: ใช้ Base price + Factor ตามขนาด
        # ราคาฐาน (สำหรับกล่อง 10x10x10) ประมาณ 10 บาท
        # กระดาษฝอย/บับเบิ้ลใช้เป็น padding ไม่ได้ใช้มาก
        base_inner_cost = 10  # บาท
        
        # คำนวณ factor ตามพื้นที่ผิว
        surface_area = 2 * ((width * length) + (width * height) + (length * height))
        standard_area = 600  # กล่อง 10x10x10
        size_factor = surface_area / standard_area
        
        # ราคา = base + (base × factor × 0.5)
        # ตัวอย่าง: กล่อง 20x15x10 → factor ~2.17 → 10 + (10×2.17×0.5) ≈ 21 บาท/กล่อง
        price_per_box = base_inner_cost + (base_inner_cost * size_factor * 0.5)
        
        return {
            "price_per_box": round(price_per_box, 2),
            "total_price": round(price_per_box * quantity, 2),
            "name": inner_data["name"]
        }
    
    # ===================================
    # 5. คำนวณราคา Coating/ลูกเล่นพิเศษ
    # ===================================
    def calculate_coating_price(
        self,
        coating_type: str,
        coating_category: str,  # "moisture", "food_grade", "gloss", "matte"
        width: float,
        length: float,
        height: float,
        box_type: str,
        quantity: int
    ) -> Dict:
        """
        คำนวณราคา Coating โดยใช้ Factor
        
        Args:
            coating_type: ชื่อ coating (เช่น "uv_gloss")
            coating_category: หมวดหมู่ coating
            width, length, height: ขนาดกล่อง
            box_type: ประเภทกล่อง
            quantity: จำนวน
            
        Returns:
            {"price_per_box": X, "total_price": Y, "name": "..."}
        """
        # เลือก database ตาม category
        coatings_db = {
            "moisture": MOISTURE_COATINGS,
            "food_grade": FOOD_GRADE_COATINGS,
            "gloss": GLOSS_COATINGS,
            "matte": MATTE_COATINGS
        }
        
        if coating_category not in coatings_db:
            return {"price_per_box": 0, "total_price": 0, "name": ""}
        
        coating_db = coatings_db[coating_category]
        
        if coating_type not in coating_db:
            return {"price_per_box": 0, "total_price": 0, "name": ""}
        
        coating_data = coating_db[coating_type]
        
        # ราคาฐาน (กล่อง 10x10x10)
        base_price_range = coating_data["price_range_10x10x10"]
        avg_base_price = sum(base_price_range) / 2
        
        # หา Factor
        ratio = self.calculate_price_ratio(width, length, height, box_type)
        
        # ราคาจริง = base × ratio
        price_per_box = avg_base_price * ratio
        
        return {
            "price_per_box": round(price_per_box, 2),
            "total_price": round(price_per_box * quantity, 2),
            "name": coating_data["name"]
        }
    
    # ===================================
    # 6. คำนวณราคาป๊ัมนูน/ป๊ัมจม/ป๊ัมฟอยล์
    # ===================================
    def calculate_stamping_price(
        self,
        stamp_type: str,  # "emboss", "foil_regular", "foil_detailed", "foil_emboss"
        has_existing_block: bool,
        quantity: int
    ) -> Dict:
        """
        คำนวณราคาป๊ัม
        
        Args:
            stamp_type: ประเภทการป๊ัม
            has_existing_block: มีบล็อกป๊ัมอยู่แล้วหรือไม่
            quantity: จำนวนกล่อง
            
        Returns:
            {"block_cost": X, "stamp_cost_per_box": Y, "total": Z}
        """
        # ราคาบล็อก (ถ้ายังไม่มี)
        block_cost = 0
        stamp_cost_per_box = 0
        
        if stamp_type == "emboss":
            if not has_existing_block:
                block_cost = sum(EMBOSS_PRICING["block_cost"]) / 2
            stamp_cost_per_box = EMBOSS_PRICING["stamp_cost_per_box"]
            
        elif stamp_type.startswith("foil"):
            foil_key = stamp_type.replace("foil_", "")
            if foil_key not in FOIL_STAMPING:
                return {"block_cost": 0, "stamp_cost_per_box": 0, "total": 0}
            
            foil_data = FOIL_STAMPING[foil_key]
            
            if not has_existing_block:
                block_cost = sum(foil_data["block_cost"]) / 2
            
            stamp_cost_per_box = sum(foil_data["stamp_cost_per_box"]) / 2
        
        total_stamp_cost = stamp_cost_per_box * quantity
        total = block_cost + total_stamp_cost
        
        return {
            "block_cost": round(block_cost, 2),
            "stamp_cost_per_box": round(stamp_cost_per_box, 2),
            "total_stamp_cost": round(total_stamp_cost, 2),
            "total": round(total, 2)
        }
    
    # ===================================
    # 7. คำนวณราคารวมทั้งหมด
    # ===================================
    def calculate_total_price(
        self,
        # ข้อมูลพื้นฐาน
        width: float,
        length: float,
        height: float,
        box_type: str,
        material: str,
        quantity: int,
        
        # ตัวเลือกเพิ่มเติม (Optional)
        inner_type: Optional[str] = None,
        coatings: Optional[List[Dict]] = None,  # [{"type": "uv_gloss", "category": "gloss"}]
        stampings: Optional[List[Dict]] = None,  # [{"type": "emboss", "has_block": False}]
    ) -> Dict:
        """
        คำนวณราคารวมทั้งหมด
        
        Returns:
            {
                "box_base": {...},
                "inner": {...},
                "coatings": [{...}],
                "stampings": [{...}],
                "subtotal": X,
                "vat": Y,
                "grand_total": Z
            }
        """
        # 1. ราคากล่องเปล่า
        box_base = self.calculate_box_base_price(
            width, length, height, box_type, material, quantity
        )
        
        # 2. ราคา Inner
        inner = {"price_per_box": 0, "total_price": 0}
        if inner_type:
            inner = self.calculate_inner_price(
                inner_type, width, length, height, quantity
            )
        
        # 3. ราคา Coatings
        coating_list = []
        coating_total = 0
        if coatings:
            for coating in coatings:
                coating_price = self.calculate_coating_price(
                    coating["type"],
                    coating["category"],
                    width, length, height, box_type, quantity
                )
                coating_list.append(coating_price)
                coating_total += coating_price["total_price"]
        
        # 4. ราคา Stampings
        stamping_list = []
        stamping_total = 0
        if stampings:
            for stamping in stampings:
                stamping_price = self.calculate_stamping_price(
                    stamping["type"],
                    stamping.get("has_block", False),
                    quantity
                )
                stamping_list.append(stamping_price)
                stamping_total += stamping_price["total"]
        
        # รวมทั้งหมด
        subtotal = (
            box_base["total_price"] +
            inner["total_price"] +
            coating_total +
            stamping_total
        )
        
        vat = subtotal * 0.07  # VAT 7%
        grand_total = subtotal + vat
        
        return {
            "box_base": box_base,
            "inner": inner,
            "coatings": coating_list,
            "stampings": stamping_list,
            "subtotal": round(subtotal, 2),
            "vat": round(vat, 2),
            "grand_total": round(grand_total, 2),
            "dimensions": {"width": width, "length": length, "height": height},
            "quantity": quantity
        }


# ===================================
# Helper Function สำหรับ API
# ===================================
def get_price_estimate(requirement_data: Dict) -> Dict:
    """
    Function สำหรับเรียกใช้จาก API
    
    Args:
        requirement_data: {
            "dimensions": {"width": 20, "length": 15, "height": 10},
            "box_type": "rsc",
            "material": "corrugated_2layer",
            "quantity": 1000,
            "inner": "shredded_paper" (optional),
            "coatings": [...] (optional),
            "stampings": [...] (optional)
        }
    
    Returns:
        ข้อมูลราคาทั้งหมด
    """
    calculator = PricingCalculator()
    
    dims = requirement_data["dimensions"]
    
    return calculator.calculate_total_price(
        width=dims["width"],
        length=dims["length"],
        height=dims["height"],
        box_type=requirement_data["box_type"],
        material=requirement_data["material"],
        quantity=requirement_data["quantity"],
        inner_type=requirement_data.get("inner"),
        coatings=requirement_data.get("coatings"),
        stampings=requirement_data.get("stampings")
    )
