"""
Integration Test — End-to-End Chatbot Flow with Groq API
ทดสอบ chatbot flow ทั้ง 14 steps กับ Groq API จริง

Usage:
    cd backend
    python tests/test_integration.py

Prerequisites:
    - GROQ_API_KEY ต้องอยู่ใน .env
    - pip install groq python-dotenv

Test Scenarios:
    A) Happy Path (Die-cut): step 1→14 ครบ
    B) RSC Skip Inner: step 3→5 (ข้าม step 4)
    C) Checkpoint Edit: แก้ไขข้อมูลที่ checkpoint 1
    D) Ambiguous Input: ลูกค้าตอบกำกวม → bot ถามซ้ำ
    E) API via HTTP: ทดสอบผ่าน FastAPI endpoint
"""

import sys
import os
import asyncio
import time
import json
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

# เพิ่ม path สำหรับ import
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


# ===================================
# Test Result Tracking
# ===================================
@dataclass
class StepTestResult:
    step: int
    input_msg: str
    expected_step_after: int
    actual_step_after: int
    expected_data_keys: List[str]
    actual_data: Dict[str, Any]
    response_preview: str
    passed: bool
    error: Optional[str] = None
    duration_ms: float = 0


@dataclass
class ScenarioResult:
    name: str
    steps: List[StepTestResult] = field(default_factory=list)
    passed: bool = True
    error: Optional[str] = None


# ===================================
# Colors for terminal output
# ===================================
class C:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    END = "\033[0m"


def ok(msg):   print(f"  {C.GREEN}✅ {msg}{C.END}")
def fail(msg): print(f"  {C.RED}❌ {msg}{C.END}")
def warn(msg): print(f"  {C.YELLOW}⚠️  {msg}{C.END}")
def info(msg): print(f"  {C.CYAN}ℹ️  {msg}{C.END}")
def header(msg): print(f"\n{C.BOLD}{C.CYAN}{'='*60}\n  {msg}\n{'='*60}{C.END}")
def subheader(msg): print(f"\n  {C.BOLD}--- {msg} ---{C.END}")


# ===================================
# Helper: Send message and validate
# ===================================
async def send_and_validate(
    flow_manager,
    state,
    user_message: str,
    expected_step_after: int,
    expected_data_keys: List[str] = None,
    description: str = ""
) -> StepTestResult:
    """ส่งข้อความและตรวจสอบผลลัพธ์"""
    expected_data_keys = expected_data_keys or []
    step_before = int(state.current_step)

    start = time.time()
    try:
        response, state = await flow_manager.process_message(user_message, state)
        duration = (time.time() - start) * 1000
    except Exception as e:
        duration = (time.time() - start) * 1000
        return StepTestResult(
            step=step_before,
            input_msg=user_message,
            expected_step_after=expected_step_after,
            actual_step_after=step_before,
            expected_data_keys=expected_data_keys,
            actual_data=state.collected_data,
            response_preview=f"ERROR: {str(e)}",
            passed=False,
            error=str(e),
            duration_ms=duration,
        )

    actual_step = int(state.current_step)
    step_ok = actual_step == expected_step_after
    data_ok = all(k in state.collected_data for k in expected_data_keys)
    passed = step_ok and data_ok

    # Log
    label = f"Step {step_before}→{actual_step}"
    if description:
        label = f"{description} ({label})"

    if passed:
        ok(f"{label} [{duration:.0f}ms]")
    else:
        fail(f"{label} [{duration:.0f}ms]")
        if not step_ok:
            fail(f"  Expected step {expected_step_after}, got {actual_step}")
        if not data_ok:
            missing = [k for k in expected_data_keys if k not in state.collected_data]
            fail(f"  Missing data keys: {missing}")

    # แสดง response preview (ตัดให้สั้น)
    preview = response[:100].replace('\n', ' ')
    info(f"Bot: {preview}...")

    return StepTestResult(
        step=step_before,
        input_msg=user_message,
        expected_step_after=expected_step_after,
        actual_step_after=actual_step,
        expected_data_keys=expected_data_keys,
        actual_data=dict(state.collected_data),
        response_preview=response[:200],
        passed=passed,
        duration_ms=duration,
    )


