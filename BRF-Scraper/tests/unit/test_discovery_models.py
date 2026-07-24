"""Tests for discovery models."""

from __future__ import annotations

from datetime import datetime

from pydantic import HttpUrl

from brf_scraper.discovery.models import (
    DirectoryConfig,
    DiscoveredBRF,
    DiscoveryResult,
    DiscoverySource,
    SearchQuery,
    SeedUrlList,
)


class TestDiscoverySource:
    """Tests for DiscoverySource enum."""

    def test_discovery_source_values(self) -> None:
        """Test DiscoverySource has correct values."""
        assert DiscoverySource.SEARCH_ENGINE == "search_engine"
        assert DiscoverySource.DIRECTORY == "directory"
        assert DiscoverySource.SEED_URL == "seed_url"
        assert DiscoverySource.MANUAL == "manual"
        assert DiscoverySource.UNKNOWN == "unknown"

    def test_discovery_source_count(self) -> None:
        """Test DiscoverySource has correct number of values."""
        assert len(DiscoverySource) == 5


class TestDiscoveredBRF:
    """Tests for DiscoveredBRF model."""

    def test_create_discovered_brf(self) -> None:
        """Test creating a DiscoveredBRF."""
        brf = DiscoveredBRF(
            name="Test BRF",
            website_url=HttpUrl("https://www.testbrf.se"),
            source=DiscoverySource.SEARCH_ENGINE,
        )

        assert brf.name == "Test BRF"
        assert str(brf.website_url) == "https://www.testbrf.se/"
        assert brf.source == DiscoverySource.SEARCH_ENGINE
        assert brf.confidence_score == 1.0
        assert brf.id is not None

    def test_discovered_brf_defaults(self) -> None:
        """Test DiscoveredBRF default values."""
        brf = DiscoveredBRF(
            name="Test",
            website_url=HttpUrl("https://test.se"),
            source=DiscoverySource.SEED_URL,
        )

        assert brf.city is None
        assert brf.municipality is None
        assert brf.county is None
        assert brf.organization_number is None
        assert brf.raw_data == {}
        assert brf.metadata == {}
        assert isinstance(brf.discovered_at, datetime)

    def test_to_brf_input(self) -> None:
        """Test converting to BRF input dict."""
        brf = DiscoveredBRF(
            name="Test BRF",
            website_url=HttpUrl("https://www.testbrf.se"),
            source=DiscoverySource.DIRECTORY,
            city="Stockholm",
            raw_data={"key": "value"},
        )

        brf_input = brf.to_brf_input()

        assert brf_input["name"] == "Test BRF"
        assert brf_input["website_url"] == "https://www.testbrf.se/"
        assert brf_input["city"] == "Stockholm"
        assert brf_input["metadata"]["key"] == "value"


