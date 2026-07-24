from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Optional


class Logger:
    def __init__(
        self,
        log_dir: Path,
        name: str = 'orchestrator',
        level: int = logging.DEBUG,
        console_level: int = logging.INFO,
    ):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.name = name
        self._logger = logging.getLogger(name)
        self._logger.setLevel(level)
        self._logger.handlers.clear()

        formatter_file = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
        )
        formatter_console = logging.Formatter('%(message)s')

        fh = logging.FileHandler(
            self.log_dir / f'{name}.log',
            encoding='utf-8',
            mode='a',
        )
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(formatter_file)

        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(console_level)
        ch.setFormatter(formatter_console)

        self._logger.addHandler(fh)
        self._logger.addHandler(ch)

    def debug(self, msg: str):
        self._logger.debug(msg)

    def info(self, msg: str):
        self._logger.info(msg)

    def warning(self, msg: str):
        self._logger.warning(msg)

    def error(self, msg: str):
        self._logger.error(msg)

    def critical(self, msg: str):
        self._logger.critical(msg)

    def section(self, title: str):
        self._logger.info('')
        self._logger.info('=' * 60)
        self._logger.info(f'  {title}')
        self._logger.info('=' * 60)
