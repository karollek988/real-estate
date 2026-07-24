"""Root conftest — suppresses Windows PermissionError on pytest temp cleanup."""

from __future__ import annotations

import sys


def pytest_configure(config: object) -> None:
    """Patch pytest's symlink cleanup on Windows to suppress PermissionError."""
    if sys.platform != "win32":
        return

    import _pytest.pathlib

    _original = _pytest.pathlib.cleanup_dead_symlinks

    def _safe_cleanup_dead_symlinks(root: object) -> None:
        try:
            _original(root)
        except PermissionError:
            pass

    _pytest.pathlib.cleanup_dead_symlinks = _safe_cleanup_dead_symlinks  # type: ignore[assignment]