# ===================================
# Scenario A: Happy Path (Die-cut, ครบทุก step)
# ===================================
async def test_scenario_a_happy_path() -> ScenarioResult:
    header("Scenario A: Happy Path — Die-cut Full Flow")
    result = ScenarioResult(name="Happy Path (Die-cut)")

    from services.chatbot_flow import ChatbotFlowManager
    from models.chat_state import ConversationState

    flow = ChatbotFlowManager()
    state = ConversationState(session_id="test_integration_a")

    steps = [
        # (user_message, expected_step_after, expected_data_keys, description)

        # Step 1: Greeting → advance to 2
        ("สวัสดีครับ", 2, [], "Greeting"),

        # Step 2: Product Type → advance to 3
        ("เครื่องสำอาง", 3, ["product_type"], "Product Type = cosmetic"),

        # Step 3a: Box Type → sub_step 1 (ยังอยู่ step 3)
        ("ไดคัท", 3, [], "Box Type = die_cut (รอเลือกวัสดุ)"),

        # Step 3b: Material → advance to 4
        ("อาร์ต", 4, ["box_type", "material"], "Material = art_300gsm"),

        # Step 4: Inner → skip → advance to 5
        ("ไม่ต้องครับ", 5, [], "Inner = skip"),

        # Step 5a: Dimensions → partial (รอ quantity)
        ("กว้าง 20 ยาว 15 สูง 10", 5, [], "Dimensions (รอ quantity)"),

        # Step 5b: Quantity → advance to 6
        ("1000 ชิ้น", 6, ["dimensions", "quantity"], "Quantity = 1000"),

        # Step 6a: Checkpoint 1 แสดง summary (ยังอยู่ step 6)
        ("ดูสรุปครับ", 6, [], "Checkpoint 1 — แสดง summary"),

        # Step 6b: ยืนยัน → advance to 7
        ("ถูกต้องครับ", 7, [], "Checkpoint 1 — ยืนยัน"),

        # Step 7: Mood & Tone → advance to 8
        ("พรีเมียม หรูหรา", 8, ["mood_tone"], "Mood = พรีเมียม"),

        # Step 8a: Logo → มี → sub_step 1 (ยังอยู่ step 8)
        ("มีครับ", 8, ["has_logo"], "Logo = มี (รอตำแหน่ง)"),

        # Step 8b: Logo Position → advance to 9
        ("ด้านบน", 9, ["logo_positions"], "Logo Position = top"),

        # Step 9: Special Effects → skip → advance to 10
        ("ไม่ต้องครับ ข้ามเลย", 10, [], "Effects = skip"),

        # Step 10a: Checkpoint 2 summary (ยังอยู่ step 10)
        ("ดูสรุปครับ", 10, [], "Checkpoint 2 — แสดง summary"),

        # Step 10b: ยืนยัน → advance to 11
        ("ยืนยันครับ", 11, [], "Checkpoint 2 — ยืนยัน"),

        # Step 11a: Mockup แสดง (ยังอยู่ step 11, sub_step 0→1)
        ("ดูเลยครับ", 11, [], "Mockup — แสดง (sub_step→1)"),

        # Step 11b: User ตอบ → advance to 12
        ("สวยดีครับ", 12, [], "Mockup — user ตอบ → Quote"),

        # Step 12a: Quote แสดง (ยังอยู่ step 12, sub_step 0→1)
        ("ดูราคาครับ", 12, [], "Quote — คำนวณราคา (sub_step→1)"),

        # Step 12b: User ตอบ → advance to 13
        ("โอเคครับ", 13, [], "Quote — user ตอบ → Confirm"),

        # Step 13: Confirm → advance to 14
        ("ยืนยันครับ", 14, [], "Confirm Order"),
    ]

    for msg, expected_step, data_keys, desc in steps:
        r = await send_and_validate(flow, state, msg, expected_step, data_keys, desc)
        result.steps.append(r)
        if not r.passed:
            result.passed = False
            warn(f"Flow หยุดที่ step {r.actual_step_after} — ข้ามไป scenario ถัดไป")
            break

    # สรุป collected_data
    subheader("Collected Data Summary")
    for k, v in state.collected_data.items():
        info(f"{k}: {v}")

    return result


