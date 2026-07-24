"""Tests for storage implementations."""

from __future__ import annotations

import pytest

from brf_scraper.storage.local import LocalStorage


class TestLocalStorage:
    """Tests for LocalStorage."""

    @pytest.fixture
    def storage(self, tmp_path: object) -> LocalStorage:
        """Create a LocalStorage instance with a temp directory."""
        import pathlib

        test_dir = pathlib.Path(str(tmp_path)) / "test_storage"
        return LocalStorage(base_dir=test_dir)

    @pytest.mark.asyncio
    async def test_initialize_creates_directory(self, storage: LocalStorage) -> None:
        assert not storage.base_dir.exists()
        await storage.initialize()
        assert storage.base_dir.exists()

    @pytest.mark.asyncio
    async def test_save_and_load(self, storage: LocalStorage) -> None:
        await storage.initialize()
        content = b"test pdf content"
        path = await storage.save("doc-001", content, "report.pdf")
        assert path is not None

        loaded = await storage.load(path)
        assert loaded == content

    @pytest.mark.asyncio
    async def test_save_returns_relative_path(self, storage: LocalStorage) -> None:
        await storage.initialize()
        path = await storage.save("doc-001", b"data", "file.pdf")
        assert "doc-001" in path
        assert "file.pdf" in path

    @pytest.mark.asyncio
    async def test_exists_true(self, storage: LocalStorage) -> None:
        await storage.initialize()
        path = await storage.save("doc-001", b"data", "file.pdf")
        assert await storage.exists(path) is True

    @pytest.mark.asyncio
    async def test_exists_false(self, storage: LocalStorage) -> None:
        await storage.initialize()
        assert await storage.exists("nonexistent/file.pdf") is False

    @pytest.mark.asyncio
    async def test_delete(self, storage: LocalStorage) -> None:
        await storage.initialize()
        path = await storage.save("doc-001", b"data", "file.pdf")
        assert await storage.exists(path) is True

        deleted = await storage.delete(path)
        assert deleted is True
        assert await storage.exists(path) is False

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, storage: LocalStorage) -> None:
        await storage.initialize()
        deleted = await storage.delete("nonexistent/file.pdf")
        assert deleted is False

    @pytest.mark.asyncio
    async def test_get_size(self, storage: LocalStorage) -> None:
        await storage.initialize()
        content = b"hello world"
        path = await storage.save("doc-001", content, "file.txt")
        size = await storage.get_size(path)
        assert size == len(content)

    @pytest.mark.asyncio
    async def test_list_files(self, storage: LocalStorage) -> None:
        await storage.initialize()
        await storage.save("doc-001", b"data1", "file1.pdf")
        await storage.save("doc-002", b"data2", "file2.pdf")

        files = await storage.list_files()
        assert len(files) == 2

    @pytest.mark.asyncio
    async def test_list_files_with_prefix(self, storage: LocalStorage) -> None:
        await storage.initialize()
        await storage.save("doc-001", b"data1", "file1.pdf")
        await storage.save("doc-002", b"data2", "file2.pdf")

        files = await storage.list_files(prefix="doc-001")
        assert len(files) == 1

    @pytest.mark.asyncio
    async def test_get_path(self, storage: LocalStorage) -> None:
        await storage.initialize()
        path = await storage.get_path("doc-001")
        assert path.name == "doc-001"

    @pytest.mark.asyncio
    async def test_close(self, storage: LocalStorage) -> None:
        await storage.initialize()
        await storage.close()  # Should not raise

    def test_base_dir_property(self, tmp_path: object) -> None:
        import pathlib

        test_dir = pathlib.Path(str(tmp_path)) / "test"
        storage = LocalStorage(base_dir=test_dir)
        assert storage.base_dir == test_dir
