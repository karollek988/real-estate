"""Plugin architecture for extensible components."""

from __future__ import annotations

import importlib
import pkgutil
from abc import abstractmethod
from pathlib import Path

from brf_scraper.base import BaseInterface
from brf_scraper.exceptions import PluginError, PluginNotFoundError
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class Plugin(BaseInterface):
    """Base class for all plugins."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Plugin name."""

    @property
    @abstractmethod
    def version(self) -> str:
        """Plugin version."""

    @property
    def description(self) -> str:
        """Plugin description."""
        return ""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the plugin."""

    @abstractmethod
    async def close(self) -> None:
        """Clean up plugin resources."""


class PluginManager:
    """Plugin manager for discovering and loading plugins."""

    def __init__(self) -> None:
        """Initialize plugin manager."""
        self._plugins: dict[str, Plugin] = {}
        self._plugin_classes: dict[str, type[Plugin]] = {}

    async def register(self, plugin_class: type[Plugin]) -> Plugin:
        """Register a plugin class.

        Args:
            plugin_class: Plugin class to register.

        Returns:
            Initialized plugin instance.

        Raises:
            PluginError: If registration fails.
        """
        try:
            plugin = plugin_class()
            await plugin.initialize()
            self._plugins[plugin.name] = plugin
            self._plugin_classes[plugin.name] = plugin_class
            logger.info(
                "plugin_registered",
                name=plugin.name,
                version=plugin.version,
            )
            return plugin
        except Exception as e:
            raise PluginError(f"Failed to register plugin: {e}") from e

    async def unregister(self, name: str) -> bool:
        """Unregister a plugin.

        Args:
            name: Plugin name.

        Returns:
            True if unregistered.
        """
        if name in self._plugins:
            plugin = self._plugins[name]
            await plugin.close()
            del self._plugins[name]
            del self._plugin_classes[name]
            logger.info("plugin_unregistered", name=name)
            return True
        return False

    def get(self, name: str) -> Plugin:
        """Get a plugin by name.

        Args:
            name: Plugin name.

        Returns:
            Plugin instance.

        Raises:
            PluginNotFoundError: If plugin not found.
        """
        if name not in self._plugins:
            raise PluginNotFoundError(name)
        return self._plugins[name]

    def has(self, name: str) -> bool:
        """Check if plugin exists."""
        return name in self._plugins

    @property
    def plugins(self) -> list[Plugin]:
        """Get all registered plugins."""
        return list(self._plugins.values())

    @property
    def plugin_names(self) -> list[str]:
        """Get all plugin names."""
        return list(self._plugins.keys())

    async def discover_plugins(
        self,
        package_path: str | Path,
        prefix: str = "brf_scraper_",
    ) -> list[type[Plugin]]:
        """Discover plugins in a package.

        Args:
            package_path: Path to package to search.
            prefix: Plugin package prefix.

        Returns:
            List of discovered plugin classes.
        """
        discovered: list[type[Plugin]] = []

        try:
            package_path = Path(package_path)
            if not package_path.exists():
                logger.warning("plugin_path_not_found", path=str(package_path))
                return discovered

            # Find all Python modules in the package
            for module_info in pkgutil.iter_modules([str(package_path)]):
                if module_info.name.startswith(prefix):
                    module_name = f"{package_path.name}.{module_info.name}"
                    try:
                        module = importlib.import_module(module_name)
                        # Look for Plugin subclasses
                        for attr_name in dir(module):
                            attr = getattr(module, attr_name)
                            if (
                                isinstance(attr, type)
                                and issubclass(attr, Plugin)
                                and attr is not Plugin
                            ):
                                discovered.append(attr)
                    except Exception as e:
                        logger.warning(
                            "plugin_load_failed",
                            module=module_name,
                            error=str(e),
                        )
        except Exception as e:
            logger.error("plugin_discovery_failed", error=str(e))

        return discovered


# Global plugin manager instance
_plugin_manager: PluginManager | None = None


def get_plugin_manager() -> PluginManager:
    """Get the global plugin manager instance.

    Returns:
        Plugin manager instance.
    """
    global _plugin_manager
    if _plugin_manager is None:
        _plugin_manager = PluginManager()
    return _plugin_manager
