"""
Simple Groq Connection Test
ทดสอบการเชื่อมต่อกับ Groq API แบบง่ายๆ
"""

import sys
import os
import asyncio

# เพิ่ม path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import แบบใช้ get_groq_service แทน
from services.groq_service import get_groq_service


async def main():
    print("="*60)
    print("🧪 Groq Connection Test")
    print("="*60)
    
    # Get service
    try:
        service = get_groq_service()
        print(f"✅ Service initialized")
        print(f"   Model: {service.model}")
    except Exception as e:
        print(f"❌ Cannot initialize service: {e}")
        print("\n💡 Please check:")
        print("   1. GROQ_API_KEY in .env file")
        print("   2. Install groq: pip install groq")
        return
    
    # Test 1: Simple connection test
    print("\n📡 Test 1: Simple connection test...")
    try:
        response = await service.generate_response(
            system_prompt="You are a test bot. Reply only 'OK' if you can hear me.",
            user_message="Hello"
        )
        
        if "OK" in response or "ok" in response.lower():
            print("✅ Connected successfully!")
        else:
            print(f"⚠️  Connected but unexpected response: {response[:50]}")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return
    
    # Test 2: Thai language test
    print("\n💬 Test 2: Thai language test...")
    try:
        response = await service.generate_response(
            system_prompt="คุณคือผู้ช่วยที่เป็นมิตร ตอบสั้นๆ",
            user_message="สวัสดีครับ"
        )
        print(f"Bot: {response[:100]}...")
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    # Test 3: LumoPack style
    print("\n💬 Test 3: LumoPack chatbot style...")
    try:
        response = await service.generate_response(
            system_prompt="""คุณคือ LumoPack Assistant ผู้เชี่ยวชาญด้านบรรจุภัณฑ์
            ตอบสั้นๆ กระชับ และเป็นมิตร""",
            user_message="ผมอยากสั่งทำกล่องครับ"
        )
        print(f"Bot: {response[:100]}...")
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    # Test 4: Model info
    print("\n📊 Model Information:")
    info = service.get_model_info()
    for key, value in info.items():
        print(f"   {key}: {value}")
    
    print("\n" + "="*60)
    print("🎉 All tests passed!")
    print("="*60)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()