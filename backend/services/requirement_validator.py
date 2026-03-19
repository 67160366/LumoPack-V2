"""
Requirement Validator
ตรวจสอบความถูกต้องและความครบถ้วนของข้อมูล requirement
"""

from typing import Dict, List, Optional, Tuple
import re


class RequirementValidator:
    """
    ตัวตรวจสอบความถูกต้องของ requirement
    
    ทำหน้าที่:
    1. ตรวจสอบความครบถ้วนของข้อมูล
    2. Validate dimensions (ขนาดกล่อง)
    3. Validate quantity (จำนวนการผลิต)
    4. Validate material compatibility
    """
    
    def __init__(self):
        """Initialize validator"""
        # กำหนดค่า min/max
        self.MIN_QUANTITY = 500
        self.MAX_QUANTITY = 1000000
        
        self.MIN_DIMENSION = 5  # cm
        self.MAX_DIMENSION = 200  # cm
        
        # Required fields for each checkpoint
        self.CHECKPOINT1_REQUIRED = [
            "product_type",
            "box_type",
            "dimensions",
            "quantity"
        ]
        
        self.CHECKPOINT2_OPTIONAL = [
            "mood_tone",
            "has_logo",
            "logo_positions",
            "special_effects"
        ]
    
    def validate_structure_requirements(
        self,
        collected_data: Dict
    ) -> Tuple[bool, List[str]]:
        """
        ตรวจสอบ requirement โครงสร้างกล่อง (Checkpoint 1)
        
        Args:
            collected_data: ข้อมูลที่เก็บมา
            
        Returns:
            (is_valid, error_messages)
        """
        errors = []
        
        # เช็คความครบถ้วน
        missing = self._check_required_fields(
            collected_data,
            self.CHECKPOINT1_REQUIRED
        )
        
        if missing:
            errors.append(f"ข้อมูลไม่ครบ: {', '.join(missing)}")
        
        # Validate product_type
        if not self._validate_product_type(collected_data.get("product_type")):
            errors.append("ประเภทสินค้าไม่ถูกต้อง")
        
        # Validate box_type
        if not self._validate_box_type(collected_data.get("box_type")):
            errors.append("ประเภทกล่องไม่ถูกต้อง")
        
        # Validate dimensions
        dims_valid, dims_error = self._validate_dimensions(
            collected_data.get("dimensions")
        )
        if not dims_valid:
            errors.append(dims_error)
        
        # Validate quantity
        qty_valid, qty_error = self._validate_quantity(
            collected_data.get("quantity")
        )
        if not qty_valid:
            errors.append(qty_error)
        
        return len(errors) == 0, errors
    
    def validate_design_requirements(
        self,
        collected_data: Dict
    ) -> Tuple[bool, List[str]]:
        """
        ตรวจสอบ requirement การออกแบบ (Checkpoint 2)
        
        Args:
            collected_data: ข้อมูลที่เก็บมา
            
        Returns:
            (is_valid, error_messages)
        """
        errors = []
        warnings = []
        
        # Design requirements เป็น optional ทั้งหมด
        # แต่ถ้ามี ต้องถูกต้อง
        
        # Validate mood_tone (ถ้ามี)
        mood_tone = collected_data.get("mood_tone")
        if mood_tone and not self._validate_mood_tone(mood_tone):
            warnings.append("Mood & Tone อาจไม่เหมาะสม")
        
        # Validate logo (ถ้ามี)
        if collected_data.get("has_logo"):
            logo_positions = collected_data.get("logo_positions", [])
            if not logo_positions:
                errors.append("ระบุว่ามีโลโก้แต่ไม่ได้บอกตำแหน่ง")
        
        # Validate special_effects (ถ้ามี)
        effects = collected_data.get("special_effects")
        if effects:
            effects_valid, effects_error = self._validate_special_effects(effects)
            if not effects_valid:
                errors.append(effects_error)
        
        # Design requirements ผ่านได้ถึงมี warnings
        return len(errors) == 0, errors + warnings
    
    def validate_complete_requirement(
        self,
        collected_data: Dict
    ) -> Tuple[bool, Dict[str, List[str]]]:
        """
        ตรวจสอบ requirement ทั้งหมด (ก่อนคำนวณราคา)
        
        Args:
            collected_data: ข้อมูลทั้งหมด
            
        Returns:
            (is_valid, error_dict)
            error_dict = {
                "structure": [...],
                "design": [...],
                "general": [...]
            }
        """
        error_dict = {
            "structure": [],
            "design": [],
            "general": []
        }
        
        # Validate structure
        structure_valid, structure_errors = self.validate_structure_requirements(
            collected_data
        )
        if not structure_valid:
            error_dict["structure"] = structure_errors
        
        # Validate design
        design_valid, design_errors = self.validate_design_requirements(
            collected_data
        )
        if not design_valid:
            error_dict["design"] = design_errors
        
        # Validate compatibility (material + product_type)
        compat_valid, compat_error = self._validate_material_compatibility(
            collected_data
        )
        if not compat_valid:
            error_dict["general"].append(compat_error)
        
        # Check overall validity
        is_valid = all([
            structure_valid,
            design_valid,
            compat_valid
        ])
        
        return is_valid, error_dict
    
    # ===================================
    # Field-specific validators
    # ===================================
    
    def _check_required_fields(
        self,
        collected_data: Dict,
        required_fields: List[str]
    ) -> List[str]:
        """เช็คว่ามี required fields หรือไม่"""
        missing = []
        
        for field in required_fields:
            if field not in collected_data or collected_data[field] is None:
                missing.append(field)
        
        return missing
    
    def _validate_product_type(self, product_type: Optional[str]) -> bool:
        """ตรวจสอบ product_type"""
        valid_types = ["general", "non_food", "food_grade", "cosmetic"]
        return product_type in valid_types
    
    def _validate_box_type(self, box_type: Optional[str]) -> bool:
        """ตรวจสอบ box_type"""
        valid_types = ["rsc", "die_cut", "heart", "star", "bear", "circle", "bow"]
        return box_type in valid_types
    
    def _validate_dimensions(
        self,
        dimensions: Optional[Dict]
    ) -> Tuple[bool, str]:
        """
        ตรวจสอบขนาดกล่อง
        
        Returns:
            (is_valid, error_message)
        """
        if not dimensions:
            return False, "ไม่พบข้อมูลขนาดกล่อง"
        
        # ต้องมี width, length, height
        required_keys = ["width", "length", "height"]
        for key in required_keys:
            if key not in dimensions:
                return False, f"ขาดข้อมูล {key}"
        
        # ตรวจสอบแต่ละด้าน
        for key in required_keys:
            value = dimensions[key]
            
            # ต้องเป็นตัวเลข
            if not isinstance(value, (int, float)):
                return False, f"{key} ต้องเป็นตัวเลข"
            
            # ต้องอยู่ในช่วง min-max
            if value < self.MIN_DIMENSION:
                return False, f"{key} ต้องมากกว่า {self.MIN_DIMENSION} cm"
            
            if value > self.MAX_DIMENSION:
                return False, f"{key} ต้องไม่เกิน {self.MAX_DIMENSION} cm"
        
        # ตรวจสอบสัดส่วน (ไม่ควรแปลกจนเกินไป)
        ratio_valid, ratio_error = self._validate_dimension_ratios(dimensions)
        if not ratio_valid:
            return False, ratio_error
        
        return True, ""
    
    def _validate_dimension_ratios(
        self,
        dimensions: Dict
    ) -> Tuple[bool, str]:
        """
        ตรวจสอบสัดส่วนของขนาด
        (เพื่อป้องกันกล่องที่มีสัดส่วนแปลกๆ)
        """
        width = dimensions["width"]
        length = dimensions["length"]
        height = dimensions["height"]
        
        # หาด้านที่ใหญ่ที่สุดและเล็กที่สุด
        dims = [width, length, height]
        max_dim = max(dims)
        min_dim = min(dims)
        
        # สัดส่วนไม่ควรต่างกันเกิน 20 เท่า
        if max_dim / min_dim > 20:
            return False, "สัดส่วนกล่องดูแปลกเกินไป กรุณาตรวจสอบอีกครั้ง"
        
        return True, ""
    
    def _validate_quantity(
        self,
        quantity: Optional[int]
    ) -> Tuple[bool, str]:
        """
        ตรวจสอบจำนวนการผลิต
        
        Returns:
            (is_valid, error_message)
        """
        if not quantity:
            return False, "ไม่พบข้อมูลจำนวนการผลิต"
        
        # ต้องเป็นจำนวนเต็ม
        if not isinstance(quantity, int):
            return False, "จำนวนต้องเป็นจำนวนเต็ม"
        
        # ต้องมากกว่าขั้นต่ำ
        if quantity < self.MIN_QUANTITY:
            return False, f"จำนวนขั้นต่ำ {self.MIN_QUANTITY} ชิ้น"
        
        # ไม่เกินสูงสุด
        if quantity > self.MAX_QUANTITY:
            return False, f"จำนวนสูงสุด {self.MAX_QUANTITY:,} ชิ้น"
        
        return True, ""
    
    def _validate_mood_tone(self, mood_tone: str) -> bool:
        """ตรวจสอบ mood & tone"""
        # ต้องไม่ว่างเปล่า และมีความยาวพอสมควร
        return len(mood_tone.strip()) >= 2
    
    def _validate_special_effects(
        self,
        effects: List[Dict]
    ) -> Tuple[bool, str]:
        """ตรวจสอบลูกเล่นพิเศษ"""
        if not isinstance(effects, list):
            return False, "ลูกเล่นพิเศษต้องเป็น list"
        
        valid_coating_types = [
            "uv_gloss", "uv_matte", "aq_gloss",
            "pvc_matte", "varnish_matte", "opp_gloss"
        ]
        
        valid_stamping_types = [
            "emboss", "deboss", "foil_regular",
            "foil_detailed", "foil_emboss"
        ]
        
        for effect in effects:
            effect_type = effect.get("type")
            
            # ต้องมี type
            if not effect_type:
                return False, "ลูกเล่นพิเศษต้องระบุ type"
            
            # ต้องเป็น type ที่ถูกต้อง
            if effect_type not in valid_coating_types + valid_stamping_types:
                return False, f"ไม่รู้จัก type: {effect_type}"
        
        return True, ""
    
    def _validate_material_compatibility(
        self,
        collected_data: Dict
    ) -> Tuple[bool, str]:
        """
        ตรวจสอบความเข้ากันได้ของวัสดุกับประเภทสินค้า
        """
        product_type = collected_data.get("product_type")
        box_type = collected_data.get("box_type")
        
        # Food-grade ควรใช้กล่องที่ไม่ใช่ RSC
        if product_type == "food_grade":
            if box_type == "rsc":
                # เตือน แต่ไม่ error
                return True, ""  # ผ่านได้แต่อาจเตือน
        
        return True, ""
    
    # ===================================
    # Utility functions
    # ===================================
    
    def get_missing_fields_message(
        self,
        collected_data: Dict,
        checkpoint: int = 1
    ) -> Optional[str]:
        """
        สร้างข้อความแจ้ง fields ที่ยังขาด
        
        Args:
            collected_data: ข้อมูลปัจจุบัน
            checkpoint: 1 หรือ 2
            
        Returns:
            ข้อความแจ้งเตือน หรือ None ถ้าครบ
        """
        if checkpoint == 1:
            required = self.CHECKPOINT1_REQUIRED
        else:
            # Checkpoint 2 ไม่มี required fields
            return None
        
        missing = self._check_required_fields(collected_data, required)
        
        if missing:
            field_names = {
                "product_type": "ประเภทสินค้า",
                "box_type": "ประเภทกล่อง",
                "dimensions": "ขนาดกล่อง",
                "quantity": "จำนวนผลิต"
            }
            
            missing_names = [field_names.get(f, f) for f in missing]
            return f"ยังขาดข้อมูล: {', '.join(missing_names)}"
        
        return None
    
    def suggest_improvements(
        self,
        collected_data: Dict
    ) -> List[str]:
        """
        แนะนำสิ่งที่ควรปรับปรุง (ไม่ใช่ error แต่เป็นคำแนะนำ)
        
        Returns:
            List of suggestions
        """
        suggestions = []
        
        # ถ้าจำนวนน้อย อาจแนะนำเพิ่ม
        quantity = collected_data.get("quantity", 0)
        if 500 <= quantity < 1000:
            suggestions.append(
                "💡 สั่งจำนวน 1000+ จะได้ราคาดีกว่า"
            )
        
        # ถ้าไม่มี inner แต่เป็นสินค้าที่ต้องการ
        if not collected_data.get("inner"):
            product_type = collected_data.get("product_type")
            if product_type in ["cosmetic", "food_grade"]:
                suggestions.append(
                    "💡 แนะนำเพิ่ม inner เพื่อป้องกันสินค้า"
                )
        
        # ถ้าไม่มีลูกเล่นพิเศษ
        if not collected_data.get("special_effects"):
            suggestions.append(
                "💡 เพิ่มลูกเล่นพิเศษจะทำให้กล่องดูโดดเด่นขึ้น"
            )
        
        return suggestions


