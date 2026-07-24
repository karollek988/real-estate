from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

import yaml


class ModelConfig:
    def __init__(self, name: str, data: dict[str, Any]):
        self.name = name
        self.provider: str = data.get('provider', 'opencode')
        self.model: str = data.get('model', 'deepseek-chat')
        self.role: str = data.get('role', 'developer')
        self.api_key_env: Optional[str] = data.get('api_key_env')

    @property
    def api_key(self) -> Optional[str]:
        if self.api_key_env:
            return os.environ.get(self.api_key_env)
        return None


class CheckConfig:
    def __init__(self, data: dict[str, Any]):
        self.enabled: bool = data.get('enabled', True)
        self.command: str = data.get('command', '')

    @classmethod
    def from_dict(cls, data: Optional[dict[str, Any]]) -> 'CheckConfig':
        return cls(data or {'enabled': False, 'command': ''})


class OrchestratorConfig:
    def __init__(self, path: str):
        self._path = Path(path)
        if not self._path.exists():
            raise FileNotFoundError(f"Config file not found: {path}")

        with open(self._path, encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}

        self.project_path: Path = Path(data.get('project_path', '.')).resolve()

        wf = data.get('workflow', {})
        self.max_iterations: int = wf.get('max_iterations', 10)
        self.opencode_path: str = wf.get('opencode_path', 'opencode')
        self.state_dir: str = wf.get('state_dir', '.orchestrator')
        self.log_dir: str = wf.get('log_dir', '.orchestrator/logs')

        checks = data.get('checks', {})
        self.check_lint: CheckConfig = CheckConfig.from_dict(checks.get('lint'))
        self.check_build: CheckConfig = CheckConfig.from_dict(checks.get('build'))
        self.check_test: CheckConfig = CheckConfig.from_dict(checks.get('test'))

        self.models: dict[str, ModelConfig] = {}
        for name, cfg in data.get('models', {}).items():
            self.models[name] = ModelConfig(name, cfg)

        prompts = data.get('prompts', {})
        self.prompt_developer: str = prompts.get('developer', 'prompts/developer.md')
        self.prompt_reviewer: str = prompts.get('reviewer', 'prompts/reviewer.md')
        self.prompt_planner: str = prompts.get('planner', 'prompts/planner.md')

    def get_state_file(self) -> Path:
        return self.project_path / self.state_dir / 'state.json'

    def get_log_file(self, name: str = 'orchestrator.log') -> Path:
        return self.project_path / self.log_dir / name

    def get_task_dir(self) -> Path:
        return self.project_path / self.state_dir / 'tasks'
