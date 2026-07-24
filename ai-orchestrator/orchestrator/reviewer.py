from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from .config import OrchestratorConfig

if TYPE_CHECKING:
    from .logger import Logger


@dataclass
class ReviewResult:
    status: str = 'APPROVED'
    feedback: str = ''
    raw_response: str = ''
    error: str = ''


class Reviewer:
    def __init__(
        self,
        config: OrchestratorConfig,
        logger: 'Logger',
    ):
        self.config = config
        self.logger = logger
        self.model_config = config.models.get('reviewer')

    def review(self, report: str) -> ReviewResult:
        self.logger.section('Review Phase')
        self.logger.info('Sending report for review...')

        if not self.model_config:
            self.logger.warning('No reviewer model configured, auto-approving')
            return ReviewResult(
                status='APPROVED',
                feedback='Auto-approved (no reviewer configured in models)',
            )

        if self.model_config.provider == 'claude':
            return self._review_with_claude(report)

        if self.model_config.provider == 'opencode':
            return self._review_with_opencode(report)

        self.logger.warning(
            f'Unknown reviewer provider: {self.model_config.provider}, auto-approving'
        )
        return ReviewResult(
            status='APPROVED',
            feedback=f'Auto-approved (unknown provider: {self.model_config.provider})',
        )

    def _review_with_claude(self, report: str) -> ReviewResult:
        api_key = self.model_config.api_key
        if not api_key:
            self.logger.error(
                f'Claude API key not found in env: {self.model_config.api_key_env}'
            )
            return ReviewResult(
                status='APPROVED',
                feedback='Auto-approved (Claude API key not configured)',
                error='API key not found',
            )

        try:
            import anthropic
        except ImportError:
            self.logger.error(
                'anthropic package not installed. Run: pip install anthropic'
            )
            return ReviewResult(
                status='APPROVED',
                feedback='Auto-approved (anthropic package not available)',
                error='anthropic package not installed',
            )

        prompt_path = self.config.project_path / self.config.prompt_reviewer
        system_prompt = (
            'You are a senior code reviewer. Review the following work and respond '
            'with either APPROVED or CHANGES_REQUESTED followed by your reasoning.'
        )
        if prompt_path.exists():
            system_prompt = prompt_path.read_text(encoding='utf-8')

        try:
            client = anthropic.Anthropic(api_key=api_key)
            self.logger.info(f'Calling Claude API ({self.model_config.model})...')

            response = client.messages.create(
                model=self.model_config.model,
                max_tokens=4000,
                system=system_prompt,
                messages=[{'role': 'user', 'content': report}],
            )

            raw = response.content[0].text if response.content else ''
            status, feedback = self._parse_review(raw)

            self.logger.info(f'Review result: {status}')
            return ReviewResult(
                status=status,
                feedback=feedback,
                raw_response=raw,
            )

        except Exception as e:
            self.logger.error(f'Claude review failed: {e}')
            return ReviewResult(
                status='APPROVED',
                feedback=f'Auto-approved (Claude review failed: {e})',
                error=str(e),
            )

    def _review_with_opencode(self, report: str) -> ReviewResult:
        from .opencode import OpenCode
        from .powershell import PowerShell

        ps = PowerShell(self.logger)
        oc = OpenCode(self.config, ps, self.logger)

        prompt_path = self.config.project_path / self.config.prompt_reviewer
        system_prompt = 'You are a senior code reviewer.'
        if prompt_path.exists():
            system_prompt = prompt_path.read_text(encoding='utf-8')

        full_prompt = f'{system_prompt}\n\n{report}'
        result = oc.execute_task(full_prompt, timeout=300)

        if result.success and result.stdout:
            raw = result.stdout
            status, feedback = self._parse_review(raw)
            self.logger.info(f'Review result: {status}')
            return ReviewResult(
                status=status,
                feedback=feedback,
                raw_response=raw,
            )

        self.logger.warning('Review via OpenCode failed, auto-approving')
        return ReviewResult(
            status='APPROVED',
            feedback='Auto-approved (review via OpenCode failed)',
            error=result.stderr,
        )

    def _parse_review(self, text: str) -> tuple[str, str]:
        text_upper = text.upper()

        if 'APPROVED' in text_upper and 'CHANGES_REQUESTED' not in text_upper:
            return ('APPROVED', text)

        if 'CHANGES_REQUESTED' in text_upper:
            return ('CHANGES_REQUESTED', text)

        if re.search(r'\*\*APPROVED\*\*', text, re.IGNORECASE):
            return ('APPROVED', text)
        if re.search(r'\*\*CHANGES REQUESTED\*\*', text, re.IGNORECASE):
            return ('CHANGES_REQUESTED', text)

        verdict_match = re.search(
            r'##\s*Verdict\s*\n\s*\*\*([^*]+)\*\*', text
        )
        if verdict_match:
            verdict = verdict_match.group(1).strip().upper()
            if 'APPROVED' in verdict:
                return ('APPROVED', text)
            if 'CHANGES' in verdict:
                return ('CHANGES_REQUESTED', text)

        self.logger.warning(
            'Could not parse review verdict, defaulting to CHANGES_REQUESTED'
        )
        return ('CHANGES_REQUESTED', text)
