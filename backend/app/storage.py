from abc import ABC, abstractmethod
import os
from pathlib import Path
from typing import Optional
import uuid


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, file_path: str, content: bytes, content_type: Optional[str] = None) -> str:
        """Save file content and return the stored file path."""
        pass

    @abstractmethod
    async def save_atomic(
        self, file_path: str, content: bytes, content_type: Optional[str] = None
    ) -> str:
        """Atomically save file content using a temporary file in the same directory."""
        pass

    @abstractmethod
    async def delete(self, file_path: str) -> bool:
        """Delete file at file_path if it exists."""
        pass

    @abstractmethod
    async def exists(self, file_path: str) -> bool:
        """Check if file exists."""
        pass

    @abstractmethod
    async def read(self, file_path: str) -> bytes:
        """Read and return file content."""
        pass


class LocalStorage(StorageBackend):
    def __init__(self, base_dir: Optional[str] = None):
        if base_dir:
            self.base_dir = Path(base_dir)
        else:
            storage_env = os.getenv("STORAGE_DIR")
            if storage_env:
                self.base_dir = Path(storage_env)
            else:
                candidates = [
                    Path("/app/storage"),
                    Path("storage"),
                    Path("../storage"),
                    Path(__file__).resolve().parent.parent.parent / "storage",
                ]
                self.base_dir = Path("/app/storage")
                for c in candidates:
                    if c.is_dir():
                        self.base_dir = c
                        break
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, file_path: str) -> Path:
        resolved = (self.base_dir / file_path).resolve()
        base_resolved = self.base_dir.resolve()
        try:
            resolved.relative_to(base_resolved)
        except ValueError:
            raise ValueError(f"Path traversal attempted: {file_path}")
        return resolved

    async def save(self, file_path: str, content: bytes, content_type: Optional[str] = None) -> str:
        target = self._resolve_path(file_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return str(file_path)

    async def save_atomic(
        self, file_path: str, content: bytes, content_type: Optional[str] = None
    ) -> str:
        target = self._resolve_path(file_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        temp_file = target.parent / f".{target.name}.tmp.{uuid.uuid4().hex}"
        try:
            with open(temp_file, "wb") as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_file, target)
            return str(file_path)
        finally:
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except OSError:
                    pass

    async def delete(self, file_path: str) -> bool:
        target = self._resolve_path(file_path)
        if target.exists() and target.is_file():
            target.unlink()
            return True
        return False

    async def exists(self, file_path: str) -> bool:
        target = self._resolve_path(file_path)
        return target.exists() and target.is_file()

    async def read(self, file_path: str) -> bytes:
        target = self._resolve_path(file_path)
        if not target.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        return target.read_bytes()


def get_storage() -> StorageBackend:
    return LocalStorage()
