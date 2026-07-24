"""Puts analysis_engine's flat sys.path-import modules on the path for tests.

analysis_engine (calculator.py/reasoning.py/report.py/narrator/) isn't a
packaged module - run.py and compare_narration.py already rely on being
invoked with analysis_engine as the working directory. Tests do the same
via sys.path instead, so they can be run from anywhere.
"""

from __future__ import annotations

import sys
from pathlib import Path

_ANALYSIS_ENGINE_DIR = Path(__file__).resolve().parent.parent
if str(_ANALYSIS_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ANALYSIS_ENGINE_DIR))