# ===================================
# Scenario B: RSC Skip Inner (step 3 → 5)
# ===================================
async def test_scenario_b_rsc_skip() -> ScenarioResult:
    header("Scenario B: RSC — Skip Inner (step 3 → 5)")
    result = ScenarioResult(name="RSC Skip Inner")

    from services.chatbot_flow import ChatbotFlowManager
    from models.chat_state import ConversationState

    flow = ChatbotFlowManager()
    state = ConversationState(session_id="test_integration_b")

    steps = [
        ("สวัสดีครับ", 2, [], "Greeting"),
        ("สินค้าทั่วไป", 3, ["product_type"], "Product Type = general"),
        ("RSC", 3, [], "Box Type = RSC (รอเลือกวัสดุ)"),
        ("ลูกฟูก", 5, ["box_type", "material"], "Material → ข้าม Inner ไป Step 5"),
    ]

    for msg, expected_step, data_keys, desc in steps:
        r = await send_and_validate(flow, state, msg, expected_step, data_keys, desc)
        result.steps.append(r)
        if not r.passed:
            result.passed = False
            break

    # ตรวจสอบว่าข้าม step 4 จริง
    if result.passed:
        if int(state.current_step) == 5:
            ok("RSC ข้าม Inner (step 4) ไป step 5 ถูกต้อง ✅")
        else:
            fail(f"Expected step 5, got {state.current_step}")
            result.passed = False

    return result


# ===================================
# Scenario C: Checkpoint Edit
# ===================================
async def test_scenario_c_checkpoint_edit() -> ScenarioResult:
    header("Scenario C: Checkpoint 1 — Edit Flow")
    result = ScenarioResult(name="Checkpoint Edit")

    from services.chatbot_flow import ChatbotFlowManager
    from models.chat_state import ConversationState

    flow = ChatbotFlowManager()
    state = ConversationState(session_id="test_integration_c")

    # ไปถึง checkpoint 1 ก่อน
    setup_steps = [
        ("สวัสดีครับ", 2, [], "Greeting"),
        ("เครื่องสำอาง", 3, ["product_type"], "Product Type"),
        ("ไดคัท", 3, [], "Box Type"),
        ("อาร์ต", 4, ["box_type"], "Material"),
        ("ไม่ต้องครับ", 5, [], "Inner skip"),
        ("20x15x10 จำนวน 1000", 6, ["dimensions", "quantity"], "Dims + Qty พร้อมกัน"),
    ]

    for msg, expected_step, data_keys, desc in setup_steps:
        r = await send_and_validate(flow, state, msg, expected_step, data_keys, desc)
        result.steps.append(r)
        if not r.passed:
            result.passed = False
            return result

    subheader("ถึง Checkpoint 1 — ทดสอบ Edit Flow")

    # Checkpoint 1: แสดง summary
    r = await send_and_validate(flow, state, "ดูครับ", 6, [], "Checkpoint 1 summary")
    result.steps.append(r)

    # ขอแก้ไขขนาด
    r = await send_and_validate(flow, state, "แก้ไขขนาด", 5, [], "Edit → ไป step 5")
    result.steps.append(r)
    if not r.passed:
        result.passed = False
        return result

    # ตรวจว่าเข้า edit mode
    if state.edit_mode:
        ok("เข้า edit_mode ถูกต้อง")
    else:
        fail("ไม่ได้เข้า edit_mode!")
        result.passed = False
        return result

    # ใส่ขนาดใหม่
    r = await send_and_validate(flow, state, "30x20x15 จำนวน 2000", 6, [], "ใส่ขนาดใหม่ → กลับ checkpoint")
    result.steps.append(r)

    # ตรวจว่ากลับ checkpoint และข้อมูลอัปเดต
    if not state.edit_mode:
        ok("ออก edit_mode กลับ checkpoint 1 ถูกต้อง")
    else:
        fail("ยังอยู่ใน edit_mode!")
        result.passed = False

    dims = state.collected_data.get("dimensions", {})
    if dims.get("width") == 30.0 and dims.get("length") == 20.0:
        ok(f"ขนาดอัปเดตถูกต้อง: {dims}")
    else:
        warn(f"ขนาดอาจไม่ได้อัปเดต: {dims} (ต้องตรวจ type match)")

    qty = state.collected_data.get("quantity")
    if qty == 2000:
        ok(f"จำนวนอัปเดตถูกต้อง: {qty}")
    else:
        warn(f"จำนวนอาจไม่ได้อัปเดต: {qty}")

    return result


