"""
LLM Service — Google Gemini
(Drop-in replacement for Groq — same interface, class name, and singleton)
"""

import os
from typing import List, Dict, Optional
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class GroqService:
    """Service สำหรับเชื่อมต่อ LLM (Gemini)"""

    def __init__(self):
        """Initialize Gemini client"""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")

        self.client = genai.Client(api_key=api_key)
        self.model = os.getenv("MODEL_NAME", "gemini-2.0-flash")

        # Default parameters
        self.temperature = 0.7
        self.max_tokens = 1024
        self.top_p = 0.9

    async def generate_response(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        สร้าง response จาก LLM
        """
        # Build contents: system instruction + history + user message
        contents = []

        if conversation_history:
            for msg in conversation_history:
                role = msg.get("role", "user")
                # Gemini uses "user" and "model" (not "assistant")
                if role == "assistant":
                    role = "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}]
                })

        # Add current user message
        contents.append({
            "role": "user",
            "parts": [{"text": user_message}]
        })

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config={
                    "system_instruction": system_prompt,
                    "temperature": temperature or self.temperature,
                    "max_output_tokens": max_tokens or self.max_tokens,
                    "top_p": self.top_p,
                },
            )

            return response.text

        except Exception as e:
            print(f"[ERR] Gemini API Error: {e}")
            return self._get_fallback_response(user_message)

    async def generate_response_with_extraction(
        self,
        system_prompt: str,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        extraction_schema: Optional[Dict] = None
    ) -> Dict:
        """
        สร้าง response และ extract structured data
        """
        if extraction_schema:
            extraction_instruction = f"""

นอกจากตอบคำถามแล้ว ให้ extract ข้อมูลตาม format นี้:
{extraction_schema}

ตอบในรูปแบบ:
RESPONSE: [คำตอบสำหรับลูกค้า]
EXTRACTED_DATA: {{json object}}
"""
            full_system_prompt = system_prompt + extraction_instruction
        else:
            full_system_prompt = system_prompt

        response_text = await self.generate_response(
            system_prompt=full_system_prompt,
            user_message=user_message,
            conversation_history=conversation_history
        )

        if "EXTRACTED_DATA:" in response_text:
            parts = response_text.split("EXTRACTED_DATA:")
            response = parts[0].replace("RESPONSE:", "").strip()
            try:
                import json
                extracted_data = json.loads(parts[1].strip())
            except:
                extracted_data = {}
        else:
            response = response_text
            extracted_data = {}

        return {
            "response": response,
            "extracted_data": extracted_data
        }

    def _get_fallback_response(self, user_message: str) -> str:
        """Response สำรอง (ใช้เมื่อ API error)"""
        return """ขออภัยค่ะ ตอนนี้ระบบมีปัญหาชั่วคราว

กรุณาลองใหม่อีกครั้งในอีกสักครู่ หรือติดต่อทีมงานของเราโดยตรงค่ะ

Email: support@lumopack.com
Tel: 02-xxx-xxxx"""

    def set_temperature(self, temperature: float):
        if 0 <= temperature <= 2:
            self.temperature = temperature
        else:
            raise ValueError("Temperature must be between 0 and 2")

    def set_max_tokens(self, max_tokens: int):
        if max_tokens > 0:
            self.max_tokens = max_tokens
        else:
            raise ValueError("max_tokens must be positive")

    def get_model_info(self) -> Dict:
        return {
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "top_p": self.top_p
        }


# ===================================
# Global Instance (Singleton)
# ===================================
_groq_service_instance: Optional[GroqService] = None


def get_groq_service() -> GroqService:
    """ดึง LLM service instance (singleton pattern)"""
    global _groq_service_instance

    if _groq_service_instance is None:
        _groq_service_instance = GroqService()

    return _groq_service_instance


# ===================================
# Helper Functions
# ===================================
async def quick_generate(
    system_prompt: str,
    user_message: str,
    history: Optional[List[Dict]] = None
) -> str:
    service = get_groq_service()
    return await service.generate_response(
        system_prompt=system_prompt,
        user_message=user_message,
        conversation_history=history
    )


async def test_groq_connection() -> bool:
    try:
        service = get_groq_service()
        response = await service.generate_response(
            system_prompt="You are a test bot",
            user_message="Say 'OK' if you can hear me"
        )
        return "OK" in response or "ok" in response.lower()
    except Exception as e:
        print(f"[ERR] Connection test failed: {e}")
        return False
