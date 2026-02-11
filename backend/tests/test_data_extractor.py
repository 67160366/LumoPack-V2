"""
Unit Tests for Data Extractor
ทดสอบ extraction functions ทั้ง 16 ตัว

Test categories:
- Happy path: ข้อมูลถูกต้องตาม format
- Edge cases: ข้อมูลไม่ครบ, format แปลก, ภาษาปน
- False positive prevention: ต้องไม่ match ผิดจุด
"""

import sys
import os
import pytest

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.data_extractor import (
    extract_product_type, extract_box_type, extract_material,
    extract_inner, extract_dimensions, extract_quantity,
    extract_has_logo, extract_logo_positions,
    extract_special_effects, extract_has_existing_block,
    is_confirmation, is_rejection, is_skip_response,
    is_add_request, detect_edit_target,
)


# ================================================
# 1. extract_product_type
# ================================================
class TestExtractProductType:
    """ทดสอบ Step 2: ประเภทสินค้า"""

    # --- Happy Path ---
    def test_general_thai(self):
        assert extract_product_type("สินค้าทั่วไป") == "general"

    def test_general_english(self):
        assert extract_product_type("general") == "general"

    def test_non_food(self):
        assert extract_product_type("Non-food") == "non_food"

    def test_food_grade_thai(self):
        assert extract_product_type("อาหาร") == "food_grade"

    def test_food_grade_english(self):
        assert extract_product_type("food grade") == "food_grade"

    def test_cosmetic_thai(self):
        assert extract_product_type("เครื่องสำอาง") == "cosmetic"

    def test_cosmetic_cream(self):
        assert extract_product_type("ครีมบำรุงผิว") == "cosmetic"

    # --- Number Selection ---
    def test_number_1(self):
        assert extract_product_type("1") == "general"

    def test_number_3(self):
        assert extract_product_type("3") == "food_grade"

    def test_number_4(self):
        assert extract_product_type("4") == "cosmetic"

    # --- False Positive Prevention ---
    def test_number_in_quantity_should_not_match(self):
        """ตัวเลข '1' ใน '1000 กล่อง' ต้องไม่ match"""
        assert extract_product_type("1000 กล่อง") is None

    def test_number_in_dimensions_should_not_match(self):
        assert extract_product_type("10x10x10") is None

    # --- Unknown ---
    def test_unknown_input(self):
        assert extract_product_type("ไม่รู้เลือกอะไรดี") is None

    def test_empty_string(self):
        assert extract_product_type("") is None


# ================================================
# 2. extract_box_type
# ================================================
class TestExtractBoxType:
    """ทดสอบ Step 3: ประเภทกล่อง"""

    def test_rsc_english(self):
        assert extract_box_type("RSC") == "rsc"

    def test_rsc_thai(self):
        assert extract_box_type("กล่องมาตรฐาน") == "rsc"

    def test_die_cut_hyphen(self):
        assert extract_box_type("die-cut") == "die_cut"

    def test_die_cut_space(self):
        assert extract_box_type("die cut") == "die_cut"

    def test_die_cut_thai(self):
        assert extract_box_type("ไดคัท") == "die_cut"

    def test_number_1(self):
        assert extract_box_type("1") == "rsc"

    def test_number_2(self):
        assert extract_box_type("2") == "die_cut"

    # --- False Positive: "cut" ไม่ควร match เดี่ยว ---
    def test_word_cut_alone_should_not_match(self):
        assert extract_box_type("ตัด") is None

    def test_unknown(self):
        assert extract_box_type("ไม่รู้") is None


