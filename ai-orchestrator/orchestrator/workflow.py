from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Optional

from .config import OrchestratorConfig
from .logger import Logger
from .powershell import PowerShell
from .opencode import OpenCode
from .git_tools import GitTools
from .planner import Planner
from .executor import Executor, ExecutionResult
from .reviewer import Reviewer, ReviewResult


class WorkflowState:
    def __init__(self, state_file: Path):
        self.state_file = state_file
        self.session_id: str = ''
        self.original_task: str = ''
        self.iteration: int = 0
        self.max_iterations: int = 10
        self.status: str = 'idle'
        self.iterations: list[dict] = []
        self.current_phase: str = ''
        self._load()

    def _load(self):
        if not self.state_file.exists():
            return
        try:
            with open(self.state_file, encoding='utf-8') as f:
                data = json.load(f)
            self.session_id = data.get('session_id', '')
            self.original_task = data.get('original_task', '')
            self.iteration = data.get('iteration', 0)
            self.max_iterations = data.get('max_iterations', 10)
            self.status = data.get('status', 'idle')
            self.iterations = data.get('iterations', [])
            self.current_phase = data.get('current_phase', '')
        except (json.JSONDecodeError, IOError):
            pass

    def save(self):
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        data = {
            'session_id': self.session_id,
            'original_task': self.original_task,
            'iteration': self.iteration,
            'max_iterations': self.max_iterations,
            'status': self.status,
            'iterations': self.iterations,
            'current_phase': self.current_phase,
        }
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def start_session(self, task: str, max_iterations: int):
        self.session_id = uuid.uuid4().hex[:12]
        self.original_task = task
        self.max_iterations = max_iterations
        self.iteration = 0
        self.status = 'running'
        self.iterations = []
        self.current_phase = 'initialized'
        self.save()

    def add_iteration(self, data: dict):
        self.iterations.append(data)
        self.iteration = len(self.iterations)
        self.current_phase = 'iteration_complete'
        self.save()

    def set_phase(self, phase: str):
        self.current_phase = phase
        self.save()

    def set_status(self, status: str):
        self.status = status
        self.save()

    @property
    def can_resume(self) -> bool:
        return bool(self.session_id) and self.status == 'running'


