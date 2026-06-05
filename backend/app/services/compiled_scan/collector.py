"""Walk a workspace and pick out compiled artifacts."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.services.quick_scan import normalize_path, should_exclude

# Extensions we recognise as compiled artifacts. Mirror of `TEXT_EXTENSIONS`
# in quick_scan.py — anything in this set bypasses the source-scan collector
# (which would filter it out as non-text).
COMPILED_EXTENSIONS: set[str] = {
    # Android
    ".apk", ".aab", ".dex",
    # Java 系（jar/war/ear/aar 本质是 zip，class 是字节码）
    ".jar", ".war", ".ear", ".aar", ".class",
    # Native binaries — Windows / Linux / macOS
    ".so", ".dll", ".exe", ".elf",
    ".o", ".obj",                 # object files (C/C++ 编译中间产物)
    ".a", ".lib",                 # 静态库
    ".dylib",                     # macOS 动态库
}

DEFAULT_MAX_SIZE_MB = 200


def collect_compiled_artifacts(
    workspace_dir: str | Path,
    exclude_patterns: list[str] | None = None,
    max_size_mb: int = DEFAULT_MAX_SIZE_MB,
) -> list[dict[str, Any]]:
    """Return a list of compiled-artifact files under `workspace_dir`.

    Each entry: {relative_path, absolute_path, size_bytes, extension}.
    Files larger than `max_size_mb` are silently skipped (caller may emit
    an info-level finding for them).
    """
    workspace = Path(workspace_dir)
    if not workspace.exists() or not workspace.is_dir():
        return []

    max_bytes = max_size_mb * 1024 * 1024
    out: list[dict[str, Any]] = []

    for path in workspace.rglob("*"):
        if not path.is_file():
            continue
        rel = normalize_path(path.relative_to(workspace))
        if should_exclude(rel, exclude_patterns):
            continue
        ext = path.suffix.lower()
        if ext not in COMPILED_EXTENSIONS:
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size > max_bytes:
            continue
        out.append(
            {
                "relative_path": rel,
                "absolute_path": str(path),
                "size_bytes": size,
                "extension": ext,
            }
        )

    out.sort(key=lambda r: r["relative_path"])
    return out
