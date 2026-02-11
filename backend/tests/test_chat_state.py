"""
Unit Tests for Requirement Models
ทดสอบ from_collected_data() และ to_pricing_request()

Test categories:
- from_collected_data: แปลง collected_data dict → CompleteRequirement
- to_pricing_request: แปลง CompleteRequirement → pricing request dict
- Edge cases: inner format mismatch, missing fields, default values
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.requirement import (
    BoxStructure, DesignRequirement, CompleteRequirement,
    CheckpointSummary,
)


# ================================================
# Test Data Fixtures
# ================================================
@pytest.fixture
def minimal_collected_data():
    """ข้อมูลขั้นต่ำที่ต้องมี (structure only, no design)"""
    return {
        "product_type": "general",
        "box_type": "rsc",
        "dimensions": {"width": 20, "length": 15, "height": 10},
        "quantity": 1000,
    }


@pytest.fixture
def full_collected_data():
    """ข้อมูลครบทุก field"""
    return {
        "product_type": "cosmetic",
        "box_type": "die_cut",
        "material": "art_300gsm",
        "inner": {"type": "shredded_paper", "category": "cushion"},
        "dimensions": {"width": 25, "length": 30, "height": 15},
        "quantity": 2000,
        "mood_tone": "มินิมอล พรีเมี่ยม",
        "has_logo": True,
        "logo_positions": ["top", "width_one"],
        "special_effects": [
            {"type": "uv_gloss", "category": "gloss"},
            {"type": "emboss", "category": "stamping", "has_block": False},
        ],
    }


@pytest.fixture
def collected_data_inner_string():
    """inner เป็น string (format เก่า)"""
    return {
        "product_type": "food_grade",
        "box_type": "die_cut",
        "inner": "pe_food_grade",
        "dimensions": {"width": 10, "length": 10, "height": 10},
        "quantity": 500,
    }


# ================================================
# 1. from_collected_data() — Basic
# ================================================
class TestFromCollectedDataBasic:
    """ทดสอบแปลง dict → CompleteRequirement"""

    def test_minimal_data(self, minimal_collected_data):
        req = CompleteRequirement.from_collected_data("sess_001", minimal_collected_data)
        assert req.session_id == "sess_001"
        assert req.structure.product_type == "general"
        assert req.structure.box_type == "rsc"
        assert req.structure.dimensions == {"width": 20, "length": 15, "height": 10}
        assert req.structure.quantity == 1000
        assert req.is_structure_confirmed is True

    def test_no_design_data(self, minimal_collected_data):
        """ถ้าไม่มี design fields → design = None"""
        req = CompleteRequirement.from_collected_data("sess_001", minimal_collected_data)
        assert req.design is None
        assert req.is_design_confirmed is False

    def test_full_data(self, full_collected_data):
        req = CompleteRequirement.from_collected_data("sess_002", full_collected_data)
        assert req.structure.product_type == "cosmetic"
        assert req.structure.material == "art_300gsm"
        assert req.design is not None
        assert req.design.mood_tone == "มินิมอล พรีเมี่ยม"
        assert req.design.has_logo is True
        assert len(req.design.logo_positions) == 2
        assert len(req.design.special_effects) == 2
        assert req.is_design_confirmed is True


# ================================================
# 2. from_collected_data() — Inner Format Mismatch
# ================================================
class TestFromCollectedDataInnerFormat:
    """ทดสอบ inner format: dict → str conversion"""

    def test_inner_dict_to_str(self, full_collected_data):
        """inner: {"type": "shredded_paper", "category": "cushion"} → "shredded_paper" """
        req = CompleteRequirement.from_collected_data("sess_003", full_collected_data)
        assert req.structure.inner == "shredded_paper"

    def test_inner_string_passthrough(self, collected_data_inner_string):
        """inner: "pe_food_grade" → "pe_food_grade" (string → string ไม่เปลี่ยน)"""
        req = CompleteRequirement.from_collected_data("sess_004", collected_data_inner_string)
        assert req.structure.inner == "pe_food_grade"

    def test_inner_none(self, minimal_collected_data):
        """inner: None → None"""
        req = CompleteRequirement.from_collected_data("sess_005", minimal_collected_data)
        assert req.structure.inner is None


# ================================================
# 3. from_collected_data() — Default Values
# ================================================
class TestFromCollectedDataDefaults:
    """ทดสอบ default values สำหรับ missing fields"""

    def test_missing_product_type_defaults_general(self):
        data = {
            "box_type": "rsc",
            "dimensions": {"width": 10, "length": 10, "height": 10},
            "quantity": 500,
        }
        req = CompleteRequirement.from_collected_data("sess_006", data)
        assert req.structure.product_type == "general"

    def test_missing_material_is_none(self, minimal_collected_data):
        """material ไม่มี → None (จะถูก resolve ตอน to_pricing_request)"""
        req = CompleteRequirement.from_collected_data("sess_007", minimal_collected_data)
        assert req.structure.material is None

    def test_missing_dimensions_uses_default(self):
        data = {
            "product_type": "general",
            "box_type": "rsc",
            "quantity": 500,
        }
        req = CompleteRequirement.from_collected_data("sess_008", data)
        assert req.structure.dimensions == {"width": 10, "length": 10, "height": 10}


# ================================================
# 4. from_collected_data() — Design Detection
# ================================================
class TestFromCollectedDataDesignDetection:
    """ทดสอบว่า design object ถูกสร้างเมื่อมี design data"""

    def test_only_mood_tone(self, minimal_collected_data):
        minimal_collected_data["mood_tone"] = "สดใส"
        req = CompleteRequirement.from_collected_data("sess_009", minimal_collected_data)
        assert req.design is not None
        assert req.design.mood_tone == "สดใส"
        assert req.is_design_confirmed is True

    def test_only_has_logo(self, minimal_collected_data):
        minimal_collected_data["has_logo"] = True
        req = CompleteRequirement.from_collected_data("sess_010", minimal_collected_data)
        assert req.design is not None
        assert req.design.has_logo is True

    def test_only_effects(self, minimal_collected_data):
        minimal_collected_data["special_effects"] = [
            {"type": "pvc_matte", "category": "matte"}
        ]
        req = CompleteRequirement.from_collected_data("sess_011", minimal_collected_data)
        assert req.design is not None
        assert len(req.design.special_effects) == 1


# ================================================
# 5. to_pricing_request() — Basic
# ================================================
class TestToPricingRequest:
    """ทดสอบแปลง CompleteRequirement → pricing request dict"""

    def test_basic_structure(self, minimal_collected_data):
        req = CompleteRequirement.from_collected_data("sess_012", minimal_collected_data)
        pricing = req.to_pricing_request()
        assert pricing["dimensions"] == {"width": 20, "length": 15, "height": 10}
        assert pricing["box_type"] == "rsc"
        assert pricing["quantity"] == 1000
        assert "inner" not in pricing

    def test_default_material_rsc(self, minimal_collected_data):
        """RSC ไม่ระบุ material → corrugated_2layer"""
        req = CompleteRequirement.from_collected_data("sess_013", minimal_collected_data)
        pricing = req.to_pricing_request()
        assert pricing["material"] == "corrugated_2layer"

    def test_default_material_die_cut_cosmetic(self):
        data = {
            "product_type": "cosmetic",
            "box_type": "die_cut",
            "dimensions": {"width": 10, "length": 10, "height": 10},
            "quantity": 500,
        }
        req = CompleteRequirement.from_collected_data("sess_014", data)
        pricing = req.to_pricing_request()
        assert pricing["material"] == "art_300gsm"

    def test_default_material_die_cut_general(self):
        data = {
            "product_type": "general",
            "box_type": "die_cut",
            "dimensions": {"width": 10, "length": 10, "height": 10},
            "quantity": 500,
        }
        req = CompleteRequirement.from_collected_data("sess_015", data)
        pricing = req.to_pricing_request()
        assert pricing["material"] == "corrugated_2layer"

    def test_explicit_material_used(self, full_collected_data):
        """ถ้าระบุ material → ใช้ตามที่ระบุ"""
        req = CompleteRequirement.from_collected_data("sess_016", full_collected_data)
        pricing = req.to_pricing_request()
        assert pricing["material"] == "art_300gsm"


# ================================================
# 6. to_pricing_request() — Inner Handling
# ================================================
class TestToPricingRequestInner:

    def test_inner_from_dict(self, full_collected_data):
        """inner dict → inner string ใน pricing request"""
        req = CompleteRequirement.from_collected_data("sess_017", full_collected_data)
        pricing = req.to_pricing_request()
        assert pricing["inner"] == "shredded_paper"

    def test_inner_from_string(self, collected_data_inner_string):
        req = CompleteRequirement.from_collected_data("sess_018", collected_data_inner_string)
        pricing = req.to_pricing_request()
        assert pricing["inner"] == "pe_food_grade"

    def test_no_inner(self, minimal_collected_data):
        req = CompleteRequirement.from_collected_data("sess_019", minimal_collected_data)
        pricing = req.to_pricing_request()
        assert "inner" not in pricing


# ================================================
# 7. to_pricing_request() — Special Effects Separation
# ================================================
class TestToPricingRequestEffects:
    """ทดสอบการแยก effects → coatings + stampings"""

    def test_effects_separated(self, full_collected_data):
        """gloss → coatings, stamping → stampings"""
        req = CompleteRequirement.from_collected_data("sess_020", full_collected_data)
        pricing = req.to_pricing_request()
        assert "coatings" in pricing
        assert "stampings" in pricing
        assert len(pricing["coatings"]) == 1
        assert pricing["coatings"][0]["type"] == "uv_gloss"
        assert len(pricing["stampings"]) == 1
        assert pricing["stampings"][0]["type"] == "emboss"

    def test_only_coatings(self, minimal_collected_data):
        minimal_collected_data["special_effects"] = [
            {"type": "pvc_matte", "category": "matte"},
            {"type": "aq_gloss", "category": "gloss"},
        ]
        req = CompleteRequirement.from_collected_data("sess_021", minimal_collected_data)
        pricing = req.to_pricing_request()
        assert "coatings" in pricing
        assert "stampings" not in pricing
        assert len(pricing["coatings"]) == 2

    def test_only_stampings(self, minimal_collected_data):
        minimal_collected_data["special_effects"] = [
            {"type": "foil_regular", "category": "stamping", "has_block": True},
        ]
        req = CompleteRequirement.from_collected_data("sess_022", minimal_collected_data)
        pricing = req.to_pricing_request()
        assert "coatings" not in pricing
        assert "stampings" in pricing
        assert pricing["stampings"][0]["has_block"] is True

    def test_no_effects(self, minimal_collected_data):
        req = CompleteRequirement.from_collected_data("sess_023", minimal_collected_data)
        pricing = req.to_pricing_request()
        assert "coatings" not in pricing
        assert "stampings" not in pricing


# ================================================
# 8. BoxStructure Validation
# ================================================
class TestBoxStructureValidation:
    """ทดสอบ Pydantic validators"""

    def test_valid_dimensions(self):
        box = BoxStructure(
            product_type="general",
            box_type="rsc",
            dimensions={"width": 20, "length": 15, "height": 10},
            quantity=500,
        )
        assert box.dimensions["width"] == 20

    def test_missing_dimension_key_raises(self):
        with pytest.raises(ValueError, match="ต้องมี"):
            BoxStructure(
                product_type="general",
                box_type="rsc",
                dimensions={"width": 20, "length": 15},  # missing height
                quantity=500,
            )

    def test_zero_dimension_raises(self):
        with pytest.raises(ValueError, match="ต้องมากกว่า 0"):
            BoxStructure(
                product_type="general",
                box_type="rsc",
                dimensions={"width": 0, "length": 15, "height": 10},
                quantity=500,
            )

    def test_negative_dimension_raises(self):
        with pytest.raises(ValueError, match="ต้องมากกว่า 0"):
            BoxStructure(
                product_type="general",
                box_type="rsc",
                dimensions={"width": -5, "length": 15, "height": 10},
                quantity=500,
            )

    def test_quantity_below_500_raises(self):
        with pytest.raises(ValueError):
            BoxStructure(
                product_type="general",
                box_type="rsc",
                dimensions={"width": 10, "length": 10, "height": 10},
                quantity=100,
            )


# ================================================
# 9. CheckpointSummary
# ================================================
class TestCheckpointSummary:
    """ทดสอบ format_for_display()"""

    def test_checkpoint_1_display(self):
        summary = CheckpointSummary(
            checkpoint_number=1,
            product_type="สินค้าทั่วไป",
            box_type="RSC",
            inner="กระดาษฝอย",
            dimensions={"width": 20, "length": 15, "height": 10},
            quantity=1000,
        )
        text = summary.format_for_display()
        assert "รอบที่ 1" in text
        assert "สินค้าทั่วไป" in text
        assert "20×15×10" in text
        assert "1,000" in text

    def test_checkpoint_2_display(self):
        summary = CheckpointSummary(
            checkpoint_number=2,
            dimensions={"width": 20, "length": 15, "height": 10},
            mood_tone="มินิมอล",
            has_logo=True,
            logo_positions=["ด้านบน"],
            special_effects=["UV Gloss", "ป๊ัมนูน"],
        )
        text = summary.format_for_display()
        assert "รอบที่ 2" in text
        assert "มินิมอล" in text
        assert "ด้านบน" in text
        assert "UV Gloss" in text

    def test_checkpoint_no_inner_display(self):
        """inner = None → แสดง 'ไม่ได้กำหนด'"""
        summary = CheckpointSummary(
            checkpoint_number=1,
            product_type="ทั่วไป",
            box_type="RSC",
            inner=None,
            dimensions={"width": 10, "length": 10, "height": 10},
            quantity=500,
        )
        text = summary.format_for_display()
        assert "ไม่ได้กำหนด" in text


# ================================================
# Run
# ================================================
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])