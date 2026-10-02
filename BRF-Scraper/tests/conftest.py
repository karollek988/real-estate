"""Test configuration for the BRF annual report extractor.

The extractor tests need no shared fixtures: they build their inputs in memory
(see test_extraction_validation.py) or render them with Pillow/PyMuPDF into
pytest's own tmp_path (see test_ocr_extraction.py).
"""

from __future__ import annotations
