#!/usr/bin/env python
"""Development setup script."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run_command(command: list[str], check: bool = True) -> None:
    """Run a shell command."""
    print(f"Running: {' '.join(command)}")
    subprocess.run(command, check=check)


def main() -> None:
    """Run development setup."""
    project_root = Path(__file__).parent.parent

    print("Setting up BRF Scraper development environment...")

    # Install dependencies
    run_command(["uv", "sync"], cwd=project_root)

    # Install pre-commit hooks
    run_command(["uv", "run", "pre-commit", "install"], cwd=project_root)

    # Create .env from example if it doesn't exist
    env_file = project_root / ".env"
    env_example = project_root / ".env.example"
    if not env_file.exists() and env_example.exists():
        print("Creating .env from .env.example...")
        env_file.write_text(env_example.read_text())

    # Create data directories
    (project_root / "data" / "pdfs").mkdir(parents=True, exist_ok=True)
    (project_root / "data" / "exports").mkdir(parents=True, exist_ok=True)

    print("\nDevelopment setup complete!")
    print("\nNext steps:")
    print("  1. Edit .env with your settings")
    print("  2. Run 'make test' to verify installation")
    print("  3. Run 'make run-dev' to start development")


if __name__ == "__main__":
    main()
