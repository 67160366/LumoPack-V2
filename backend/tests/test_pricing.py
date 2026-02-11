"""
Unit Tests สำหรับ Pricing Calculator
ทดสอบการคำนวณราคาว่าตรงตาม requirement หรือไม่
"""

import sys
import os

# เพิ่ม path เพื่อให้ import ได้
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.pricing_calculator import PricingCalculator, get_price_estimate


def test_surface_area_calculation():
    """ทดสอบการคำนวณพื้นที่ผิว"""
    calc = PricingCalculator()
    
    # กล่อง 10x10x10 ต้องได้ 600 cm²
    area = calc.calculate_surface_area(10, 10, 10)
    assert area == 600, f"Expected 600, got {area}"
    
    # กล่อง 25x30x40
    area = calc.calculate_surface_area(25, 30, 40)
    expected = 2 * ((25*30) + (25*40) + (30*40))  # = 5900
    assert area == expected, f"Expected {expected}, got {area}"
    
    print("✅ Test surface area: PASSED")


def test_price_ratio():
    """ทดสอบการคำนวณ Factor"""
    calc = PricingCalculator()
    
    # กล่อง 10x10x10 ต้องได้ ratio = 1
    ratio = calc.calculate_price_ratio(10, 10, 10, "rsc")
    assert abs(ratio - 1.0) < 0.01, f"Expected ~1.0, got {ratio}"
    
    # กล่อง 25x30x40 (RSC)
    # พื้นที่ = 5900, factor 1.1 → 6490
    # มาตรฐาน = 600, factor 1.1 → 660
    # ratio = 6490/660 ≈ 9.83
    ratio = calc.calculate_price_ratio(25, 30, 40, "rsc")
    assert abs(ratio - 9.83) < 0.1, f"Expected ~9.83, got {ratio}"
    
    print("✅ Test price ratio: PASSED")


def test_box_base_price():
    """ทดสอบการคำนวณราคากล่องเปล่า"""
    calc = PricingCalculator()
    
    # ตัวอย่าง: กล่อง RSC ลูกฟูก 10x10x10 จำนวน 500 กล่อง
    result = calc.calculate_box_base_price(
        width=10,
        length=10,
        height=10,
        box_type="rsc",
        material="corrugated_2layer",
        quantity=500
    )
    
    # ตาม manual ราคาต้นทุนรวมประมาณ 3.378 บาท/ใบ
    # (0.099 kg × 22 บาท/kg) + 1.2 = 3.378
    assert result["price_per_box"] > 3.0, f"Price seems too low: {result['price_per_box']}"
    assert result["price_per_box"] < 4.0, f"Price seems too high: {result['price_per_box']}"
    
    print(f"✅ Test box base price: PASSED")
    print(f"   Price per box: {result['price_per_box']} THB")
    print(f"   Total: {result['total_price']} THB")


def test_full_quotation():
    """ทดสอบใบเสนอราคาแบบเต็ม"""
    
    # สมมติลูกค้าสั่ง:
    # - กล่อง Die-cut 20×15×10 cm
    # - วัสดุ: art_300gsm
    # - จำนวน 1000 กล่อง
    # - Inner: shredded_paper
    # - Coating: UV Gloss
    # - ป๊ัมฟอยล์ (ไม่มีบล็อก)
    
    requirement = {
        "dimensions": {"width": 20, "length": 15, "height": 10},
        "box_type": "die_cut",
        "material": "art_300gsm",
        "quantity": 1000,
        "inner": "shredded_paper",
        "coatings": [
            {"type": "uv_gloss", "category": "gloss"}
        ],
        "stampings": [
            {"type": "foil_regular", "has_block": False}
        ]
    }
    
    result = get_price_estimate(requirement)
    
    print("\n" + "="*60)
    print("📦 FULL QUOTATION TEST")
    print("="*60)
    print(f"Box Base:     {result['box_base']['total_price']:>10.2f} THB")
    print(f"Inner:        {result['inner']['total_price']:>10.2f} THB")
    
    for coating in result['coatings']:
        print(f"Coating:      {coating['total_price']:>10.2f} THB ({coating['name']})")
    
    for stamping in result['stampings']:
        print(f"Stamping:     {stamping['total']:>10.2f} THB (Block: {stamping['block_cost']})")
    
    print("-" * 60)
    print(f"Subtotal:     {result['subtotal']:>10.2f} THB")
    print(f"VAT (7%):     {result['vat']:>10.2f} THB")
    print(f"Grand Total:  {result['grand_total']:>10.2f} THB")
    print("="*60)
    
    # ตรวจสอบว่าราคาสมเหตุสมผล
    assert result['grand_total'] > 0, "Total price should be positive"
    assert result['vat'] == round(result['subtotal'] * 0.07, 2), "VAT calculation error"
    
    print("\n✅ Test full quotation: PASSED")


def test_compare_rsc_vs_diecut():
    """เปรียบเทียบราคา RSC vs Die-cut"""
    calc = PricingCalculator()
    
    # กล่องขนาดเดียวกัน แต่ต่างประเภท
    rsc = calc.calculate_box_base_price(
        15, 15, 15, "rsc", "corrugated_2layer", 1000
    )
    
    diecut = calc.calculate_box_base_price(
        15, 15, 15, "die_cut", "corrugated_2layer", 1000
    )
    
    print(f"\n📊 RSC vs Die-cut (15×15×15, 1000 pcs):")
    print(f"   RSC:      {rsc['price_per_box']:.2f} THB/box")
    print(f"   Die-cut:  {diecut['price_per_box']:.2f} THB/box")
    print(f"   Diff:     {diecut['price_per_box'] - rsc['price_per_box']:.2f} THB/box")
    
    # Die-cut ต้องแพงกว่า (factor 1.5 vs 1.1)
    assert diecut['price_per_box'] > rsc['price_per_box'], "Die-cut should be more expensive"
    
    print("✅ Test RSC vs Die-cut: PASSED")


if __name__ == "__main__":
    print("🧪 Running Pricing Calculator Tests...\n")
    
    try:
        test_surface_area_calculation()
        test_price_ratio()
        test_box_base_price()
        test_compare_rsc_vs_diecut()
        test_full_quotation()
        
        print("\n" + "="*60)
        print("🎉 ALL TESTS PASSED!")
        print("="*60)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()