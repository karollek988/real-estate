from __future__ import annotations

import argparse
import sys
from pathlib import Path

from orchestrator.config import OrchestratorConfig
from orchestrator.workflow import Workflow


def main():
    parser = argparse.ArgumentParser(
        description='AI Orchestrator - Automated development workflow with OpenCode',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            'Examples:\n'
            '  python main.py "Add a new API endpoint for user profiles"\n'
            '  python main.py --task-file task.txt\n'
            '  python main.py --resume\n'
            '  python main.py --init\n'
        ),
    )

    parser.add_argument(
        'task',
        nargs='?',
        help='The development task to execute',
    )
    parser.add_argument(
        '--config', '-c',
        default='config.yaml',
        help='Path to config file (default: config.yaml)',
    )
    parser.add_argument(
        '--max-iterations', '-m',
        type=int,
        default=10,
        help='Maximum review iterations (default: 10)',
    )
    parser.add_argument(
        '--resume', '-r',
        action='store_true',
        help='Resume previous session',
    )
    parser.add_argument(
        '--init', '-i',
        action='store_true',
        help='Initialize default config and prompts in current directory',
    )
    parser.add_argument(
        '--task-file', '-f',
        help='Read task from file',
    )

    args = parser.parse_args()

    if args.init:
        init_project()
        return

    config_path = Path(args.config)
    if not config_path.exists():
        print(f'Config file not found: {config_path}')
        print('Run with --init to create default configuration')
        sys.exit(1)

    task = None
    if args.task:
        task = args.task
    elif args.task_file:
        task_file = Path(args.task_file)
        if task_file.exists():
            task = task_file.read_text(encoding='utf-8')
        else:
            print(f'Task file not found: {args.task_file}')
            sys.exit(1)
    elif not args.resume:
        parser.print_help()
        print('\nError: Provide a task, use --task-file, or use --resume')
        sys.exit(1)

    try:
        config = OrchestratorConfig(str(config_path))
    except FileNotFoundError as e:
        print(f'Error: {e}')
        sys.exit(1)

    workflow = Workflow(config)
    workflow.run(
        task=task or '',
        max_iterations=args.max_iterations,
        resume=args.resume,
    )


def init_project():
    base = Path.cwd()
    config_path = base / 'config.yaml'
    state_dir = base / '.orchestrator'
    prompts_dir = base / 'prompts'
    orchestrator_dir = base / 'orchestrator'

    state_dir.mkdir(parents=True, exist_ok=True)
    prompts_dir.mkdir(parents=True, exist_ok=True)
    orchestrator_dir.mkdir(parents=True, exist_ok=True)

    default_config = """project_path: "."

models:
  developer:
    provider: opencode
    model: deepseek-chat
    role: developer

  reviewer:
    provider: claude
    model: claude-sonnet-4-20250514
    role: reviewer
    api_key_env: ANTHROPIC_API_KEY

  planner:
    provider: opencode
    model: deepseek-chat
    role: planner

workflow:
  max_iterations: 10
  opencode_path: opencode
  state_dir: .orchestrator
  log_dir: .orchestrator/logs

checks:
  lint:
    enabled: false
    command: ""
  build:
    enabled: false
    command: ""
  test:
    enabled: false
    command: ""

prompts:
  developer: prompts/developer.md
  reviewer: prompts/reviewer.md
  planner: prompts/planner.md
"""
    if not config_path.exists():
        config_path.write_text(default_config.strip(), encoding='utf-8')
        print(f'Created: {config_path}')

    prompts = {
        'planner.md': (
            'You are a senior technical architect and planner.\n'
            '\n'
            'Your role is to analyze the given task and create a detailed implementation plan.\n'
            '\n'
            '## Guidelines\n'
            '- Break down the task into clear, actionable steps\n'
            '- Identify which files need to be created or modified\n'
            '- Consider edge cases and error handling\n'
            '- Suggest testing strategy\n'
            '- Keep security and performance in mind\n'
            '\n'
            '## Output Format\n'
            'Provide a structured plan with:\n'
            '1. Summary of what needs to be done\n'
            '2. Step-by-step implementation order\n'
            '3. Files to modify/create\n'
            '4. Key design decisions\n'
            '5. Testing approach\n'
        ),
        'developer.md': (
            'You are a senior software engineer implementing a task.\n'
            '\n'
            '## Guidelines\n'
            '- Write clean, production-quality code\n'
            '- Follow existing code patterns and conventions\n'
            '- Handle errors gracefully\n'
            '- Add appropriate logging where needed\n'
            '- Do NOT add unnecessary comments unless the code is complex\n'
            '- Ensure the code compiles/builds successfully\n'
            '\n'
            'When implementing:\n'
            '1. Understand the full task and plan before starting\n'
            '2. Make minimal, focused changes\n'
            '3. Verify your implementation handles edge cases\n'
            '4. Ensure backward compatibility\n'
        ),
        'reviewer.md': (
            'You are a senior code reviewer.\n'
            '\n'
            'Review the following work carefully and critically.\n'
            '\n'
            '## Review Criteria\n'
            '- Correctness: Does the implementation solve the task?\n'
            '- Code Quality: Is the code clean, maintainable, and following project conventions?\n'
            '- Edge Cases: Are error conditions and edge cases handled?\n'
            '- Security: Are there any security concerns?\n'
            '- Performance: Are there performance issues?\n'
            '\n'
            '## Response Format\n'
            'You MUST start your response with one of these exact lines:\n'
            '- **APPROVED** - if the implementation is correct and complete\n'
            '- **CHANGES REQUESTED** - if changes are needed (followed by specific feedback)\n'
            '\n'
            'Then provide your detailed reasoning.\n'
        ),
    }

    for filename, content in prompts.items():
        path = prompts_dir / filename
        if not path.exists():
            path.write_text(content, encoding='utf-8')
            print(f'Created: {path}')

    print()
    print('Project initialized! Edit config.yaml to configure models and checks.')
    print('Install dependencies: pip install -r requirements.txt')
    print('Run: python main.py "your task description"')
    print()


if __name__ == '__main__':
    main()