# ================================================
# 3. extract_material
# ================================================
class TestExtractMaterial:
    """ทดสอบ Step 3 sub-step: วัสดุ"""

    def test_corrugated_thai(self):
        assert extract_material("ลูกฟูก", "rsc") == "corrugated_2layer"

    def test_kraft_thai(self):
        assert extract_material("คราฟท์", "rsc") == "kraft_200gsm"

    def test_art_paper(self):
        assert extract_material("กระดาษอาร์ต", "die_cut") == "art_300gsm"

    def test_cardboard_thai(self):
        assert extract_material("จั่วปัง", "die_cut") == "cardboard"

    def test_whiteboard_thai(self):
        assert extract_material("กล่องขาว", "die_cut") == "whiteboard_350gsm"

    # --- Number selection for RSC ---
    def test_number_1_rsc(self):
        assert extract_material("1", "rsc") == "corrugated_2layer"

    def test_number_2_rsc(self):
        assert extract_material("2", "rsc") == "kraft_200gsm"

    # --- Number selection for Die-cut ---
    def test_number_3_die_cut(self):
        assert extract_material("3", "die_cut") == "art_300gsm"

    def test_number_4_die_cut(self):
        assert extract_material("4", "die_cut") == "whiteboard_350gsm"

    # --- Invalid number for RSC (only 1-2) ---
    def test_number_3_rsc_should_be_none(self):
        assert extract_material("3", "rsc") is None

    def test_unknown(self):
        assert extract_material("ไม่รู้", "rsc") is None


# ================================================
# 4. extract_inner
# ================================================
class TestExtractInner:
    """ทดสอบ Step 4: Inner"""

    def test_shredded_paper(self):
        result = extract_inner("กระดาษฝอย")
        assert result["type"] == "shredded_paper"
        assert result["category"] == "cushion"

    def test_bubble(self):
        result = extract_inner("บับเบิ้ล")
        assert result["type"] == "air_bubble"

    def test_air_cushion(self):
        result = extract_inner("ถุงลม")
        assert result["type"] == "air_cushion"

    def test_skip_no(self):
        assert extract_inner("ไม่ต้องการ") == "skip"

    def test_skip_pass(self):
        assert extract_inner("ข้าม") == "skip"

    def test_wax_coating(self):
        result = extract_inner("wax coating")
        assert result["type"] == "wax_coating"
        assert result["category"] == "moisture"

    def test_unknown(self):
        assert extract_inner("อะไรดีนะ") is None


# ================================================
# 5. extract_dimensions
# ================================================
class TestExtractDimensions:
    """ทดสอบ Step 5: ขนาดกล่อง"""

    # --- Format: AxBxC ---
    def test_format_x(self):
        result = extract_dimensions("20x15x10")
        assert result == {"width": 20.0, "length": 15.0, "height": 10.0}

    def test_format_star(self):
        result = extract_dimensions("20*15*10")
        assert result == {"width": 20.0, "length": 15.0, "height": 10.0}

    def test_format_unicode_x(self):
        result = extract_dimensions("20×15×10")
        assert result == {"width": 20.0, "length": 15.0, "height": 10.0}

    def test_with_spaces(self):
        result = extract_dimensions("20 x 15 x 10")
        assert result == {"width": 20.0, "length": 15.0, "height": 10.0}

    # --- Format: กว้าง/ยาว/สูง ---
    def test_thai_format(self):
        result = extract_dimensions("กว้าง 20 ยาว 15 สูง 10")
        assert result == {"width": 20.0, "length": 15.0, "height": 10.0}

    def test_english_format(self):
        result = extract_dimensions("width 25 length 30 height 40")
        assert result == {"width": 25.0, "length": 30.0, "height": 40.0}

    # --- Decimal ---
    def test_decimal_dimensions(self):
        result = extract_dimensions("20.5x15.5x10.5")
        assert result == {"width": 20.5, "length": 15.5, "height": 10.5}

    # --- Edge cases ---
    def test_no_dimensions(self):
        assert extract_dimensions("ไม่รู้ขนาด") is None

    def test_only_two_numbers(self):
        assert extract_dimensions("20x15") is None

    def test_mixed_with_text(self):
        result = extract_dimensions("ขนาดประมาณ 20x15x10 ซม.")
        assert result == {"width": 20.0, "length": 15.0, "height": 10.0}


