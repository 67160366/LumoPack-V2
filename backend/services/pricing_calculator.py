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
        คำนวณพื้นที่ผิวทั้ง 6 ด้าน (กล่องสี่เหลี่ยม)
        Formula: 2 × ((กว้าง×ยาว) + (กว้าง×สูง) + (ยาว×สูง))
        """
        return 2 * ((width * length) + (width * height) + (length * height))

    def calculate_heart_surface_area(
        self,
        length_cm: float,
        height_cm: float,
        shape_pct: float = 55,
        tilt_deg: float = 45,
    ) -> float:
        """
        คำนวณพื้นที่ผิวกล่องหัวใจ
        - ใช้สูตร ellipse parametric เหมือน frontend
        - Heart outline → คำนวณพื้นที่หน้าตัด + เส้นรอบรูป × สูง

        Args:
            length_cm: ความยาวหัวใจ (cm) — ใช้เป็น bounding size
            height_cm: ความสูงกล่อง (cm) — ผนังข้าง
            shape_pct: Shape % (20-90)
            tilt_deg: Tilt degrees (10-80)

        Returns:
            พื้นที่ผิวในหน่วย ตร.ซม.
        """
        import math
        tilt = math.radians(tilt_deg)
        b = shape_pct / 100
        t0 = math.atan2(math.cos(tilt), b * math.sin(tilt))

        # Generate right-half outline (same algo as frontend)
        right = []
        n = 60
        for i in range(n + 1):
            t = t0 + (i / n) * math.pi
            x = math.cos(t) * math.cos(tilt) - b * math.sin(t) * math.sin(tilt)
            y = math.cos(t) * math.sin(tilt) + b * math.sin(t) * math.cos(tilt)
            right.append((x, y))

        if right[n // 2][0] < 0:
            right = []
            for i in range(n + 1):
                t = t0 + math.pi + (i / n) * math.pi
                x = math.cos(t) * math.cos(tilt) - b * math.sin(t) * math.sin(tilt)
                y = math.cos(t) * math.sin(tilt) + b * math.sin(t) * math.cos(tilt)
                right.append((x, y))

        top_y = right[0][1]
        bot_y = right[-1][1]
        scale = 1.0 / abs(top_y - bot_y)

        # Full outline (right + mirrored left)
        left = [(-x, y) for x, y in reversed(right)]
        outline = [(x * scale, y * scale) for x, y in right] + \
                  [(x * scale, y * scale) for x, y in left[1:]]

        # Scale to actual cm size (length_cm = bounding width)
        # Find bounding width of normalised outline
        xs = [p[0] for p in outline]
        norm_w = max(xs) - min(xs)
        actual_scale = length_cm / norm_w if norm_w > 0 else length_cm

        pts = [(x * actual_scale, y * actual_scale) for x, y in outline]

        # Perimeter (sum of segment lengths)
        perimeter = 0.0
        for i in range(len(pts) - 1):
            dx = pts[i + 1][0] - pts[i][0]
            dy = pts[i + 1][1] - pts[i][1]
            perimeter += math.sqrt(dx * dx + dy * dy)
        # Close the loop
        dx = pts[0][0] - pts[-1][0]
        dy = pts[0][1] - pts[-1][1]
        perimeter += math.sqrt(dx * dx + dy * dy)

        # Area (Shoelace formula)
        area = 0.0
        for i in range(len(pts)):
            j = (i + 1) % len(pts)
            area += pts[i][0] * pts[j][1]
            area -= pts[j][0] * pts[i][1]
        area = abs(area) / 2.0

        # Surface = 2 × heart_area (top + bottom) + perimeter × height (walls)
        surface = 2 * area + perimeter * height_cm
        return surface
    
    # ===================================
    # 2. คำนวณ Factor เทียบกับกล่องมาตรฐาน
    # ===================================
    def calculate_price_ratio(
        self,
        width: float,
        length: float,
        height: float,
        box_type: str,
        shape_pct: float = 55,
        tilt_deg: float = 45,
    ) -> float:
        """
        คำนวณอัตราส่วนเทียบกับกล่อง 10x10x10

        Args:
            width, length, height: ขนาดกล่อง (cm)
            box_type: "rsc" / "die_cut" / "heart" / ...
            shape_pct, tilt_deg: Heart shape params (ใช้เฉพาะ heart)

        Returns:
            Factor สำหรับคูณราคา
        """
        production_factor = BOX_TYPES.get(box_type, {}).get("production_factor", 1.1)

        standard_with_factor = self.standard_area * production_factor

        if box_type == "heart":
            custom_area = self.calculate_heart_surface_area(
                length, height, shape_pct, tilt_deg
            )
        else:
            custom_area = self.calculate_surface_area(width, length, height)
        custom_with_factor = custom_area * production_factor

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
        quantity: int,
        shape_pct: float = 55,
        tilt_deg: float = 45,
    ) -> Dict:
        """
        คำนวณราคากล่องเปล่า (ไม่รวม Inner, Coating, ลูกเล่น)

        Args:
            width, length, height: ขนาด (cm)
            box_type: "rsc" / "die_cut" / "heart" / ...
            material: ชื่อวัสดุ
            quantity: จำนวนกล่อง
            shape_pct, tilt_deg: Heart shape params (ใช้เฉพาะ heart)
        """
        material_group = BOX_TYPES.get(box_type, {}).get("material_group", "die_cut")
        materials_db = RSC_MATERIALS if material_group == "rsc" else DIE_CUT_MATERIALS

        if material not in materials_db:
            raise ValueError(f"ไม่มีวัสดุ '{material}' สำหรับกล่อง {box_type}")

        mat_data = materials_db[material]

        # คำนวณราคาวัสดุขนาด 10x10x10 (base price)
        base_price = self._calculate_material_cost(
            10, 10, 10, box_type, mat_data
        )

        # หา Factor (heart uses shape/tilt for area calc)
        ratio = self.calculate_price_ratio(
            width, length, height, box_type, shape_pct, tilt_deg
        )

        price_per_box = base_price * ratio
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
        production_factor = BOX_TYPES.get(box_type, {}).get("production_factor", 1.1)
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
        coatings: Optional[List[Dict]] = None,
        stampings: Optional[List[Dict]] = None,

        # Heart-specific
        shape_pct: float = 55,
        tilt_deg: float = 45,
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
            width, length, height, box_type, material, quantity,
            shape_pct=shape_pct, tilt_deg=tilt_deg,
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
        stampings=requirement_data.get("stampings"),
        shape_pct=dims.get("shape_pct", 55),
        tilt_deg=dims.get("tilt_deg", 45),
    )
