from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .logger import Logger


@dataclass
class PowerShellResult:
    stdout: str = ''
    stderr: str = ''
    exit_code: int = 0
    success: bool = True
    duration: float = 0.0


class PowerShell:
    def __init__(self, logger: Optional['Logger'] = None):
        self._logger = logger

    def run(
        self,
        command: str,
        workdir: Optional[Path] = None,
        timeout: int = 300,
        capture_output: bool = True,
    ) -> PowerShellResult:
        start = time.time()
        cwd = str(workdir) if workdir else None

        preview = command[:200] + '...' if len(command) > 200 else command
        self._log('debug', f'PowerShell: {preview}')

        try:
            result = subprocess.run(
                [
                    'powershell',
                    '-NoProfile',
                    '-NonInteractive',
                    '-Command',
                    command,
                ],
                cwd=cwd,
                capture_output=capture_output,
                text=True,
                encoding='utf-8',
                timeout=timeout,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )

            duration = time.time() - start
            stdout = result.stdout.strip() if result.stdout else ''
            stderr = result.stderr.strip() if result.stderr else ''

            return PowerShellResult(
                stdout=stdout,
                stderr=stderr,
                exit_code=result.returncode,
                success=result.returncode == 0,
                duration=duration,
            )

        except subprocess.TimeoutExpired:
            duration = time.time() - start
            self._log('error', f'Command timed out after {timeout}s: {command[:100]}')
            return PowerShellResult(
                stderr=f'Command timed out after {timeout} seconds',
                exit_code=-1,
                success=False,
                duration=duration,
            )
        except Exception as e:
            duration = time.time() - start
            self._log('error', f'Execution failed: {e}')
            return PowerShellResult(
                stderr=str(e),
                exit_code=-1,
                success=False,
                duration=duration,
            )

    def _log(self, level: str, msg: str):
        if self._logger:
            getattr(self._logger, level)(msg)
