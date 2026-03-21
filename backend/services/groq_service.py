"""
Groq Service
เชื่อมต่อกับ Groq LLM API
"""

import os
from typing import List, Dict, Optional
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class GroqService:
    """Service สำหรับเชื่อมต่อ Groq LLM"""
    
    def __init__(self):
        """Initialize Groq client"""
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        self.client = Groq(api_key=api_key)
        self.model = os.getenv("MODEL_NAME", "mixtral-8x7b-32768")
        
        # Default parameters
        self.temperature = 0.7  # ความสร้างสรรค์ (0-2)
        self.max_tokens = 1024  # ความยาวสูงสุดของ response
        self.top_p = 0.9        # ความหลากหลายของคำตอบ
    
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
        
        Args:
            system_prompt: System prompt (บุคลิกและหน้าที่ของ bot)
            user_message: ข้อความจากลูกค้า
            conversation_history: ประวัติการสนทนา (Optional)
            temperature: ความสร้างสรรค์ (Optional)
            max_tokens: ความยาวสูงสุด (Optional)
            
        Returns:
            response text จาก LLM
        """
        # สร้าง messages array
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # เพิ่ม conversation history ถ้ามี
        if conversation_history:
            messages.extend(conversation_history)
        
        # เพิ่มข้อความล่าสุดจาก user
        messages.append({"role": "user", "content": user_message})
        
        # เรียก Groq API
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature or self.temperature,
                max_tokens=max_tokens or self.max_tokens,
                top_p=self.top_p,
                stream=False
            )
            
            # ดึง response text
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"[ERR] Groq API Error: {e}")
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
        
        Args:
            system_prompt: System prompt
            user_message: ข้อความจาก user
            conversation_history: ประวัติการสนทนา
            extraction_schema: Schema สำหรับ extract ข้อมูล
            
        Returns:
            {
                "response": "ข้อความตอบกลับ",
                "extracted_data": {...}
            }
        """
        # เพิ่ม instruction สำหรับ extraction ใน system prompt
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
        
        # เรียก LLM
        response_text = await self.generate_response(
            system_prompt=full_system_prompt,
            user_message=user_message,
            conversation_history=conversation_history
        )
        
        # Parse response
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
        """
        Response สำรอง (ใช้เมื่อ API error)
        """
        return """ขออภัยค่ะ ตอนนี้ระบบมีปัญหาชั่วคราว 
        
กรุณาลองใหม่อีกครั้งในอีกสักครู่ หรือติดต่อทีมงานของเราโดยตรงค่ะ
        
Email: support@lumopack.com
Tel: 02-xxx-xxxx"""
    
    def set_temperature(self, temperature: float):
        """ตั้งค่า temperature (0-2)"""
        if 0 <= temperature <= 2:
            self.temperature = temperature
        else:
            raise ValueError("Temperature must be between 0 and 2")
    
    def set_max_tokens(self, max_tokens: int):
        """ตั้งค่า max_tokens"""
        if max_tokens > 0:
            self.max_tokens = max_tokens
        else:
            raise ValueError("max_tokens must be positive")
    
    def get_model_info(self) -> Dict:
        """ดึงข้อมูล model ที่ใช้"""
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
    """
    ดึง Groq service instance (singleton pattern)
    
    Returns:
        GroqService instance
    """
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
    """
    Quick function สำหรับเรียก LLM แบบง่ายๆ
    
    Usage:
        response = await quick_generate(
            system_prompt="You are a helpful assistant",
            user_message="Hello!"
        )
    """
    service = get_groq_service()
    return await service.generate_response(
        system_prompt=system_prompt,
        user_message=user_message,
        conversation_history=history
    )


async def test_groq_connection() -> bool:
    """
    ทดสอบการเชื่อมต่อกับ Groq API
    
    Returns:
        True ถ้าเชื่อมต่อได้, False ถ้าไม่ได้
    """
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


# ===================================
# Example Usage
# ===================================
if __name__ == "__main__":
    import asyncio
    
    async def main():
        print("🧪 Testing Groq Service...")
        print("="*50)
        
        # Test 1: Simple generation
        print("\n📝 Test 1: Simple generation")
        response = await quick_generate(
            system_prompt="คุณคือผู้ช่วยที่เป็นมิตร",
            user_message="สวัสดีครับ"
        )
        print(f"Response: {response}")
        
        # Test 2: With history
        print("\n📝 Test 2: With conversation history")
        history = [
            {"role": "user", "content": "ฉันชื่อ John"},
            {"role": "assistant", "content": "สวัสดีครับคุณ John"}
        ]
        response = await quick_generate(
            system_prompt="คุณคือผู้ช่วยที่เป็นมิตร จำชื่อลูกค้าได้",
            user_message="ฉันชื่ออะไร?",
            history=history
        )
        print(f"Response: {response}")
        
        # Test 3: Connection test
        print("\n📝 Test 3: Connection test")
        is_connected = await test_groq_connection()
        print(f"Connection: {'✅ OK' if is_connected else '❌ Failed'}")
        
        print("\n" + "="*50)
        print("✅ All tests completed!")
    
    # Run tests
    asyncio.run(main())
