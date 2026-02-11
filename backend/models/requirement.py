"""
Requirement Data Models
เก็บข้อมูล requirement ที่ได้จากการสนทนากับลูกค้า (14 ขั้นตอน)
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime


# ===================================
# 1. Box Structure Requirements (ขั้นตอนที่ 2-6)
# ===================================
class BoxStructure(BaseModel):
    """ข้อมูลโครงสร้างกล่อง (Structure Requirements)"""
    
    # ขั้นที่ 2: ประเภทสินค้า
    product_type: Literal["general", "non_food", "food_grade", "cosmetic"]
    
    # ขั้นที่ 3: ประเภทกล่อง
    box_type: Literal["rsc", "die_cut"]
    
    # ขั้นที่ 4: Inner (Optional)
    inner: Optional[str] = None  # "shredded_paper", "air_bubble", "air_cushion", etc.
    
    # ขั้นที่ 5: ขนาดกล่อง (Needed)
    dimensions: dict = Field(
        ...,
        description="ขนาดกล่อง เช่น {'width': 20, 'length': 15, 'height': 10}"
    )
    
    # ขั้นที่ 5: จำนวนผลิต (Needed)
    quantity: int = Field(
        ge=500,  # ขั้นต่ำ 500
        description="จำนวนกล่อง (ขั้นต่ำ 500 ชิ้น)"
    )
    
    # วัสดุกล่อง (ระบบเลือกให้อัตโนมัติตาม box_type และ product_type)
    material: Optional[str] = None
    
    
    @field_validator('dimensions')
    @classmethod
    def validate_dimensions(cls, v):
        """ตรวจสอบว่า dimensions มีครบ width, length, height"""
        required_keys = ['width', 'length', 'height']
        if not all(key in v for key in required_keys):
            raise ValueError(f"dimensions ต้องมี {required_keys}")
        
        # ตรวจสอบว่าเป็นตัวเลขบวก
        for key in required_keys:
            if v[key] <= 0:
                raise ValueError(f"{key} ต้องมากกว่า 0")
        
        return v
    
    model_config = ConfigDict(json_schema_extra={
            "example": {
                "product_type": "general",
                "box_type": "rsc",
                "inner": "shredded_paper",
                "dimensions": {"width": 20, "length": 15, "height": 10},
                "quantity": 1000,
                "material": "corrugated_2layer"
            }
        })


# ===================================
# 2. Design Requirements (ขั้นตอนที่ 7-10)
# ===================================
class DesignRequirement(BaseModel):
    """ข้อมูลการออกแบบและตกแต่ง (Design Requirements)"""
    
    # ขั้นที่ 7: Mood & Tone (Optional)
    mood_tone: Optional[str] = None
    
    # ขั้นที่ 8: Logo & Font (Optional)
    has_logo: bool = False
    logo_positions: Optional[List[str]] = None  # ["ด้านบน", "ด้านกว้าง 1 ด้าน", ...]
    logo_file: Optional[str] = None  # path หรือ URL ของไฟล์โลโก้
    
    # ขั้นที่ 9: ลูกเล่นพิเศษ (Optional)
    special_effects: Optional[List[dict]] = None  # [{"type": "uv_gloss", "category": "gloss"}]
    
    model_config = ConfigDict(json_schema_extra={
            "example": {
                "mood_tone": "มินิมอล สุขุม",
                "has_logo": True,
                "logo_positions": ["ด้านบน", "ด้านกว้าง 1 ด้าน"],
                "special_effects": [
                    {"type": "uv_gloss", "category": "gloss"},
                    {"type": "emboss", "category": "stamping", "has_block": False}
                ]
            }
        })


# ===================================
# 3. Complete Requirement (รวมทั้งหมด)
# ===================================
class CompleteRequirement(BaseModel):
    """ข้อมูล requirement ทั้งหมด"""
    
    # Session Info
    session_id: str = Field(..., description="Session ID สำหรับติดตาม conversation")
    user_id: Optional[str] = None
    
    # Requirements
    structure: BoxStructure
    design: Optional[DesignRequirement] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # Status
    is_structure_confirmed: bool = False  # ยืนยัน checkpoint 1 แล้วหรือยัง (ขั้นที่ 6)
    is_design_confirmed: bool = False     # ยืนยัน checkpoint 2 แล้วหรือยัง (ขั้นที่ 10)
    is_complete: bool = False             # ยืนยันคำสั่งซื้อแล้วหรือยัง (ขั้นที่ 13)
    
    @classmethod
    def from_collected_data(cls, session_id: str, collected_data: dict) -> "CompleteRequirement":
        """
        แปลง collected_data dict จาก ConversationState → CompleteRequirement
        
        ทำหน้าที่เป็น bridge ระหว่าง chatbot flow (dict) กับ data model (Pydantic)
        จัดการ format mismatch:
        - inner: dict {"type": "...", "category": "..."} → str "..."
        - special_effects: เก็บตรงๆ ใน DesignRequirement
        
        Args:
            session_id: Session ID
            collected_data: dict จาก ConversationState.collected_data
            
        Returns:
            CompleteRequirement instance
        """
        # --- Build BoxStructure ---
        # จัดการ inner: dict → str
        inner_raw = collected_data.get("inner")
        inner_str = None
        if isinstance(inner_raw, dict):
            inner_str = inner_raw.get("type")
        elif isinstance(inner_raw, str):
            inner_str = inner_raw
        
        structure = BoxStructure(
            product_type=collected_data.get("product_type", "general"),
            box_type=collected_data.get("box_type", "rsc"),
            inner=inner_str,
            dimensions=collected_data.get("dimensions", {"width": 10, "length": 10, "height": 10}),
            quantity=collected_data.get("quantity", 500),
            material=collected_data.get("material"),
        )
        
        # --- Build DesignRequirement (ถ้ามีข้อมูล) ---
        design = None
        has_design_data = any(
            collected_data.get(k) is not None
            for k in ["mood_tone", "has_logo", "logo_positions", "special_effects"]
        )
        
        if has_design_data:
            design = DesignRequirement(
                mood_tone=collected_data.get("mood_tone"),
                has_logo=collected_data.get("has_logo", False),
                logo_positions=collected_data.get("logo_positions"),
                special_effects=collected_data.get("special_effects"),
            )
        
        return cls(
            session_id=session_id,
            structure=structure,
            design=design,
            is_structure_confirmed=True,  # ถ้ามาถึงจุดนี้ = ยืนยันแล้ว
            is_design_confirmed=has_design_data,
        )
    
    def to_pricing_request(self) -> dict:
        """แปลงเป็น format ที่ pricing_calculator ใช้ได้"""
        result = {
            "dimensions": self.structure.dimensions,
            "box_type": self.structure.box_type,
            "material": self.structure.material or self._select_default_material(),
            "quantity": self.structure.quantity,
        }
        
        # เพิ่ม inner ถ้ามี
        if self.structure.inner:
            result["inner"] = self.structure.inner
        
        # เพิ่ม coatings & stampings ถ้ามี
        if self.design and self.design.special_effects:
            coatings = []
            stampings = []
            
            for effect in self.design.special_effects:
                category = effect.get("category")
                if category in ["gloss", "matte", "moisture", "food_grade"]:
                    coatings.append({
                        "type": effect.get("type"),
                        "category": category
                    })
                elif category == "stamping" or effect.get("type") in ["emboss", "foil_regular", "foil_detailed", "foil_emboss"]:
                    stampings.append({
                        "type": effect.get("type"),
                        "has_block": effect.get("has_block", False)
                    })
            
            if coatings:
                result["coatings"] = coatings
            if stampings:
                result["stampings"] = stampings
        
        return result
    
    def _select_default_material(self) -> str:
        """เลือกวัสดุเริ่มต้นตาม box_type"""
        if self.structure.box_type == "rsc":
            return "corrugated_2layer"
        else:  # die_cut
            # เลือกตาม product_type
            if self.structure.product_type in ["food_grade", "cosmetic"]:
                return "art_300gsm"
            else:
                return "corrugated_2layer"
    
    model_config = ConfigDict(json_schema_extra={
            "example": {
                "session_id": "sess_12345",
                "structure": {
                    "product_type": "general",
                    "box_type": "rsc",
                    "inner": "shredded_paper",
                    "dimensions": {"width": 20, "length": 15, "height": 10},
                    "quantity": 1000
                },
                "design": {
                    "mood_tone": "มินิมอล",
                    "has_logo": True,
                    "logo_positions": ["ด้านบน"],
                    "special_effects": [{"type": "uv_gloss", "category": "gloss"}]
                },
                "is_structure_confirmed": True,
                "is_design_confirmed": False,
                "is_complete": False
            }
        })


# ===================================
# 4. Checkpoint Summary Models
# ===================================
class CheckpointSummary(BaseModel):
    """สรุป requirement สำหรับแสดงให้ลูกค้าตรวจสอบ (ขั้นที่ 6 และ 10)"""
    
    checkpoint_number: Literal[1, 2]  # 1 = structure, 2 = design
    
    # Structure Summary (Checkpoint 1)
    product_type: Optional[str] = None
    box_type: Optional[str] = None
    inner: Optional[str] = None
    dimensions: Optional[dict] = None
    quantity: Optional[int] = None
    
    # Design Summary (Checkpoint 2)
    mood_tone: Optional[str] = None
    has_logo: Optional[bool] = None
    logo_positions: Optional[List[str]] = None
    special_effects: Optional[List[str]] = None  # แค่ชื่อ effect
    
    def format_for_display(self) -> str:
        """แปลงเป็นข้อความแสดงผล"""
        lines = []
        
        if self.checkpoint_number == 1:
            lines.append("📋 สรุป Requirement รอบที่ 1 (โครงสร้างกล่อง)")
            lines.append("="*50)
            lines.append(f"• ประเภทสินค้า: {self.product_type or 'ไม่ระบุ'}")
            lines.append(f"• ประเภทกล่อง: {self.box_type or 'ไม่ระบุ'}")
            lines.append(f"• Inner: {self.inner or 'ไม่ได้กำหนด'}")
            lines.append(f"• ขนาดกล่อง: {self.dimensions['width']}×{self.dimensions['length']}×{self.dimensions['height']} cm")
            lines.append(f"• จำนวนผลิต: {self.quantity:,} ชิ้น")
        else:
            lines.append("📋 สรุป Requirement รอบที่ 2 (การออกแบบและตกแต่ง)")
            lines.append("="*50)
            lines.append(f"• ขนาดกล่อง: {self.dimensions['width']}×{self.dimensions['length']}×{self.dimensions['height']} cm")
            lines.append(f"• Mood & Tone: {self.mood_tone or 'ไม่ได้กำหนด'}")
            lines.append(f"• โลโก้: {'มี' if self.has_logo else 'ไม่มี'}")
            if self.has_logo and self.logo_positions:
                lines.append(f"  ตำแหน่ง: {', '.join(self.logo_positions)}")
            effects_str = ', '.join(self.special_effects) if self.special_effects else 'ไม่ได้กำหนด'
            lines.append(f"• ลูกเล่นพิเศษ: {effects_str}")
        
        return "\n".join(lines)


# ===================================
# 5. User Confirmation Model
# ===================================
class UserConfirmation(BaseModel):
    """การยืนยันจากลูกค้า"""
    
    confirmed: bool
    modifications: Optional[dict] = None  # การแก้ไขที่ต้องการ
    additional_notes: Optional[str] = None
    
    model_config = ConfigDict(json_schema_extra={
            "example": {
                "confirmed": True,
                "modifications": None,
                "additional_notes": "ไม่มีการแก้ไข"
            }
        })