"""
Pricing API Endpoints
คำนวณราคากล่อง
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List

from services.pricing_calculator import get_price_estimate


# ===================================
# Request/Response Models
# ===================================

class DimensionsModel(BaseModel):
    """ขนาดกล่อง"""
    width: float = Field(..., gt=0, description="กว้าง (cm)")
    length: float = Field(..., gt=0, description="ยาว (cm)")
    height: float = Field(..., gt=0, description="สูง (cm)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "width": 20,
                "length": 15,
                "height": 10
            }
        }


class CoatingModel(BaseModel):
    """การเคลือบ"""
    type: str = Field(..., description="ประเภทการเคลือบ")
    category: str = Field(..., description="หมวดหมู่ (gloss, matte, moisture, food_grade)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "uv_gloss",
                "category": "gloss"
            }
        }


class StampingModel(BaseModel):
    """การป๊ัม"""
    type: str = Field(..., description="ประเภทการป๊ัม (emboss, foil_regular, etc.)")
    has_block: bool = Field(default=False, description="มีบล็อกป๊ัมแล้วหรือไม่")
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "emboss",
                "has_block": False
            }
        }


class PricingRequest(BaseModel):
    """Request model สำหรับคำนวณราคา"""
    dimensions: DimensionsModel = Field(..., description="ขนาดกล่อง")
    box_type: str = Field(..., description="ประเภทกล่อง (rsc, die_cut)")
    material: str = Field(..., description="วัสดุ")
    quantity: int = Field(..., gt=0, description="จำนวนกล่อง")
    inner: Optional[str] = Field(None, description="Inner (Optional)")
    coatings: Optional[List[CoatingModel]] = Field(None, description="การเคลือบ (Optional)")
    stampings: Optional[List[StampingModel]] = Field(None, description="การป๊ัม (Optional)")
    
    @validator('box_type')
    def validate_box_type(cls, v):
        if v not in ['rsc', 'die_cut']:
            raise ValueError('box_type must be "rsc" or "die_cut"')
        return v
    
    @validator('quantity')
    def validate_quantity(cls, v):
        if v < 500:
            raise ValueError('quantity must be at least 500')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "dimensions": {"width": 20, "length": 15, "height": 10},
                "box_type": "rsc",
                "material": "corrugated_2layer",
                "quantity": 1000,
                "inner": "shredded_paper",
                "coatings": [{"type": "uv_gloss", "category": "gloss"}],
                "stampings": [{"type": "emboss", "has_block": False}]
            }
        }


class PricingResponse(BaseModel):
    """Response model สำหรับผลการคำนวณราคา"""
    box_base: float = Field(..., description="ราคากล่องเปล่า (THB)")
    inner: Optional[float] = Field(None, description="ราคา Inner (THB)")
    coatings: Optional[float] = Field(None, description="ราคาการเคลือบ (THB)")
    stampings: Optional[float] = Field(None, description="ราคาการป๊ัม (THB)")
    subtotal: float = Field(..., description="ราคารวมก่อน VAT (THB)")
    vat: float = Field(..., description="VAT 7% (THB)")
    grand_total: float = Field(..., description="ราคารวมสุทธิ (THB)")
    price_per_box: float = Field(..., description="ราคาต่อกล่อง (THB)")
    breakdown: Dict[str, Any] = Field(..., description="รายละเอียดการคำนวณ")
    
    class Config:
        json_schema_extra = {
            "example": {
                "box_base": 10000.00,
                "inner": 5000.00,
                "coatings": 2000.00,
                "stampings": 3000.00,
                "subtotal": 20000.00,
                "vat": 1400.00,
                "grand_total": 21400.00,
                "price_per_box": 21.40,
                "breakdown": {}
            }
        }


# ===================================
# Router
# ===================================

router = APIRouter(
    prefix="/pricing",
    tags=["Pricing"],
    responses={
        400: {"description": "Bad request"},
        500: {"description": "Internal server error"}
    }
)


# ===================================
# Endpoints
# ===================================

@router.post("/calculate", response_model=PricingResponse, status_code=status.HTTP_200_OK)
async def calculate_pricing(request: PricingRequest):
    """
    คำนวณราคากล่อง
    
    - **dimensions**: ขนาดกล่อง (width, length, height)
    - **box_type**: ประเภทกล่อง (rsc, die_cut)
    - **material**: วัสดุ
    - **quantity**: จำนวนกล่อง (ขั้นต่ำ 500)
    - **inner**: Inner (Optional)
    - **coatings**: การเคลือบ (Optional)
    - **stampings**: การป๊ัม (Optional)
    
    Returns:
    - ราคารวมและรายละเอียดการคำนวณ
    """
    try:
        # แปลง request เป็น dict สำหรับ pricing_calculator
        pricing_data = {
            "dimensions": request.dimensions.dict(),
            "box_type": request.box_type,
            "material": request.material,
            "quantity": request.quantity
        }
        
        # เพิ่ม optional fields
        if request.inner:
            pricing_data["inner"] = request.inner
        
        if request.coatings:
            pricing_data["coatings"] = [c.dict() for c in request.coatings]
        
        if request.stampings:
            pricing_data["stampings"] = [s.dict() for s in request.stampings]
        
        # คำนวณราคา
        result = get_price_estimate(pricing_data)
        
        # Map nested dict → flat PricingResponse
        # result["box_base"] เป็น dict: {"price_per_box": X, "total_price": Y, ...}
        # result["inner"] เป็น dict: {"price_per_box": X, "total_price": Y}
        # result["coatings"] เป็น list of dict
        # result["stampings"] เป็น list of dict
        
        box_base_total = result["box_base"]["total_price"]
        
        inner_total = result["inner"]["total_price"] if result.get("inner") else 0
        
        coatings_total = sum(c["total_price"] for c in result.get("coatings", []))
        
        stampings_total = sum(s["total"] for s in result.get("stampings", []))
        
        quantity = request.quantity
        price_per_box = result["grand_total"] / quantity if quantity > 0 else 0
        
        # Return response
        return PricingResponse(
            box_base=round(box_base_total, 2),
            inner=round(inner_total, 2) if inner_total > 0 else None,
            coatings=round(coatings_total, 2) if coatings_total > 0 else None,
            stampings=round(stampings_total, 2) if stampings_total > 0 else None,
            subtotal=result["subtotal"],
            vat=result["vat"],
            grand_total=result["grand_total"],
            price_per_box=round(price_per_box, 2),
            breakdown=result
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating pricing: {str(e)}"
        )


@router.get("/materials")
async def get_available_materials():
    """
    ดูรายการวัสดุที่มี
    
    Returns:
    - รายการวัสดุทั้งหมด
    """
    materials = {
        "rsc": [
            {"id": "corrugated_2layer", "name": "กระดาษลูกฟูก 2 ชั้น"},
            {"id": "kraft_200gsm", "name": "กระดาษคราฟท์ 200 GSM"}
        ],
        "die_cut": [
            {"id": "corrugated_2layer", "name": "กระดาษลูกฟูก 2 ชั้น"},
            {"id": "chipboard", "name": "กระดาษแข็ง (จั่วปัง)"},
            {"id": "art_300gsm", "name": "กระดาษอาร์ต 300 GSM"},
            {"id": "white_box_350gsm", "name": "กระดาษกล่องขาว 350 GSM"}
        ]
    }
    
    return {
        "materials": materials,
        "note": "เลือกวัสดุตามประเภทกล่อง"
    }


@router.get("/coatings")
async def get_available_coatings():
    """
    ดูรายการการเคลือบที่มี
    
    Returns:
    - รายการการเคลือบทั้งหมด
    """
    coatings = {
        "gloss": [
            {"type": "aq_gloss", "name": "Gloss AQ Coating"},
            {"type": "uv_gloss", "name": "UV Gloss Coating"},
            {"type": "opp_gloss", "name": "OPP Gloss Film"}
        ],
        "matte": [
            {"type": "uv_matte", "name": "UV Matte"},
            {"type": "pvc_matte", "name": "PVC Matte Laminate"},
            {"type": "varnish_matte", "name": "Varnish Matte"}
        ]
    }
    
    return {
        "coatings": coatings,
        "note": "สามารถเลือกได้หลายอย่าง"
    }


@router.get("/stampings")
async def get_available_stampings():
    """
    ดูรายการการป๊ัมที่มี
    
    Returns:
    - รายการการป๊ัมทั้งหมด
    """
    stampings = [
        {"type": "emboss", "name": "ป๊ัมนูน"},
        {"type": "deboss", "name": "ป๊ัมจม"},
        {"type": "foil_regular", "name": "ป๊ัมฟอยล์ธรรมดา"},
        {"type": "foil_detailed", "name": "ป๊ัมฟอยล์ละเอียด"},
        {"type": "foil_emboss", "name": "ป๊ัมฟอยล์ + นูน"}
    ]
    
    return {
        "stampings": stampings,
        "note": "การป๊ัมครั้งแรกต้องทำบล็อกป๊ัม (has_block: false)"
    }