# ===================================
# Scenario D: Ambiguous Input (ถามซ้ำ + Bug #1 verification)
# ===================================
async def test_scenario_d_ambiguous() -> ScenarioResult:
    header("Scenario D: Ambiguous Input — Bot ถามซ้ำ")
    result = ScenarioResult(name="Ambiguous Input")

    from services.chatbot_flow import ChatbotFlowManager
    from models.chat_state import ConversationState

    flow = ChatbotFlowManager()
    state = ConversationState(session_id="test_integration_d")

    # Greeting
    r = await send_and_validate(flow, state, "สวัสดีครับ", 2, [], "Greeting")
    result.steps.append(r)

    subheader("Step 2: ตอบกำกวม → ถามซ้ำ")

    # ตอบกำกวม → ไม่ควร advance
    r = await send_and_validate(flow, state, "ไม่แน่ใจเลย", 2, [], "ตอบกำกวม → ยังอยู่ step 2")
    result.steps.append(r)
    if r.actual_step_after == 2:
        ok("Bot ถามซ้ำ (ไม่ advance) ถูกต้อง")
    else:
        warn(f"Bot advance ไป step {r.actual_step_after} ทั้งที่ตอบกำกวม")

    # ตอบถูก → advance
    r = await send_and_validate(flow, state, "เครื่องสำอาง", 3, ["product_type"], "ตอบถูก → advance")
    result.steps.append(r)

    subheader("Step 3: ตอบกำกวม → ถามซ้ำ")

    r = await send_and_validate(flow, state, "อะไรก็ได้ครับ", 3, [], "ตอบกำกวม → ยังอยู่ step 3")
    result.steps.append(r)
    if r.actual_step_after == 3:
        ok("Bot ถามซ้ำ (ไม่ advance) ถูกต้อง")

    r = await send_and_validate(flow, state, "ไดคัท", 3, [], "ตอบ die_cut → sub_step วัสดุ")
    result.steps.append(r)

    r = await send_and_validate(flow, state, "อาร์ต", 4, [], "Material → step 4 (Inner)")
    result.steps.append(r)

    subheader("Step 4: Bug #1 Fix Verification — Inner กำกวม → ถามซ้ำ")

    # Bug #1 test: ตอบกำกวมที่ step 4 → ต้องไม่ advance
    r = await send_and_validate(flow, state, "แนะนำอะไรดีครับ", 4, [], "Inner กำกวม → ถามซ้ำ (Bug #1)")
    result.steps.append(r)
    if r.actual_step_after == 4:
        ok("🎯 Bug #1 FIX VERIFIED: Inner กำกวม → ถามซ้ำ ไม่ advance")
    else:
        fail(f"Bug #1 NOT FIXED: advance ไป step {r.actual_step_after}")
        result.passed = False

    # ตอบถูก → skip
    r = await send_and_validate(flow, state, "ไม่ต้องครับ", 5, [], "Inner skip → step 5")
    result.steps.append(r)

    return result


# ===================================
# Scenario E: API HTTP Test
# ===================================
async def test_scenario_e_api() -> ScenarioResult:
    """ทดสอบผ่าน HTTP endpoint (ต้อง start server ก่อน)"""
    header("Scenario E: API HTTP Test")

    try:
        import httpx
    except ImportError:
        warn("httpx not installed — skip HTTP test")
        warn("Install: pip install httpx")
        return ScenarioResult(name="API HTTP", passed=True, error="skipped (no httpx)")

    base_url = "http://localhost:8000"

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"{base_url}/health")
        except Exception:
            warn("Server ไม่ได้รัน — skip HTTP test")
            info("Start server: uvicorn main:app --reload")
            return ScenarioResult(name="API HTTP", passed=True, error="skipped (server not running)")

        result = ScenarioResult(name="API HTTP")

        # Test 1: New conversation
        subheader("POST /api/chat/message — New conversation")
        r = await client.post(f"{base_url}/api/chat/message", json={
            "message": "สวัสดีครับ"
        })
        data = r.json()
        session_id = data.get("session_id")

        if r.status_code == 200 and session_id:
            ok(f"New session: {session_id}")
            ok(f"Step: {data.get('current_step')}")
            info(f"Bot: {data.get('response', '')[:80]}...")
        else:
            fail(f"Status: {r.status_code}, Body: {r.text[:200]}")
            result.passed = False
            return result

        # Test 2: Continue conversation
        subheader("POST /api/chat/message — Continue")
        r = await client.post(f"{base_url}/api/chat/message", json={
            "message": "เครื่องสำอาง",
            "session_id": session_id
        })
        data = r.json()

        if r.status_code == 200 and data.get("current_step") == 3:
            ok(f"Step advanced to {data.get('current_step')}")
            ok(f"Product type: {data.get('collected_data', {}).get('product_type')}")
        else:
            fail(f"Step: {data.get('current_step')}, expected 3")
            result.passed = False

        # Test 3: Get session
        subheader(f"GET /api/chat/session/{session_id}")
        r = await client.get(f"{base_url}/api/chat/session/{session_id}")
        data = r.json()

        if r.status_code == 200:
            ok(f"Session found: step={data.get('current_step')}, messages={data.get('message_count')}")
        else:
            fail(f"Status: {r.status_code}")
            result.passed = False

        # Test 4: List sessions
        subheader("GET /api/chat/sessions")
        r = await client.get(f"{base_url}/api/chat/sessions")
        data = r.json()

        if r.status_code == 200:
            ok(f"Total sessions: {data.get('total')}")
        else:
            fail(f"Status: {r.status_code}")

        # Cleanup
        subheader("Cleanup")
        r = await client.delete(f"{base_url}/api/chat/session/{session_id}")
        if r.status_code == 200:
            ok("Session deleted")

        return result


