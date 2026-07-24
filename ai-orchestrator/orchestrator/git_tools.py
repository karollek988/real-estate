from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from .powershell import PowerShell

if TYPE_CHECKING:
    from .logger import Logger


class GitTools:
    def __init__(
        self,
        powershell: PowerShell,
        project_path: Path,
        logger: 'Logger',
    ):
        self.powershell = powershell
        self.project_path = project_path
        self.logger = logger

    def diff(self) -> str:
        result = self.powershell.run(
            'git diff',
            workdir=self.project_path,
            timeout=30,
        )
        return result.stdout

    def diff_stat(self) -> str:
        result = self.powershell.run(
            'git diff --stat',
            workdir=self.project_path,
            timeout=30,
        )
        return result.stdout

    def status(self) -> str:
        result = self.powershell.run(
            'git status',
            workdir=self.project_path,
            timeout=30,
        )
        return result.stdout

    def changed_files(self) -> list[str]:
        result = self.powershell.run(
            'git diff --name-only',
            workdir=self.project_path,
            timeout=30,
        )
        if result.success and result.stdout:
            return [f.strip() for f in result.stdout.split('\n') if f.strip()]
        return []

    def log(self, count: int = 5) -> str:
        result = self.powershell.run(
            f'git log --oneline -{count}',
            workdir=self.project_path,
            timeout=30,
        )
        return result.stdout

    def has_changes(self) -> bool:
        result = self.powershell.run(
            'git status --porcelain',
            workdir=self.project_path,
            timeout=15,
        )
        return result.success and bool(result.stdout.strip())

    def stash(self) -> bool:
        result = self.powershell.run(
            'git stash push -m "orchestrator-auto-stash"',
            workdir=self.project_path,
            timeout=30,
        )
        return result.success

    def stash_pop(self) -> bool:
        result = self.powershell.run(
            'git stash pop',
            workdir=self.project_path,
            timeout=30,
        )
        return result.success