# ================================================
# 6. extract_quantity
# ================================================
class TestExtractQuantity:
    """ทดสอบ Step 5: จำนวนผลิต"""

    def test_with_unit_chin(self):
        assert extract_quantity("1000 ชิ้น") == 1000

    def test_with_unit_box(self):
        assert extract_quantity("500 กล่อง") == 500

    def test_with_keyword_jamnuan(self):
        assert extract_quantity("จำนวน 2000") == 2000

    def test_with_commas(self):
        assert extract_quantity("10,000 ชิ้น") == 10000

    # --- Minimum 500 ---
    def test_below_minimum_returns_none(self):
        assert extract_quantity("200 ชิ้น") is None

    def test_exactly_500(self):
        assert extract_quantity("500 ชิ้น") == 500

    # --- Edge: quantity กับ dimensions ---
    def test_standalone_large_number(self):
        """ตัวเลข >= 500 ที่ไม่ได้อยู่ใน pattern dimensions"""
        assert extract_quantity("1500") == 1500

    def test_no_quantity(self):
        assert extract_quantity("ยังไม่แน่ใจ") is None


# ================================================
# 7. extract_has_logo
# ================================================
class TestExtractHasLogo:
    """ทดสอบ Step 8: โลโก้"""

    def test_yes_thai(self):
        assert extract_has_logo("มี") is True

    def test_yes_english(self):
        assert extract_has_logo("yes") is True

    def test_no_thai(self):
        assert extract_has_logo("ไม่มี") is False

    def test_skip(self):
        assert extract_has_logo("ข้าม") is False

    def test_ambiguous(self):
        assert extract_has_logo("ยังไม่แน่ใจ") is None


# ================================================
# 8. extract_logo_positions
# ================================================
class TestExtractLogoPositions:
    """ทดสอบ Step 8 sub-step: ตำแหน่งโลโก้"""

    def test_top(self):
        result = extract_logo_positions("ด้านบน")
        assert "top" in result

    def test_all_sides(self):
        result = extract_logo_positions("ทุกด้าน")
        assert "all_sides" in result

    def test_top_and_bottom(self):
        result = extract_logo_positions("ด้านบนและล่าง")
        assert "top_bottom" in result

    def test_width_both(self):
        result = extract_logo_positions("ด้านกว้าง 2 ด้าน")
        assert "width_both" in result

    def test_width_and_length(self):
        result = extract_logo_positions("ด้านกว้างและยาว")
        assert "width_and_length" in result

    def test_no_position(self):
        assert extract_logo_positions("ไม่รู้จะวางตรงไหน") is None


# ================================================
# 9. extract_special_effects
# ================================================
class TestExtractSpecialEffects:
    """ทดสอบ Step 9: ลูกเล่นพิเศษ"""

    def test_uv_gloss(self):
        result = extract_special_effects("UV Gloss")
        assert len(result) == 1
        assert result[0]["type"] == "uv_gloss"
        assert result[0]["category"] == "gloss"

    def test_pvc_matte(self):
        result = extract_special_effects("ลามิเนตด้าน")
        assert result[0]["type"] == "pvc_matte"
        assert result[0]["category"] == "matte"

    def test_emboss(self):
        result = extract_special_effects("ป๊ัมนูน")
        assert result[0]["type"] == "emboss"
        assert result[0]["category"] == "stamping"

    def test_deboss(self):
        result = extract_special_effects("ป๊ัมจม")
        assert result[0]["type"] == "deboss"

    def test_foil_regular(self):
        result = extract_special_effects("ป๊ัมฟอยล์ทอง")
        assert result[0]["type"] == "foil_regular"

    def test_foil_emboss_combo(self):
        result = extract_special_effects("ฟอยล์+นูน")
        assert result[0]["type"] == "foil_emboss"

    def test_foil_hologram(self):
        result = extract_special_effects("ฟอยล์โฮโลแกรม")
        assert result[0]["type"] == "foil_special"

    def test_opp_gloss(self):
        result = extract_special_effects("OPP Gloss")
        assert result[0]["type"] == "opp_gloss"

    def test_varnish_matte(self):
        result = extract_special_effects("วานิชด้าน")
        assert result[0]["type"] == "varnish_matte"

    # --- Multiple effects ---
    def test_multiple_effects(self):
        result = extract_special_effects("เคลือบเงา และ ป๊ัมนูน")
        types = [e["type"] for e in result]
        assert "aq_gloss" in types
        assert "emboss" in types

    # --- Skip ---
    def test_skip(self):
        assert extract_special_effects("ไม่ต้องการ") == "skip"

    def test_unknown(self):
        assert extract_special_effects("อยากได้อะไรดีนะ") is None