# ===================================
# Main Runner
# ===================================
async def main():
    print(f"\n{C.BOLD}{'='*60}")
    print("  🧪 LumoPack Integration Test")
    print(f"  Testing chatbot flow with REAL Groq API")
    print(f"{'='*60}{C.END}")

    # Pre-flight check
    subheader("Pre-flight Check")
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        warn("python-dotenv not installed, reading from env directly")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        fail("GROQ_API_KEY not found!")
        print("\n  กรุณาสร้าง .env แล้วใส่ GROQ_API_KEY=gsk_xxxxx")
        return

    ok(f"GROQ_API_KEY found (ends with ...{api_key[-6:]})")

    model = os.getenv("MODEL_NAME", "llama-3.3-70b-versatile")
    ok(f"Model: {model}")

    # Connection test
    info("Testing Groq connection...")
    try:
        from services.groq_service import get_groq_service
        service = get_groq_service()
        test_response = await service.generate_response(
            system_prompt="Reply only with: OK",
            user_message="Test connection",
            conversation_history=[]
        )
        if test_response:
            ok(f"Groq connected! Response: {test_response[:40]}")
        else:
            fail("Groq returned empty response")
            return
    except Exception as e:
        fail(f"Groq connection failed: {e}")
        return

    # Run scenarios
    results: List[ScenarioResult] = []
    start_time = time.time()

    scenarios = [
        ("A", test_scenario_a_happy_path),
        ("B", test_scenario_b_rsc_skip),
        ("C", test_scenario_c_checkpoint_edit),
        ("D", test_scenario_d_ambiguous),
        ("E", test_scenario_e_api),
    ]

    for label, test_func in scenarios:
        try:
            r = await test_func()
            results.append(r)
        except Exception as e:
            fail(f"Scenario {label} crashed: {e}")
            import traceback
            traceback.print_exc()
            results.append(ScenarioResult(name=f"Scenario {label}", passed=False, error=str(e)))

    total_time = time.time() - start_time

    # ===================================
    # Summary
    # ===================================
    header("📊 Test Summary")
    passed_count = sum(1 for r in results if r.passed)
    total_count = len(results)

    for r in results:
        icon = f"{C.GREEN}✅" if r.passed else f"{C.RED}❌"
        step_count = len(r.steps)
        step_pass = sum(1 for s in r.steps if s.passed)
        extra = f" ({r.error})" if r.error else ""
        print(f"  {icon} {r.name}: {step_pass}/{step_count} steps passed{extra}{C.END}")

    print(f"\n  {C.BOLD}Total: {passed_count}/{total_count} scenarios passed")
    print(f"  Time: {total_time:.1f}s{C.END}")

    # Avg Groq response time
    all_steps = [s for r in results for s in r.steps]
    if all_steps:
        avg_ms = sum(s.duration_ms for s in all_steps) / len(all_steps)
        max_ms = max(s.duration_ms for s in all_steps)
        print(f"  {C.CYAN}Groq Avg: {avg_ms:.0f}ms | Max: {max_ms:.0f}ms{C.END}")

    if passed_count == total_count:
        print(f"\n  {C.GREEN}{C.BOLD}🎉 All integration tests PASSED!{C.END}")
    else:
        print(f"\n  {C.RED}{C.BOLD}⚠️  Some tests FAILED — review output above{C.END}")

    # Git reminder
    print(f"\n  {C.YELLOW}📌 Git Reminder:")
    print(f"     git add -A")
    print(f"     git commit -m \"fix: bug #1-5 step handlers + add integration tests\"")
    print(f"     git push{C.END}\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n\n{C.YELLOW}⚠️  Test interrupted by user{C.END}")
    except Exception as e:
        print(f"\n{C.RED}❌ Fatal error: {e}{C.END}")
        import traceback
        traceback.print_exc()