"""Unit tests for plugin architecture."""

from __future__ import annotations

import pytest

from brf_scraper.exceptions import PluginNotFoundError
from brf_scraper.plugins import Plugin, PluginManager


class MockPlugin(Plugin):
    """Mock plugin for testing."""

    @property
    def name(self) -> str:
        return "mock-plugin"

    @property
    def version(self) -> str:
        return "1.0.0"

    @property
    def description(self) -> str:
        return "A mock plugin for testing"

    async def initialize(self) -> None:
        pass

    async def close(self) -> None:
        pass


class TestPluginManager:
    """Tests for PluginManager."""

    @pytest.fixture
    def manager(self) -> PluginManager:
        """Create a fresh plugin manager."""
        return PluginManager()

    @pytest.mark.asyncio
    async def test_register_plugin(self, manager: PluginManager) -> None:
        """Test registering a plugin."""
        plugin = await manager.register(MockPlugin)
        assert plugin.name == "mock-plugin"
        assert manager.has("mock-plugin")

    @pytest.mark.asyncio
    async def test_unregister_plugin(self, manager: PluginManager) -> None:
        """Test unregistering a plugin."""
        await manager.register(MockPlugin)
        result = await manager.unregister("mock-plugin")
        assert result is True
        assert manager.has("mock-plugin") is False

    @pytest.mark.asyncio
    async def test_get_plugin(self, manager: PluginManager) -> None:
        """Test getting a plugin by name."""
        await manager.register(MockPlugin)
        plugin = manager.get("mock-plugin")
        assert plugin.name == "mock-plugin"

    @pytest.mark.asyncio
    async def test_get_nonexistent_plugin(self, manager: PluginManager) -> None:
        """Test getting nonexistent plugin raises error."""
        with pytest.raises(PluginNotFoundError):
            manager.get("nonexistent")

    @pytest.mark.asyncio
    async def test_plugin_names(self, manager: PluginManager) -> None:
        """Test getting plugin names."""
        await manager.register(MockPlugin)
        assert "mock-plugin" in manager.plugin_names

    @pytest.mark.asyncio
    async def test_plugins_list(self, manager: PluginManager) -> None:
        """Test getting plugins list."""
        await manager.register(MockPlugin)
        plugins = manager.plugins
        assert len(plugins) == 1
        assert plugins[0].name == "mock-plugin"