# ===================================
# Singleton instance
# ===================================
_validator_instance: Optional[RequirementValidator] = None


def get_validator() -> RequirementValidator:
    """
    Get validator instance (singleton)
    
    Returns:
        RequirementValidator instance
    """
    global _validator_instance
    
    if _validator_instance is None:
        _validator_instance = RequirementValidator()
    
    return _validator_instance


# ===================================
# Example usage
# ===================================
if __name__ == "__main__":
    """ทดสอบ validator"""
    
    validator = get_validator()
    
    # Test case 1: Valid structure requirements
    print("="*60)
    print("Test 1: Valid structure requirements")
    print("="*60)
    
    data1 = {
        "product_type": "general",
        "box_type": "rsc",
        "dimensions": {"width": 20, "length": 15, "height": 10},
        "quantity": 1000
    }
    
    valid, errors = validator.validate_structure_requirements(data1)
    print(f"Valid: {valid}")
    if not valid:
        print(f"Errors: {errors}")
    else:
        print("✅ All checks passed!")
    
    # Test case 2: Invalid dimensions
    print("\n" + "="*60)
    print("Test 2: Invalid dimensions (too small)")
    print("="*60)
    
    data2 = {
        "product_type": "general",
        "box_type": "rsc",
        "dimensions": {"width": 2, "length": 15, "height": 10},
        "quantity": 1000
    }
    
    valid, errors = validator.validate_structure_requirements(data2)
    print(f"Valid: {valid}")
    if not valid:
        print(f"❌ Errors: {errors}")
    
    # Test case 3: Invalid quantity
    print("\n" + "="*60)
    print("Test 3: Invalid quantity (too low)")
    print("="*60)
    
    data3 = {
        "product_type": "general",
        "box_type": "rsc",
        "dimensions": {"width": 20, "length": 15, "height": 10},
        "quantity": 100
    }
    
    valid, errors = validator.validate_structure_requirements(data3)
    print(f"Valid: {valid}")
    if not valid:
        print(f"❌ Errors: {errors}")
    
    # Test case 4: Suggestions
    print("\n" + "="*60)
    print("Test 4: Get suggestions")
    print("="*60)
    
    suggestions = validator.suggest_improvements(data1)
    if suggestions:
        print("💡 Suggestions:")
        for s in suggestions:
            print(f"   {s}")
    else:
        print("ไม่มีคำแนะนำเพิ่มเติม")
    
    print("\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60)
