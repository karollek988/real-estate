from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, TYPE_CHECKING

from .config import OrchestratorConfig
from .opencode import OpenCode
from .git_tools import GitTools
from .powershell import PowerShell

if TYPE_CHECKING:
    from .logger import Logger


@dataclass
class ExecutionResult:
    success: bool = False
    output: str = ''
    files_changed: list[str] = field(default_factory=list)
    git_diff: str = ''
    git_diff_stat: str = ''
    error: str = ''
    duration: float = 0.0


class Executor:
    def __init__(
        self,
        config: OrchestratorConfig,
        logger: 'Logger',
        opencode: OpenCode,
        git: GitTools,
        powershell: PowerShell,
    ):
        self.config = config
        self.logger = logger
        self.opencode = opencode
        self.git = git
        self.powershell = powershell
        self.prompt_path = config.project_path / config.prompt_developer

    def _load_prompt(self) -> str:
        path = Path(self.prompt_path)
        if path.exists():
            return path.read_text(encoding='utf-8')
        self.logger.warning(f'Developer prompt not found: {path}, using default')
        return 'You are a senior software engineer. Implement the following task.'

    def execute(
        self,
        task: str,
        plan: str,
        feedback: Optional[str] = None,
    ) -> ExecutionResult:
        start = time.time()
        self.logger.section('Execution Phase')

        prompt = self._load_prompt()

        parts = [prompt, f'\n\n## Plan\n\n{plan}', f'\n\n## Task\n\n{task}']
        if feedback:
            parts.append(
                f'\n\n## Feedback from Previous Review\n\n{feedback}'
                '\n\nAddress all feedback above.'
            )
        full_task = ''.join(parts)

        self.logger.info('Sending task to developer...')
        result = self.opencode.execute_task(full_task, timeout=600)

        duration = time.time() - start

        if result.success:
            self.logger.info('Execution completed, checking changes...')
        else:
            self.logger.warning(f'Execution had issues (exit: {result.exit_code})')

        files = self.git.changed_files()
        diff = self.git.diff()
        diff_stat = self.git.diff_stat()

        if files:
            self.logger.info(f'Files changed: {len(files)}')
            for f in files:
                self.logger.info(f'  - {f}')

        return ExecutionResult(
            success=result.success,
            output=result.stdout,
            files_changed=files,
            git_diff=diff,
            git_diff_stat=diff_stat,
            error=result.stderr if not result.success else '',
            duration=duration,
        )
