"""
Box Structural Analysis API
วิเคราะห์ความแข็งแรงของกล่องด้วย McKee Formula

ใช้สำหรับ:
- ปุ่ม "⚡ วิเคราะห์ความแข็งแรง" ใน StudioPanel
- เปลี่ยนกล่อง 3D เป็น Heatmap (แดง/เขียว)
"""

import math
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


# ===================================
# Router
# ===================================
router = APIRouter(tags=["Analysis"])


# ===================================
# Flute Specifications
# ===================================
FLUTE_SPECS = {
    "A": {"ect": 6.0, "caliper": 4.5, "name": "ลอน A (หนาสุด)"},
    "B": {"ect": 5.2, "caliper": 2.5, "name": "ลอน B (บาง)"},
    "C": {"ect": 5.6, "caliper": 3.6, "name": "ลอน C (มาตรฐาน)"},
    "E": {"ect": 3.8, "caliper": 1.5, "name": "ลอน E (จิ๋ว)"},
    "BC": {"ect": 10.8, "caliper": 6.1, "name": "ลอน BC (2 ชั้น)"},
}


# ===================================
# Request / Response Models
# ===================================
class AnalyzeRequest(BaseModel):
    length: float = Field(..., gt=0, description="ความยาว (cm)")
    width: float = Field(..., gt=0, description="ความกว้าง (cm)")
    height: float = Field(..., gt=0, description="ความสูง (cm)")
    weight: float = Field(0, ge=0, description="น้ำหนักสินค้า (kg)")
    flute_type: str = Field("C", description="ลอนกระดาษ (A/B/C/E/BC)")


class AnalyzeResponse(BaseModel):
    status: str = Field(..., description="SAFE หรือ DANGER")
    safety_score: int = Field(..., ge=0, le=100)
    max_load_kg: float = Field(..., description="น้ำหนักที่รับได้สูงสุด (kg)")
    recommendation: str
    flute_type: str
    bct_kgf: float = Field(..., description="Box Compression Test (kgf)")
    safety_factor: float


# ===================================
# McKee Formula
# ===================================
def mckee_bct(ect_kn_m: float, caliper_mm: float, perimeter_mm: float) -> float:
    """
    คำนวณ Box Compression Test (BCT) ด้วย McKee Formula

    BCT = k × ECT^a × Z^(1-a) × h^a

    k = 2.028, a = 0.746
    ECT = Edge Crush Test (kN/m → lbf/in)
    Z   = box perimeter (mm → in)
    h   = caliper thickness (mm → in)

    Returns: BCT in kgf
    """
    ect_lbf_in = ect_kn_m * 5.71015   # kN/m → lbf/in
    z_in = perimeter_mm / 25.4          # mm → in
    h_in = caliper_mm / 25.4            # mm → in

    k = 2.028
    a = 0.746

    bct_lbf = k * (ect_lbf_in ** a) * (z_in ** (1 - a)) * (h_in ** a)
    bct_kgf = bct_lbf * 0.453592

    return bct_kgf


def analyze_box_strength(
    length_cm: float, width_cm: float, height_cm: float,
    weight_kg: float, flute_type: str
) -> dict:
    """วิเคราะห์ความแข็งแรงของกล่อง"""

    flute = FLUTE_SPECS.get(flute_type.upper(), FLUTE_SPECS["C"])
    perimeter_mm = 2 * (length_cm + width_cm) * 10

    bct_kgf = mckee_bct(flute["ect"], flute["caliper"], perimeter_mm)

    # Safety Factor — stacking factor = 3
    stacking_factor = 3
    max_load_kg = bct_kgf / stacking_factor

    if weight_kg > 0:
        safety_factor = max_load_kg / weight_kg
    else:
        safety_factor = 999

    # คะแนน 0-100
    if safety_factor >= 5:
        score = 100
    elif safety_factor >= 3:
        score = int(70 + (safety_factor - 3) * 15)
    elif safety_factor >= 1.5:
        score = int(40 + (safety_factor - 1.5) * 20)
    elif safety_factor >= 1:
        score = int(20 + (safety_factor - 1) * 40)
    else:
        score = max(0, int(safety_factor * 20))
    score = max(0, min(100, score))

    # สถานะ + คำแนะนำ
    if score >= 70:
        status = "SAFE"
        recommendation = (
            f"กล่อง {flute['name']} แข็งแรงเพียงพอสำหรับสินค้าน้ำหนัก {weight_kg:.1f} kg"
        )
    elif score >= 40:
        status = "SAFE"
        recommendation = (
            f"กล่อง {flute['name']} ใช้ได้ แต่แนะนำเพิ่มความหนาเพื่อความปลอดภัย"
        )
    else:
        status = "DANGER"
        better = [
            f for f, s in FLUTE_SPECS.items()
            if s["ect"] > flute["ect"] and f != flute_type.upper()
        ]
        if better:
            suggestion = f"แนะนำเปลี่ยนเป็น {FLUTE_SPECS[better[0]]['name']}"
        else:
            suggestion = "แนะนำใช้กล่อง 2 ชั้น (BC flute)"
        recommendation = (
            f"⚠️ กล่อง {flute['name']} ไม่แข็งแรงพอสำหรับ {weight_kg:.1f} kg — {suggestion}"
        )

    return {
        "status": status,
        "safety_score": score,
        "max_load_kg": round(max_load_kg, 2),
        "recommendation": recommendation,
        "flute_type": flute_type.upper(),
        "bct_kgf": round(bct_kgf, 2),
        "safety_factor": round(safety_factor, 2),
    }


# ===================================
# Endpoint
# ===================================
@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """วิเคราะห์ความแข็งแรงของกล่องด้วย McKee Formula"""
    try:
        result = analyze_box_strength(
            length_cm=request.length,
            width_cm=request.width,
            height_cm=request.height,
            weight_kg=request.weight,
            flute_type=request.flute_type,
        )
        return AnalyzeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")