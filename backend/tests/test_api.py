"""
Test API Endpoints
ทดสอบ API ด้วย Python requests

รันได้ 2 แบบ:
  1. pytest tests/test_api.py -v        (ผ่าน pytest — ต้องเปิด server ก่อน)
  2. python tests/test_api.py           (ผ่าน main() — ต้องเปิด server ก่อน)
"""

import requests
import json
import pytest

# API Base URL
BASE_URL = "http://localhost:8000"


# ===================================
# Helper: ตรวจว่า server รันอยู่ไหม
# ===================================
def is_server_running():
    """เช็คว่า API server รันอยู่"""
    try:
        requests.get(f"{BASE_URL}/health", timeout=2)
        return True
    except requests.exceptions.ConnectionError:
        return False


# Skip ทั้งไฟล์ถ้า server ไม่ได้รัน
pytestmark = pytest.mark.skipif(
    not is_server_running(),
    reason="API server not running on localhost:8000"
)


# ===================================
# Pytest Fixture: สร้าง session_id
# ===================================
@pytest.fixture(scope="module")
def session_id():
    """
    Fixture: ส่งข้อความแรกเพื่อสร้าง session
    แชร์ session_id ให้ทุก test ในไฟล์นี้
    """
    payload = {"message": "สวัสดีครับ"}
    response = requests.post(f"{BASE_URL}/api/chat/message", json=payload)
    data = response.json()
    assert response.status_code == 200
    assert "session_id" in data
    return data["session_id"]


# ===================================
# Tests
# ===================================

def test_health_check():
    """Test health check endpoint"""
    print("\n" + "="*60)
    print("🧪 Test 1: Health Check")
    print("="*60)

    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

    assert response.status_code == 200
    print("✅ Health check passed!")


def test_chat_message():
    """Test chat message endpoint"""
    print("\n" + "="*60)
    print("🧪 Test 2: Send Chat Message")
    print("="*60)

    payload = {"message": "สวัสดีครับ"}

    response = requests.post(f"{BASE_URL}/api/chat/message", json=payload)
    print(f"Status: {response.status_code}")

    data = response.json()
    print(f"\n📝 Response:")
    print(f"\n📋 Full Response: {data}")
    print(f"  Session ID: {data['session_id']}")
    print(f"  Current Step: {data['current_step']}")
    print(f"  Bot: {data['response'][:100]}...")

    assert response.status_code == 200
    assert "session_id" in data
    assert "response" in data
    assert "current_step" in data
    assert "collected_data" in data
    print("\n✅ Chat message test passed!")


def test_chat_conversation(session_id):
    """Test full conversation (ใช้ session_id จาก fixture)"""
    print("\n" + "="*60)
    print("🧪 Test 3: Full Conversation")
    print("="*60)

    messages = [
        "สินค้าทั่วไป",
        "RSC",
        "ไม่ต้องการ",
        "ขนาด 20x15x10 จำนวน 1000 กล่อง"
    ]

    for i, msg in enumerate(messages, 1):
        print(f"\n📤 Message {i}: {msg}")

        payload = {
            "message": msg,
            "session_id": session_id
        }

        response = requests.post(f"{BASE_URL}/api/chat/message", json=payload)
        assert response.status_code == 200

        data = response.json()
        print(f"📥 Step {data['current_step']}: {data['response'][:80]}...")
        print(f"📊 Collected: {list(data['collected_data'].keys())}")

    print("\n✅ Conversation test passed!")


def test_get_session(session_id):
    """Test get session endpoint (ใช้ session_id จาก fixture)"""
    print("\n" + "="*60)
    print("🧪 Test 4: Get Session")
    print("="*60)

    response = requests.get(f"{BASE_URL}/api/chat/session/{session_id}")
    print(f"Status: {response.status_code}")

    data = response.json()
    print(f"\n📊 Session Info:")
    print(f"  Session ID: {data['session_id']}")
    print(f"  Current Step: {data['current_step']}")
    print(f"  Message Count: {data['message_count']}")
    print(f"  Collected Data: {list(data['collected_data'].keys())}")

    assert response.status_code == 200
    print("\n✅ Get session test passed!")


def test_pricing():
    """Test pricing calculation"""
    print("\n" + "="*60)
    print("🧪 Test 5: Pricing Calculation")
    print("="*60)

    payload = {
        "dimensions": {
            "width": 20,
            "length": 15,
            "height": 10
        },
        "box_type": "rsc",
        "material": "corrugated_2layer",
        "quantity": 1000
    }

    response = requests.post(f"{BASE_URL}/api/pricing/calculate", json=payload)
    print(f"Status: {response.status_code}")

    data = response.json()
    print(f"\n💰 Pricing Result:")
    print(f"  Box Base: {data['box_base']:,.2f} THB")
    print(f"  Subtotal: {data['subtotal']:,.2f} THB")
    print(f"  VAT (7%): {data['vat']:,.2f} THB")
    print(f"  Grand Total: {data['grand_total']:,.2f} THB")
    print(f"  Price per Box: {data['price_per_box']:.2f} THB")

    assert response.status_code == 200
    assert data["box_base"] > 0
    assert data["grand_total"] > data["subtotal"]
    print("\n✅ Pricing test passed!")


def test_list_sessions():
    """Test list sessions endpoint"""
    print("\n" + "="*60)
    print("🧪 Test 6: List Sessions")
    print("="*60)

    response = requests.get(f"{BASE_URL}/api/chat/sessions")
    print(f"Status: {response.status_code}")

    data = response.json()
    print(f"\n📊 Total Sessions: {data['total']}")

    if data["sessions"]:
        print(f"\nRecent sessions:")
        for session in data["sessions"][:3]:
            print(f"  - {session['session_id']}: Step {session['current_step']}, {session['message_count']} messages")

    assert response.status_code == 200
    print("\n✅ List sessions test passed!")


# ===================================
# Manual Runner (backward compatible)
# ===================================

def main():
    """Run all tests sequentially (ใช้เมื่อรัน python test_api.py)"""
    print("="*60)
    print("🚀 LumoPack API Tests")
    print("="*60)
    print("\n⚠️  Make sure the API server is running on http://localhost:8000")
    print("   Run: python main.py\n")

    try:
        # Test 1: Health check
        test_health_check()

        # Test 2: Send message
        test_chat_message()

        # Test 3: Full conversation (สร้าง session ใหม่)
        payload = {"message": "สวัสดีครับ"}
        resp = requests.post(f"{BASE_URL}/api/chat/message", json=payload)
        sid = resp.json()["session_id"]

        test_chat_conversation(sid)

        # Test 4: Get session
        test_get_session(sid)

        # Test 5: Pricing
        test_pricing()

        # Test 6: List sessions
        test_list_sessions()

        # Summary
        print("\n" + "="*60)
        print("🎉 All Tests Passed!")
        print("="*60)

    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Cannot connect to API server")
        print("   Make sure the server is running: python main.py")

    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")

    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()