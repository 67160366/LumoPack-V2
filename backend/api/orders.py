"""
Orders API — CRUD สำหรับคำสั่งซื้อ

Endpoints:
- POST   /api/orders             — Create order
- GET    /api/orders             — List orders (user: own, admin: all)
- GET    /api/orders/{id}        — Get order detail
- PATCH  /api/orders/{id}/status — Update status (admin only)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from middleware.auth import get_current_user, require_admin, AuthUser
from services.supabase_client import get_supabase

router = APIRouter(prefix="/orders", tags=["orders"])


class CreateOrderRequest(BaseModel):
    session_id: Optional[str] = None
    collected_data: dict
    pricing: dict
    grand_total: float
    deposit_amount: Optional[float] = None


class UpdateStatusRequest(BaseModel):
    status: str


@router.post("")
async def create_order(req: CreateOrderRequest, user: AuthUser = Depends(get_current_user)):
    """Create a new order"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    result = supabase.table("orders").insert({
        "user_id": user.id,
        "session_id": req.session_id,
        "status": "pending",
        "collected_data": req.collected_data,
        "pricing": req.pricing,
        "grand_total": req.grand_total,
        "deposit_amount": req.deposit_amount or round(req.grand_total * 0.5, 2),
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create order")

    return result.data[0]


@router.get("")
async def list_orders(user: AuthUser = Depends(get_current_user)):
    """List orders — user sees own, admin sees all"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    query = supabase.table("orders").select("*, profiles(full_name, phone, company)")

    if user.role != "admin":
        query = query.eq("user_id", user.id)

    result = query.order("created_at", desc=True).execute()
    return result.data or []


@router.get("/{order_id}")
async def get_order(order_id: str, user: AuthUser = Depends(get_current_user)):
    """Get single order detail"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check access
    if user.role != "admin" and result.data.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return result.data


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    req: UpdateStatusRequest,
    user: AuthUser = Depends(require_admin),
):
    """Update order status (admin only)"""
    valid = ["pending", "deposit_paid", "production", "qc", "shipped", "completed", "cancelled"]
    if req.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    result = supabase.table("orders").update({
        "status": req.status,
    }).eq("id", order_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    return result.data[0]
