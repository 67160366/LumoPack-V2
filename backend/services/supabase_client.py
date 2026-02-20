"""
Supabase Client — Backend (Service Key)
ใช้ service_key เพื่อ bypass RLS สำหรับ admin operations
"""

import os
from dotenv import load_dotenv

load_dotenv()

_client = None


def get_supabase():
    """Get or create Supabase client (singleton)"""
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print("⚠️ SUPABASE_URL or SUPABASE_SERVICE_KEY not set — DB features disabled")
        return None

    from supabase import create_client
    _client = create_client(url, key)
    return _client
