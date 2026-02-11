"""
Pytest Configuration
Add project root to sys.path so tests can import modules properly
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))