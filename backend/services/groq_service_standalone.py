"""
Groq Service - Standalone Version
เชื่อมต่อกับ Groq LLM API
"""

import os
from typing import List, Dict, Optional

try:
    from groq import Groq
except ImportError:
    print("❌ groq library not found! Run: pip install groq==0.4.1")
    raise

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️ python-dotenv not found. Using environment variables only.")


class GroqService:
    """Service สำหรับเชื่อมต่อ Groq LLM"""
    
    def __init__(self):
        """Initialize Groq client"""
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError(
                "GROQ_API_KEY not found in environment variables. "
                "Please add it to .env file"
            )
        
        try:
            # Initialize Groq client (compatible with multiple versions)
            self.client = Groq(api_key=api_key)
        except TypeError as e:
            # Try without extra arguments if version mismatch
            try:
                self.client = Groq(api_key=api_key)
            except:
                raise ValueError(f"Failed to initialize Groq client: {e}")
        except Exception as e:
            raise ValueError(f"Failed to initialize Groq client: {e}")
        
        self.model = os.getenv("MODEL_NAME", "llama-3.3-70b-versatile")
        
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
        
        Args:
            system_prompt: System prompt
            user_message: ข้อความจากลูกค้า
            conversation_history: ประวัติการสนทนา
            temperature: ความสร้างสรรค์
            max_tokens: ความยาวสูงสุด
            
        Returns:
            response text
        """
        messages = [{"role": "system", "content": system_prompt}]
        
        if conversation_history:
            messages.extend(conversation_history)
        
        messages.append({"role": "user", "content": user_message})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature or self.temperature,
                max_tokens=max_tokens or self.max_tokens,
                top_p=self.top_p,
                stream=False
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"❌ Groq API Error: {e}")
            return self._get_fallback_response(user_message)
    
    def _get_fallback_response(self, user_message: str) -> str:
        """Response สำรอง"""
        return """ขออภัยค่ะ ตอนนี้ระบบมีปัญหาชั่วคราว 
        
กรุณาลองใหม่อีกครั้งในอีกสักครู่ หรือติดต่อทีมงานของเราโดยตรงค่ะ

📧 Email: support@lumopack.com
📞 Tel: 02-xxx-xxxx"""
    
    def get_model_info(self) -> Dict:
        """ดึงข้อมูล model"""
        return {
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "top_p": self.top_p
        }


# Global instance
_groq_service_instance: Optional[GroqService] = None


def get_groq_service() -> GroqService:
    """
    Get Groq service instance (singleton)
    
    Returns:
        GroqService instance
    """
    global _groq_service_instance
    
    if _groq_service_instance is None:
        _groq_service_instance = GroqService()
    
    return _groq_service_instance


# Test if this file is run directly
if __name__ == "__main__":
    import asyncio
    
    async def test():
        print("🧪 Testing Groq Service...")
        
        try:
            service = get_groq_service()
            print(f"✅ Service created")
            print(f"   Model: {service.model}")
            
            response = await service.generate_response(
                system_prompt="You are a helpful assistant. Reply briefly.",
                user_message="Say 'OK' if you can hear me"
            )
            
            print(f"✅ Response: {response}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
    
    asyncio.run(test())