class Workflow:
    def __init__(self, config: OrchestratorConfig):
        self.config = config
        self.logger = Logger(config.project_path / config.log_dir)
        self.powershell = PowerShell(self.logger)
        self.opencode = OpenCode(config, self.powershell, self.logger)
        self.git = GitTools(self.powershell, config.project_path, self.logger)
        self.planner = Planner(config, self.logger, self.opencode)
        self.executor = Executor(
            config, self.logger, self.opencode, self.git, self.powershell
        )
        self.reviewer = Reviewer(config, self.logger)
        self.state = WorkflowState(config.get_state_file())

    def run(
        self,
        task: str,
        max_iterations: int = 10,
        resume: bool = False,
    ):
        if resume and self.state.can_resume:
            self.logger.info(
                f'Resuming session {self.state.session_id} '
                f'at iteration {self.state.iteration}'
            )
            self._main_loop()
            return

        self.state.start_session(task, max_iterations)
        self.logger.info(f'Session started: {self.state.session_id}')
        preview = task[:200] + '...' if len(task) > 200 else task
        self.logger.info(f'Task: {preview}')
        self._main_loop()

    def _main_loop(self):
        while self.state.iteration < self.state.max_iterations:
            iteration_num = self.state.iteration + 1
            self.logger.section(
                f'Iteration {iteration_num}/{self.state.max_iterations}'
            )

            task = self.state.original_task
            feedback = self._get_last_feedback()

            plan = self._phase_planning(task, feedback)
            execution = self._phase_execution(task, plan, feedback)
            lint_result = self._run_check('lint')
            build_result = self._run_check('build')
            test_result = self._run_check('test')
            report = self._build_report(
                iteration_num, task, plan, execution,
                lint_result, build_result, test_result,
            )
            review = self._phase_review(report)

            self._save_iteration(
                iteration_num, task, plan, execution,
                lint_result, build_result, test_result,
                report, review,
            )

            if review.status == 'APPROVED':
                self.logger.section('WORKFLOW COMPLETE')
                self.logger.info('Task was APPROVED by reviewer!')
                self.state.set_status('approved')
                self._print_summary()
                return

            self.logger.info('Changes requested, starting next iteration...')

        self.logger.warning(
            f'Max iterations ({self.state.max_iterations}) reached without approval.'
        )
        self.state.set_status('max_iterations_reached')

    def _get_last_feedback(self) -> str:
        if not self.state.iterations:
            return ''
        last = self.state.iterations[-1]
        review = last.get('review', {})
        if review.get('status') == 'CHANGES_REQUESTED':
            feedback = review.get('feedback', '')
            self.logger.info('Incorporating feedback from previous review')
            return feedback
        return ''

    def _phase_planning(self, task: str, feedback: str) -> str:
        self.state.set_phase('planning')
        context = f'Previous review feedback:\n{feedback}' if feedback else None
        return self.planner.create_plan(task, context)

    def _phase_execution(
        self,
        task: str,
        plan: str,
        feedback: str,
    ) -> ExecutionResult:
        self.state.set_phase('execution')
        return self.executor.execute(task, plan, feedback or None)

    def _phase_review(self, report: str) -> ReviewResult:
        self.state.set_phase('reviewing')
        return self.reviewer.review(report)

    def _run_check(self, check_name: str) -> dict:
        check_map = {
            'lint': self.config.check_lint,
            'build': self.config.check_build,
            'test': self.config.check_test,
        }
        check = check_map.get(check_name)
        if not check or not check.enabled or not check.command:
            return {'enabled': False, 'passed': True, 'output': 'Check disabled'}

        self.logger.info(f'Running {check_name}: {check.command}')
        result = self.powershell.run(
            check.command,
            workdir=self.config.project_path,
            timeout=120,
        )

        return {
            'enabled': True,
            'passed': result.success,
            'output': result.stdout[:2000] if result.stdout else '',
            'error': result.stderr[:1000] if result.stderr else '',
            'exit_code': result.exit_code,
            'duration': result.duration,
        }

    def _build_report(
        self,
        iteration: int,
        task: str,
        plan: str,
        execution: ExecutionResult,
        lint: dict,
        build: dict,
        test: dict,
    ) -> str:
        lines: list[str] = []
        lines.append(f'# Review Report - Iteration {iteration}')
        lines.append('')
        lines.append(f'**Original Task**: {task}')
        lines.append('')

        lines.append('## Changes Made')
        files = execution.files_changed
        if files:
            lines.append(f'Files changed: {len(files)}')
            for f in files:
                lines.append(f'- `{f}`')
        else:
            lines.append('No files changed.')
        lines.append('')

        if execution.git_diff_stat:
            lines.append('### Diff Statistics')
            lines.append('```')
            lines.append(execution.git_diff_stat)
            lines.append('```')
            lines.append('')

        diff = execution.git_diff
        if diff:
            lines.append('### Full Diff')
            if len(diff) > 8000:
                diff = diff[:8000] + '\n... (diff truncated)'
            lines.append('```diff')
            lines.append(diff)
            lines.append('```')
            lines.append('')

        lines.append('## Quality Checks')
        for name, result in [
            ('Lint', lint),
            ('Build', build),
            ('Tests', test),
        ]:
            enabled = result.get('enabled', False)
            if enabled:
                passed = result.get('passed', False)
                mark = 'PASSED' if passed else 'FAILED'
                lines.append(f'- **{name}**: {mark}')
                output = result.get('output', '')
                if output and not passed:
                    lines.append(f'  ```\n  {output[:500]}\n  ```')
            else:
                lines.append(f'- **{name}**: Disabled')
        lines.append('')

        lines.append('## Review Instructions')
        lines.append('Review the changes above carefully.')
        lines.append('')
        lines.append('Respond with one of the following:')
        lines.append('- **APPROVED** - implementation is correct and complete')
        lines.append(
            '- **CHANGES REQUESTED** - followed by specific feedback '
            'on what needs to change'
        )
        lines.append('')

        return '\n'.join(lines)

    def _save_iteration(
        self,
        number: int,
        task: str,
        plan: str,
        execution: ExecutionResult,
        lint: dict,
        build: dict,
        test: dict,
        report: str,
        review: ReviewResult,
    ):
        iteration_data = {
            'number': number,
            'task_preview': task[:200],
            'plan_preview': plan[:200],
            'execution': {
                'success': execution.success,
                'files_changed': execution.files_changed,
                'git_diff_stat': execution.git_diff_stat,
                'duration': execution.duration,
            },
            'checks': {
                'lint': lint,
                'build': build,
                'test': test,
            },
            'report_preview': report[:500],
            'review': {
                'status': review.status,
                'feedback': review.feedback[:2000] if review.feedback else '',
                'error': review.error,
            },
            'status': 'completed',
        }
        self.state.add_iteration(iteration_data)
        self.logger.info(f'Iteration {number} saved. Review: {review.status}')

    def _print_summary(self):
        iterations = self.state.iteration
        total_duration = 0.0
        total_changes = 0
        for it in self.state.iterations:
            exec_data = it.get('execution', {})
            total_duration += exec_data.get('duration', 0)
            total_changes += len(exec_data.get('files_changed', []))

        self.logger.info('')
        self.logger.info(f'Session:    {self.state.session_id}')
        self.logger.info(f'Iterations: {iterations}')
        self.logger.info(f'Duration:   {total_duration:.1f}s')
        self.logger.info(f'Files:      {total_changes}')
        self.logger.info(f'Status:     {self.state.status}')
        self.logger.info('')
