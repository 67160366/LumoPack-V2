"""
Test Chatbot Flow
ทดสอบ chatbot_flow.py แบบง่ายๆ
"""

import sys
import os
import asyncio
import uuid
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from models.chat_state import ConversationState, ChatbotStep
from services.chatbot_flow import ChatbotFlowManager


@pytest.mark.asyncio
async def test_chatbot_flow():
    """ทดสอบ chatbot flow แบบ simulation"""
    
    print("="*60)
    print("🤖 Testing Chatbot Flow")
    print("="*60)
    
    # สร้าง session
    session_id = f"test_{uuid.uuid4().hex[:8]}"
    state = ConversationState(session_id=session_id)
    
    # สร้าง flow manager
    flow_manager = ChatbotFlowManager()
    
    print(f"\n📝 Session ID: {session_id}")
    print(f"📍 Starting at step: {state.current_step.name}\n")
    
    # Simulation: ลูกค้าเริ่มต้น
    print("="*60)
    print("Step 1: GREETING")
    print("="*60)
    
    # ขั้นที่ 1: ทักทาย
    bot_response, state = await flow_manager.process_message(
        user_message="สวัสดีครับ",
        state=state
    )
    
    print(f"🤖 Bot: {bot_response[:200]}...")
    print(f"📍 Next step: {state.current_step.name}\n")
    
    # ขั้นที่ 2: ประเภทสินค้า
    print("="*60)
    print("Step 2: COLLECT_PRODUCT_TYPE")
    print("="*60)
    
    bot_response, state = await flow_manager.process_message(
        user_message="สินค้าทั่วไป",
        state=state
    )
    
    print(f"👤 User: สินค้าทั่วไป")
    print(f"🤖 Bot: {bot_response[:200]}...")
    print(f"📊 Collected: product_type = {state.collected_data.get('product_type')}")
    print(f"📍 Next step: {state.current_step.name}\n")
    
    # ขั้นที่ 3: ประเภทกล่อง
    print("="*60)
    print("Step 3: COLLECT_BOX_TYPE")
    print("="*60)
    
    bot_response, state = await flow_manager.process_message(
        user_message="RSC",
        state=state
    )
    
    print(f"👤 User: RSC")
    print(f"🤖 Bot: {bot_response[:200]}...")
    print(f"📊 Collected: box_type = {state.collected_data.get('box_type')}")
    print(f"📍 Next step: {state.current_step.name}\n")
    
    # ขั้นที่ 4: Inner (ข้าม)
    print("="*60)
    print("Step 4: COLLECT_INNER (Optional)")
    print("="*60)
    
    bot_response, state = await flow_manager.process_message(
        user_message="ไม่ต้องการ",
        state=state
    )
    
    print(f"👤 User: ไม่ต้องการ")
    print(f"🤖 Bot: {bot_response[:200]}...")
    print(f"📍 Next step: {state.current_step.name}\n")
    
    # ขั้นที่ 5: ขนาด + จำนวน
    print("="*60)
    print("Step 5: COLLECT_DIMENSIONS")
    print("="*60)
    
    bot_response, state = await flow_manager.process_message(
        user_message="ขนาด 20x15x10 cm จำนวน 1000 กล่อง",
        state=state
    )
    
    print(f"👤 User: ขนาด 20x15x10 cm จำนวน 1000 กล่อง")
    print(f"🤖 Bot: {bot_response[:200]}...")
    print(f"📊 Collected: dimensions = {state.collected_data.get('dimensions')}")
    print(f"📊 Collected: quantity = {state.collected_data.get('quantity')}")
    print(f"📍 Next step: {state.current_step.name}\n")
    
    # สรุปข้อมูลที่เก็บได้
    print("="*60)
    print("📋 SUMMARY - Collected Data")
    print("="*60)
    for key, value in state.collected_data.items():
        print(f"  • {key}: {value}")
    
    print("\n" + "="*60)
    print("✅ Chatbot Flow Test Completed!")
    print("="*60)
    print(f"\n💡 Total messages: {len(state.messages)}")
    print(f"📍 Current step: {state.current_step.name}")
    print(f"📊 Data collected: {len(state.collected_data)} fields")


if __name__ == "__main__":
    try:
        asyncio.run(test_chatbot_flow())
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()