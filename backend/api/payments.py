"""
Payments API — จัดการการชำระเงิน

Endpoints:
- POST   /api/payments              — Record payment
- PATCH  /api/payments/{id}/approve — Approve (admin)
- PATCH  /api/payments/{id}/reject  — Reject (admin)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from middleware.auth import get_current_user, require_admin, AuthUser
from services.supabase_client import get_supabase

router = APIRouter(prefix="/payments", tags=["payments"])


class CreatePaymentRequest(BaseModel):
    order_id: str
    amount: float
    type: str = "deposit"  # deposit | remaining
    slip_url: Optional[str] = None


@router.post("")
async def create_payment(req: CreatePaymentRequest, user: AuthUser = Depends(get_current_user)):
    """Record a new payment"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    # Verify order belongs to user
    order = supabase.table("orders").select("user_id").eq("id", req.order_id).single().execute()
    if not order.data:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.data.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = supabase.table("payments").insert({
        "order_id": req.order_id,
        "amount": req.amount,
        "type": req.type,
        "slip_url": req.slip_url,
        "status": "pending",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create payment")

    return result.data[0]


@router.patch("/{payment_id}/approve")
async def approve_payment(payment_id: str, user: AuthUser = Depends(require_admin)):
    """Approve a payment slip (admin only)"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    result = supabase.table("payments").update({
        "status": "approved",
        "reviewed_by": user.id,
    }).eq("id", payment_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Auto-update order status to deposit_paid
    payment = result.data[0]
    supabase.table("orders").update({
        "status": "deposit_paid",
    }).eq("id", payment["order_id"]).execute()

    return result.data[0]


@router.patch("/{payment_id}/reject")
async def reject_payment(payment_id: str, user: AuthUser = Depends(require_admin)):
    """Reject a payment slip (admin only)"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    result = supabase.table("payments").update({
        "status": "rejected",
        "reviewed_by": user.id,
    }).eq("id", payment_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Payment not found")

    return result.data[0]
