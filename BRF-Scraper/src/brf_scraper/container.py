"""Dependency injection container."""

from __future__ import annotations

from typing import Any, TypeVar

from brf_scraper.config import AppSettings
from brf_scraper.exceptions import ConfigurationError
from brf_scraper.interfaces.cache import create_cache
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

T = TypeVar("T")


class Container:
    """Dependency injection container."""

    def __init__(self, settings: AppSettings | None = None) -> None:
        """Initialize the container.

        Args:
            settings: Application settings.
        """
        self._settings = settings or AppSettings()
        self._singletons: dict[type[Any], Any] = {}
        self._factories: dict[type[Any], Any] = {}
        self._initialized = False

    @property
    def settings(self) -> AppSettings:
        """Get application settings."""
        return self._settings

    def register_singleton(self, interface: type[T], instance: T) -> None:
        """Register a singleton instance.

        Args:
            interface: Interface type.
            instance: Singleton instance.
        """
        self._singletons[interface] = instance
        logger.debug("singleton_registered", interface=interface.__name__)

    def register_factory(self, interface: type[T], factory: Any) -> None:
        """Register a factory function.

        Args:
            interface: Interface type.
            factory: Factory function that creates instances.
        """
        self._factories[interface] = factory
        logger.debug("factory_registered", interface=interface.__name__)

    def resolve(self, interface: type[T]) -> T:
        """Resolve an instance by interface.

        Args:
            interface: Interface type to resolve.

        Returns:
            Instance of the interface.

        Raises:
            ConfigurationError: If not registered.
        """
        # Check singletons first
        if interface in self._singletons:
            return self._singletons[interface]  # type: ignore[no-any-return]

        # Check factories
        if interface in self._factories:
            factory = self._factories[interface]
            return factory(self)  # type: ignore[no-any-return]

        raise ConfigurationError(
            f"No registration found for {interface.__name__}",
            details={
                "registered_singletons": [k.__name__ for k in self._singletons],
                "registered_factories": [k.__name__ for k in self._factories],
            },
        )

    async def initialize(self) -> None:
        """Initialize all registered components."""
        if self._initialized:
            return

        logger.info("container_initializing")

        # Initialize singletons
        for interface, instance in self._singletons.items():
            if hasattr(instance, "initialize"):
                await instance.initialize()
                logger.debug("singleton_initialized", interface=interface.__name__)

        self._initialized = True
        logger.info("container_initialized")

    async def close(self) -> None:
        """Close all registered components."""
        logger.info("container_closing")

        # Close singletons in reverse order
        for interface in reversed(list(self._singletons.keys())):
            instance = self._singletons[interface]
            if hasattr(instance, "close"):
                await instance.close()
                logger.debug("singleton_closed", interface=interface.__name__)

        self._initialized = False
        logger.info("container_closed")

    async def __aenter__(self) -> Container:
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(
        self,
        exc_type: type[Exception] | None,
        exc_val: Exception | None,
        exc_tb: Any,
    ) -> None:
        """Async context manager exit."""
        await self.close()


def create_container(settings: AppSettings | None = None) -> Container:
    """Create and configure the dependency injection container.

    Args:
        settings: Optional application settings.

    Returns:
        Configured container.
    """
    container = Container(settings)

    # Register cache based on settings
    def _create_cache(c: Container) -> Any:
        s = c.settings
        use_redis = s.redis.url != "redis://localhost:6379/0"
        return create_cache(
            use_redis=use_redis,
            redis_url=s.redis.url,
        )

    from brf_scraper.interfaces.cache import Cache

    container.register_factory(Cache, _create_cache)  # type: ignore[type-abstract]

    return container
