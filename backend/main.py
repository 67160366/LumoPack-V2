"""
LumoPack Backend API
FastAPI application for LumoPack Chatbot
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time

from api.chat import router as chat_router
from api.pricing import router as pricing_router
from api.analyze import router as analyze_router
from api.orders import router as orders_router
from api.payments import router as payments_router


# ===================================
# Lifespan Events
# ===================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events
    - startup: ทำงานเมื่อ server เริ่มต้น
    - shutdown: ทำงานเมื่อ server ปิด
    """
    # Startup
    print("🚀 LumoPack API Server Starting...")
    print("📍 Groq LLM: llama-3.3-70b-versatile")
    print("✅ Ready to serve!")
    
    yield
    
    # Shutdown
    print("👋 LumoPack API Server Shutting Down...")


# ===================================
# FastAPI Application
# ===================================

app = FastAPI(
    title="LumoPack API",
    description="REST API for LumoPack AI Chatbot - ออกแบบกล่องบรรจุภัณฑ์ด้วย AI",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)


# ===================================
# CORS Middleware
# ===================================

# อนุญาตให้ Frontend เรียก API ได้
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:5173",  # Vite dev server
        "http://localhost:8080",  # Alternative
        "*"  # Allow all (สำหรับ development)
    ],
    allow_credentials=True,
    allow_methods=["*"],  # อนุญาตทุก HTTP methods
    allow_headers=["*"],  # อนุญาตทุก headers
)


# ===================================
# Middleware - Request Logging
# ===================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log ทุก request"""
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration = time.time() - start_time
    
    # Log
    print(f"📝 {request.method} {request.url.path} - {response.status_code} ({duration:.3f}s)")
    
    return response


# ===================================
# Exception Handlers
# ===================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """จัดการ errors ทั้งหมด"""
    print(f"❌ Error: {str(exc)}")
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": str(exc),
            "path": str(request.url.path)
        }
    )


# ===================================
# Routers
# ===================================

# Register API routers
app.include_router(chat_router, prefix="/api")
app.include_router(pricing_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(analyze_router)  # /analyze — root level ตาม frontend


# ===================================
# Root Endpoints
# ===================================

@app.get("/")
async def root():
    """Root endpoint - แสดงข้อมูลเบื้องต้น"""
    return {
        "name": "LumoPack API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "docs": "/docs",
            "chat": "/api/chat",
            "pricing": "/api/pricing"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": time.time()
    }


@app.get("/api/info")
async def api_info():
    """API information"""
    return {
        "api_version": "1.0.0",
        "llm_model": "llama-3.3-70b-versatile",
        "supported_languages": ["th", "en"],
        "features": [
            "AI Chatbot (14 steps)",
            "Pricing Calculator",
            "Session Management",
            "Requirement Validation"
        ]
    }


# ===================================
# Run Server
# ===================================

if __name__ == "__main__":
    import uvicorn
    
    print("="*60)
    print("🚀 Starting LumoPack API Server")
    print("="*60)
    print("📍 URL: http://localhost:8000")
    print("📖 Docs: http://localhost:8000/docs")
    print("🤖 Chat API: http://localhost:8000/api/chat")
    print("💰 Pricing API: http://localhost:8000/api/pricing")
    print("="*60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )