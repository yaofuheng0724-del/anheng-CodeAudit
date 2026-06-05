"""
本地文件处理工具。
"""

from __future__ import annotations

import gzip
import logging
import os
import shutil
import subprocess
import tarfile
import zipfile
from pathlib import Path

import rarfile

from app.core.config import settings
from app.services.zip_storage import normalize_archive_extension

logger = logging.getLogger(__name__)


# macOS 资源目录和 AppleDouble 文件前缀——这些文件不是真正的压缩包
MACOSX_DIR = "__MACOSX"
APPLEDOUBLE_PREFIX = "._"

# ZIP 文件的魔数（用于快速校验文件是否真的是 ZIP）
ZIP_MAGIC = b"PK\x03\x04"

SUPPORTED_ARCHIVE_EXTENSIONS = {
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".tgz",
    ".tar.gz",
}


def is_supported_archive(filename: str) -> bool:
    return normalize_archive_extension(filename) in SUPPORTED_ARCHIVE_EXTENSIONS


def _is_real_archive(file_path: Path) -> bool:
    """
    校验文件是否为真正的压缩包（通过魔数检测），而非 macOS AppleDouble 等伪文件。

    仅对 .zip 做魔数校验（最常见且最容易误判）；
    其他格式交给各自的提取函数处理，异常时跳过。
    """
    name = file_path.name
    # 跳过 macOS AppleDouble 文件（ ._xxx.zip 不是真正 ZIP）
    if name.startswith(APPLEDOUBLE_PREFIX):
        return False

    ext = normalize_archive_extension(name)
    if ext == ".zip":
        try:
            with open(file_path, "rb") as f:
                return f.read(4) == ZIP_MAGIC
        except OSError:
            return False
    # 其他格式不做魔数校验，交给各自的提取函数处理
    return True


def _ensure_safe_path(base_dir: Path, candidate: Path) -> None:
    base_resolved = base_dir.resolve()
    candidate_resolved = candidate.resolve()
    if not str(candidate_resolved).startswith(str(base_resolved)):
        raise ValueError(f"本地文件中存在越界路径: {candidate}")


def _extract_zip(archive_path: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive_path, "r") as archive:
        for member in archive.infolist():
            target = destination / member.filename
            _ensure_safe_path(destination, target)
        archive.extractall(destination)


def _extract_tar(archive_path: Path, destination: Path) -> None:
    mode = "r:*"
    with tarfile.open(archive_path, mode) as archive:
        for member in archive.getmembers():
            target = destination / member.name
            _ensure_safe_path(destination, target)
        archive.extractall(destination)


def _extract_gzip(archive_path: Path, destination: Path) -> None:
    output_name = archive_path.name[: -len(archive_path.suffix)] or archive_path.stem
    target = destination / output_name
    _ensure_safe_path(destination, target)
    with gzip.open(archive_path, "rb") as src, open(target, "wb") as dst:
        shutil.copyfileobj(src, dst)


def _extract_rar(archive_path: Path, destination: Path) -> None:
    with rarfile.RarFile(archive_path) as archive:
        for member in archive.infolist():
            target = destination / member.filename
            _ensure_safe_path(destination, target)
        archive.extractall(destination)


def _extract_7z(archive_path: Path, destination: Path) -> None:
    subprocess.run(
        ["7z", "x", "-y", f"-o{destination}", str(archive_path)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def extract_archive(archive_path: str | Path, destination: str | Path) -> None:
    source = Path(archive_path)
    dest = Path(destination)
    dest.mkdir(parents=True, exist_ok=True)

    archive_ext = normalize_archive_extension(source.name)
    if archive_ext == ".zip":
        _extract_zip(source, dest)
    elif archive_ext in {".tar", ".tar.gz", ".tgz"}:
        _extract_tar(source, dest)
    elif archive_ext == ".gz":
        _extract_gzip(source, dest)
    elif archive_ext == ".rar":
        _extract_rar(source, dest)
    elif archive_ext == ".7z":
        _extract_7z(source, dest)
    else:
        raise ValueError(f"不支持的文件格式: {source.name}")


def extract_archive_recursive(
    archive_path: str | Path,
    destination: str | Path,
    max_depth: int | None = None,
) -> None:
    max_depth = max_depth if max_depth is not None else settings.MAX_ARCHIVE_DEPTH
    destination_path = Path(destination)
    extract_archive(archive_path, destination_path)

    for depth in range(max_depth):
        nested_archives = []
        for file_path in destination_path.rglob("*"):
            if not file_path.is_file():
                continue
            # 跳过 __MACOSX 目录下的文件
            if MACOSX_DIR in file_path.parts:
                continue
            # 跳过 AppleDouble 文件（._前缀）
            if file_path.name.startswith(APPLEDOUBLE_PREFIX):
                continue
            if is_supported_archive(file_path.name):
                # 魔数校验：确认是真正的压缩包
                if _is_real_archive(file_path):
                    nested_archives.append(file_path)
                else:
                    logger.debug(f"跳过伪压缩包: {file_path.name}")
        if not nested_archives:
            break

        for nested_archive in nested_archives:
            nested_destination = nested_archive.with_name(f"{nested_archive.stem}_contents")
            nested_destination.mkdir(parents=True, exist_ok=True)
            try:
                extract_archive(nested_archive, nested_destination)
            except Exception as e:
                # 单个嵌套压缩包提取失败不应阻止整个任务
                logger.warning(f"跳过嵌套压缩包 {nested_archive.name}: {e}")
                # 清理空的提取目录
                if nested_destination.exists() and not any(nested_destination.iterdir()):
                    nested_destination.rmdir()
                continue
            nested_archive.unlink(missing_ok=True)
    else:
        raise ValueError(f"文件嵌套层级超过限制: {max_depth}")
