#!/bin/bash
# =============================================
# LumoPack Test Runner
# วิธีใช้: cd backend && bash tests/run_tests.sh
# =============================================

set -e

echo "🧪 LumoPack Unit Tests"
echo "======================"

# Check dependencies
python3 -c "import pydantic" 2>/dev/null || {
    echo "❌ pydantic not found. Run: pip install pydantic"
    exit 1
}

python3 -c "import pytest" 2>/dev/null || {
    echo "⚠️  pytest not found. Installing..."
    pip install pytest -q
}

echo ""
echo "📁 Running from: $(pwd)"
echo "📋 Test files:"
echo "   - test_data_extractor.py (16 extraction functions)"
echo "   - test_requirement.py    (from_collected_data + to_pricing_request)"
echo "   - test_chat_state.py     (edit mode, partial data, navigation)"
echo ""

# Run tests with verbose output
python3 -m pytest tests/ -v --tb=short -x 2>&1

echo ""
echo "✅ All tests completed!"