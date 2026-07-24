from __future__ import annotations

from pathlib import Path
from typing import Optional, TYPE_CHECKING

from .config import OrchestratorConfig
from .opencode import OpenCode

if TYPE_CHECKING:
    from .logger import Logger


class Planner:
    def __init__(
        self,
        config: OrchestratorConfig,
        logger: 'Logger',
        opencode: OpenCode,
    ):
        self.config = config
        self.logger = logger
        self.opencode = opencode
        self.prompt_path = config.project_path / config.prompt_planner

    def _load_prompt(self) -> str:
        path = Path(self.prompt_path)
        if path.exists():
            return path.read_text(encoding='utf-8')
        self.logger.warning(f'Planner prompt not found: {path}, using default')
        return (
            'You are a technical planner. Create a detailed implementation plan '
            'with step-by-step instructions, file list, and design decisions.'
        )

    def create_plan(self, task: str, context: Optional[str] = None) -> str:
        self.logger.section('Planning Phase')
        self.logger.info('Creating implementation plan...')

        prompt = self._load_prompt()
        full_task = f'{prompt}\n\n## Task\n\n{task}'
        if context:
            full_task += f'\n\n## Context\n\n{context}'

        result = self.opencode.execute_task(full_task, timeout=300)

        if result.success and result.stdout:
            plan = result.stdout.strip()
            self.logger.info(f'Plan created ({len(plan)} chars)')
            return plan

        self.logger.warning('Failed to create plan via OpenCode, using fallback')
        return f'## Plan\n\nImplement the following task:\n\n{task}'
