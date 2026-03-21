"""
Projects API — CRUD สำหรับโปรเจคของ user

Endpoints:
- POST   /api/projects             — Create project
- GET    /api/projects             — List user's projects
- GET    /api/projects/{id}        — Get project detail
- PATCH  /api/projects/{id}        — Update project
- DELETE /api/projects/{id}        — Delete project
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from middleware.auth import get_current_user, AuthUser
from services.supabase_client import get_supabase

router = APIRouter(prefix="/projects", tags=["projects"])


# ===================================
# Request / Response Models
# ===================================

class CreateProjectRequest(BaseModel):
    name: str
    box_type: Optional[str] = "rsc"
    dimensions: Optional[dict] = None
    weight_kg: Optional[float] = None
    flute_type: Optional[str] = None
    material: Optional[str] = None
    quantity: Optional[int] = None
    product_type: Optional[str] = None
    mood_tone: Optional[str] = None
    has_logo: Optional[bool] = False
    logo_positions: Optional[list] = None
    inner_materials: Optional[list] = None
    special_effects: Optional[list] = None
    collected_data: Optional[dict] = None
    pricing: Optional[dict] = None
    grand_total: Optional[float] = None
    notes: Optional[str] = None
    # Heart box specific
    shape_pct: Optional[float] = None
    tilt_deg: Optional[float] = None
    support_config: Optional[dict] = None


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    box_type: Optional[str] = None
    dimensions: Optional[dict] = None
    weight_kg: Optional[float] = None
    flute_type: Optional[str] = None
    material: Optional[str] = None
    quantity: Optional[int] = None
    product_type: Optional[str] = None
    mood_tone: Optional[str] = None
    has_logo: Optional[bool] = None
    logo_positions: Optional[list] = None
    inner_materials: Optional[list] = None
    special_effects: Optional[list] = None
    collected_data: Optional[dict] = None
    pricing: Optional[dict] = None
    grand_total: Optional[float] = None
    order_id: Optional[str] = None
    notes: Optional[str] = None
    # Heart box specific
    shape_pct: Optional[float] = None
    tilt_deg: Optional[float] = None
    support_config: Optional[dict] = None


# ===================================
# Endpoints
# ===================================

@router.post("")
async def create_project(req: CreateProjectRequest, user: AuthUser = Depends(get_current_user)):
    """Create a new project"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    row = {
        "user_id": user.id,
        "name": req.name,
        "box_type": req.box_type,
        "dimensions": req.dimensions,
        "weight_kg": req.weight_kg,
        "flute_type": req.flute_type,
        "material": req.material,
        "quantity": req.quantity,
        "product_type": req.product_type,
        "mood_tone": req.mood_tone,
        "has_logo": req.has_logo,
        "logo_positions": req.logo_positions,
        "inner_materials": req.inner_materials,
        "special_effects": req.special_effects,
        "collected_data": req.collected_data,
        "pricing": req.pricing,
        "grand_total": req.grand_total,
        "notes": req.notes,
        "shape_pct": req.shape_pct,
        "tilt_deg": req.tilt_deg,
        "support_config": req.support_config,
    }

    result = supabase.table("projects").insert(row).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create project")

    return result.data[0]


@router.get("")
async def list_projects(user: AuthUser = Depends(get_current_user)):
    """List user's projects (newest first)"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    query = supabase.table("projects").select("*")

    if user.role != "admin":
        query = query.eq("user_id", user.id)

    result = query.order("updated_at", desc=True).execute()
    return result.data or []


@router.get("/{project_id}")
async def get_project(project_id: str, user: AuthUser = Depends(get_current_user)):
    """Get single project detail"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    result = supabase.table("projects").select("*").eq("id", project_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    if user.role != "admin" and result.data.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return result.data


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    req: UpdateProjectRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Update project fields (only non-None fields)"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    # Check ownership
    existing = supabase.table("projects").select("user_id").eq("id", project_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.role != "admin" and existing.data.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate status
    if req.status:
        valid = ["draft", "quoted", "ordered", "archived"]
        if req.status not in valid:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    # Build update payload — only non-None fields
    updates = {k: v for k, v in req.model_dump().items() if v is not None}

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("projects").update(updates).eq("id", project_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update project")

    return result.data[0]


@router.delete("/{project_id}")
async def delete_project(project_id: str, user: AuthUser = Depends(get_current_user)):
    """Delete a project"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    # Check ownership
    existing = supabase.table("projects").select("user_id").eq("id", project_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.role != "admin" and existing.data.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    supabase.table("projects").delete().eq("id", project_id).execute()
    return {"message": "Project deleted"}