class TestDiscoveryResult:
    """Tests for DiscoveryResult model."""

    def test_create_discovery_result(self) -> None:
        """Test creating a DiscoveryResult."""
        result = DiscoveryResult(source=DiscoverySource.SEARCH_ENGINE)

        assert result.source == DiscoverySource.SEARCH_ENGINE
        assert result.brfs == []
        assert result.total_found == 0
        assert result.errors == []
        assert result.is_success is False

    def test_is_success_with_brfs(self) -> None:
        """Test is_success with discovered BRFs."""
        result = DiscoveryResult(source=DiscoverySource.SEED_URL)
        result.add_brf(
            DiscoveredBRF(
                name="Test",
                website_url=HttpUrl("https://test.se"),
                source=DiscoverySource.SEED_URL,
            )
        )

        assert result.is_success is True
        assert result.total_found == 1

    def test_is_success_with_errors(self) -> None:
        """Test is_success with errors."""
        result = DiscoveryResult(source=DiscoverySource.SEARCH_ENGINE)
        result.add_error("Something went wrong")

        assert result.is_success is False

    def test_add_brf(self) -> None:
        """Test adding a BRF to result."""
        result = DiscoveryResult(source=DiscoverySource.SEED_URL)
        brf = DiscoveredBRF(
            name="Test",
            website_url=HttpUrl("https://test.se"),
            source=DiscoverySource.SEED_URL,
        )

        result.add_brf(brf)

        assert len(result.brfs) == 1
        assert result.total_found == 1

    def test_add_error(self) -> None:
        """Test adding an error."""
        result = DiscoveryResult(source=DiscoverySource.SEARCH_ENGINE)
        result.add_error("Error 1")
        result.add_error("Error 2")

        assert len(result.errors) == 2
        assert result.errors[0] == "Error 1"

    def test_add_warning(self) -> None:
        """Test adding a warning."""
        result = DiscoveryResult(source=DiscoverySource.SEARCH_ENGINE)
        result.add_warning("Warning 1")

        assert len(result.warnings) == 1

    def test_merge(self) -> None:
        """Test merging two results."""
        result1 = DiscoveryResult(source=DiscoverySource.SEED_URL)
        result1.add_brf(
            DiscoveredBRF(
                name="BRF 1",
                website_url=HttpUrl("https://brf1.se"),
                source=DiscoverySource.SEED_URL,
            )
        )

        result2 = DiscoveryResult(source=DiscoverySource.SEARCH_ENGINE)
        result2.add_brf(
            DiscoveredBRF(
                name="BRF 2",
                website_url=HttpUrl("https://brf2.se"),
                source=DiscoverySource.SEARCH_ENGINE,
            )
        )
        result2.add_error("Error from result2")

        result1.merge(result2)

        assert result1.total_found == 2
        assert len(result1.errors) == 1


class TestSearchQuery:
    """Tests for SearchQuery model."""

    def test_create_search_query(self) -> None:
        """Test creating a SearchQuery."""
        query = SearchQuery(query="bostadsrättsförening årsredovisning")

        assert query.query == "bostadsrättsförening årsredovisning"
        assert query.max_results == 50
        assert query.language == "sv"
        assert query.country == "se"
        assert query.safe_search is True

    def test_search_query_custom(self) -> None:
        """Test creating a custom SearchQuery."""
        query = SearchQuery(
            query="test",
            max_results=10,
            language="en",
            country="us",
            safe_search=False,
        )

        assert query.max_results == 10
        assert query.language == "en"
        assert query.country == "us"
        assert query.safe_search is False


class TestDirectoryConfig:
    """Tests for DirectoryConfig model."""

    def test_create_directory_config(self) -> None:
        """Test creating a DirectoryConfig."""
        config = DirectoryConfig(
            base_url=HttpUrl("https://www.allabrf.se"),
            name="Alla BRF",
        )

        assert str(config.base_url) == "https://www.allabrf.se/"
        assert config.name == "Alla BRF"
        assert config.max_pages == 10
        assert config.delay_between_requests == 1.0
        assert config.respect_robots_txt is True
        assert config.custom_headers == {}

    def test_directory_config_custom(self) -> None:
        """Test creating a custom DirectoryConfig."""
        config = DirectoryConfig(
            base_url=HttpUrl("https://test.se"),
            name="Test",
            max_pages=5,
            delay_between_requests=0.5,
            custom_headers={"Authorization": "Bearer token"},
        )

        assert config.max_pages == 5
        assert config.delay_between_requests == 0.5
        assert config.custom_headers["Authorization"] == "Bearer token"


class TestSeedUrlList:
    """Tests for SeedUrlList model."""

    def test_create_seed_url_list(self) -> None:
        """Test creating a SeedUrlList."""
        seed_list = SeedUrlList(
            name="test",
            urls=[HttpUrl("https://brf1.se"), HttpUrl("https://brf2.se")],
        )

        assert seed_list.name == "test"
        assert len(seed_list.urls) == 2
        assert seed_list.source == DiscoverySource.SEED_URL

    def test_from_file(self, tmp_path) -> None:
        """Test loading SeedUrlList from file."""
        url_file = tmp_path / "urls.txt"
        url_file.write_text("https://brf1.se\nhttps://brf2.se\n\n# Comment\nhttps://brf3.se\n")

        seed_list = SeedUrlList.from_file(str(url_file), name="test_file")

        assert seed_list.name == "test_file"
        assert len(seed_list.urls) == 3
        assert str(seed_list.urls[0]) == "https://brf1.se/"
