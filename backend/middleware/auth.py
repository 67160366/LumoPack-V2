"""
Auth Middleware — Verify Supabase JWT tokens
"""

import os
from typing import Optional
from fastapi import Depends, HTTPException, Header
from pydantic import BaseModel

from services.supabase_client import get_supabase


class AuthUser(BaseModel):
    id: str
    email: Optional[str] = None
    role: str = "customer"


async def get_current_user(authorization: str = Header(None)) -> AuthUser:
    """
    Extract and verify user from Authorization header.
    Returns AuthUser with id, email, role.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    # Extract token
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = parts[1]
    supabase = get_supabase()

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        # Verify JWT with Supabase
        user_response = supabase.auth.get_user(token)
        user = user_response.user

        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Fetch role from profiles table
        profile = supabase.table("profiles").select("role").eq("id", user.id).single().execute()
        role = profile.data.get("role", "customer") if profile.data else "customer"

        return AuthUser(
            id=user.id,
            email=user.email,
            role=role,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")


async def require_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Require admin role"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