# ================================================
# 10. extract_has_existing_block
# ================================================
class TestExtractHasExistingBlock:
    """ทดสอบ Step 9 sub-step: บล็อกป๊ัม"""

    def test_has_block(self):
        assert extract_has_existing_block("เคยทำบล็อกแล้ว") is True

    def test_no_block(self):
        assert extract_has_existing_block("ไม่เคย") is False

    def test_first_time(self):
        assert extract_has_existing_block("ครั้งแรก") is False

    def test_ambiguous(self):
        assert extract_has_existing_block("จำไม่ได้") is None


# ================================================
# 11. Confirmation / Rejection / Skip
# ================================================
class TestConfirmationResponses:
    """ทดสอบ Checkpoint responses"""

    # --- Confirmation ---
    def test_confirm_thai(self):
        assert is_confirmation("ถูกต้อง") is True

    def test_confirm_yes(self):
        assert is_confirmation("ใช่ครับ") is True

    def test_confirm_ok(self):
        assert is_confirmation("ok") is True

    def test_not_confirm(self):
        assert is_confirmation("ยังไม่แน่ใจ") is False

    # --- Rejection ---
    def test_reject_edit(self):
        assert is_rejection("แก้ไขขนาด") is True

    def test_reject_change(self):
        assert is_rejection("เปลี่ยนประเภทกล่อง") is True

    def test_reject_wrong(self):
        assert is_rejection("ไม่ถูก") is True

    def test_not_reject(self):
        assert is_rejection("ดีเลย") is False

    # --- Skip ---
    def test_skip_thai(self):
        assert is_skip_response("ไม่ต้องการ") is True

    def test_skip_pass(self):
        assert is_skip_response("skip") is True

    def test_not_skip(self):
        assert is_skip_response("ต้องการ") is False

    # --- Add request ---
    def test_add_request(self):
        assert is_add_request("เพิ่ม Inner") is True

    def test_not_add(self):
        assert is_add_request("แก้ไขขนาด") is False


# ================================================
# 12. detect_edit_target
# ================================================
class TestDetectEditTarget:
    """ทดสอบ Checkpoint edit detection"""

    def test_edit_product_type(self):
        assert detect_edit_target("แก้ไขประเภทสินค้า") == 2

    def test_edit_box_type(self):
        assert detect_edit_target("เปลี่ยนประเภทกล่อง") == 3

    def test_edit_dimensions(self):
        assert detect_edit_target("แก้ไขขนาด") == 5

    def test_edit_quantity(self):
        assert detect_edit_target("เปลี่ยนจำนวน") == 5

    def test_edit_material(self):
        assert detect_edit_target("เปลี่ยนวัสดุ") == 3

    def test_edit_mood(self):
        assert detect_edit_target("แก้ไข mood") == 7

    def test_edit_logo(self):
        assert detect_edit_target("เปลี่ยนโลโก้") == 8

    def test_edit_effects(self):
        assert detect_edit_target("แก้ลูกเล่น") == 9

    def test_add_inner(self):
        assert detect_edit_target("เพิ่ม inner") == 4

    def test_undetectable(self):
        assert detect_edit_target("แก้ไขอะไรสักอย่าง") is None


# ================================================
# Run
# ================================================
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])