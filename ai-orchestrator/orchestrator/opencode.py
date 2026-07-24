from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional, TYPE_CHECKING

from .config import OrchestratorConfig
from .powershell import PowerShell, PowerShellResult

if TYPE_CHECKING:
    from .logger import Logger


class OpenCode:
    def __init__(
        self,
        config: OrchestratorConfig,
        powershell: PowerShell,
        logger: 'Logger',
    ):
        self.config = config
        self.powershell = powershell
        self.logger = logger
        self.executable = config.opencode_path
        self.task_dir = Path(config.get_task_dir())
        self.task_dir.mkdir(parents=True, exist_ok=True)

    def execute_task(
        self,
        task: str,
        model: Optional[str] = None,
        timeout: int = 600,
    ) -> PowerShellResult:
        task_file = self.task_dir / f'task_{uuid.uuid4().hex[:8]}.md'
        task_file.write_text(task, encoding='utf-8')
        self.logger.info(f'Task written to {task_file}')
        self.logger.info(f'Task size: {len(task)} chars')

        result = self._try_run_with_file(task_file, model, timeout)

        if result.success:
            self.logger.info('OpenCode completed successfully')
        else:
            self.logger.warning(f'OpenCode exit code: {result.exit_code}')

        return result

    def _try_run_with_file(
        self,
        task_file: Path,
        model: Optional[str],
        timeout: int,
    ) -> PowerShellResult:
        model_arg = f'--model {model}' if model else ''
        quoted_exec = f'"{self.executable}"'
        quoted_file = f'"{task_file}"'

        strategy_templates = [
            f'Get-Content {quoted_file} -Raw | & {quoted_exec} {model_arg}',
            f'& {quoted_exec} {model_arg} (Get-Content {quoted_file} -Raw)',
            f'& {quoted_exec} {model_arg} --input {quoted_file}',
        ]

        for strategy in strategy_templates:
            self.logger.debug(f'Trying strategy: {strategy[:100]}...')
            result = self.powershell.run(
                strategy,
                workdir=self.config.project_path,
                timeout=timeout,
            )
            if result.success or 'not found' not in result.stderr.lower():
                return result

        return result

    def is_available(self) -> bool:
        result = self.powershell.run(
            f'Get-Command "{self.executable}" -ErrorAction SilentlyContinue',
            timeout=10,
        )
        return result.success
