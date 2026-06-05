"""Top-level orchestrator for compiled-artifact scanning."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.services.compiled_scan.analyzers.apk_analyzer import ApkAnalyzer
from app.services.compiled_scan.analyzers.base import CompiledAnalyzer, Finding
from app.services.compiled_scan.analyzers.binary_analyzer import BinaryAnalyzer
from app.services.compiled_scan.analyzers.sca_analyzer import SCAAnalyzer
from app.services.compiled_scan.collector import (
    DEFAULT_MAX_SIZE_MB,
    collect_compiled_artifacts,
)


class CompiledScanEngine:
    """Runs all registered analyzers against compiled artifacts in a workspace."""

    def __init__(self, analyzers: list[CompiledAnalyzer] | None = None) -> None:
        self.analyzers: list[CompiledAnalyzer] = analyzers or [
            ApkAnalyzer(),
            BinaryAnalyzer(),
            SCAAnalyzer(),
        ]

    def scan(self, workspace_dir: str | Path, options: dict[str, Any]) -> list[dict[str, Any]]:
        """Scan `workspace_dir`. Returns a list of finding dicts ready to persist."""
        exclude = (options or {}).get("exclude_patterns", []) or []
        max_size = (options or {}).get("max_binary_size_mb", DEFAULT_MAX_SIZE_MB)

        # 1. Emit info findings for over-sized files BEFORE filtering them out.
        oversize = self._find_oversize_files(workspace_dir, exclude, max_size)
        findings: list[Finding] = oversize

        # 2. Collect in-range artifacts and dispatch to analyzers.
        artifacts = collect_compiled_artifacts(
            workspace_dir,
            exclude_patterns=exclude,
            max_size_mb=max_size,
        )
        for artifact in artifacts:
            path = Path(artifact["absolute_path"])
            for analyzer in self.analyzers:
                if not analyzer.applies_to(path):
                    continue
                try:
                    findings.extend(analyzer.analyze(path, options or {}))
                except Exception as exc:   # noqa: BLE001 — engine must not raise
                    findings.append(
                        Finding(
                            file_path=artifact["relative_path"],
                            rule_id=f"compiled.engine.analyzer_failed.{analyzer.name}",
                            severity="info",
                            title=f"{analyzer.name} 分析失败",
                            description=str(exc),
                            tool="compiled.engine",
                        )
                    )

        return self._dedupe([f.to_dict() for f in findings])

    # ----- helpers ---------------------------------------------------------

    def _find_oversize_files(
        self,
        workspace_dir: str | Path,
        exclude: list[str],
        max_size_mb: int,
    ) -> list[Finding]:
        from app.services.compiled_scan.collector import COMPILED_EXTENSIONS
        from app.services.quick_scan import normalize_path, should_exclude

        workspace = Path(workspace_dir)
        if not workspace.exists():
            return []
        max_bytes = max_size_mb * 1024 * 1024
        out: list[Finding] = []
        for path in workspace.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in COMPILED_EXTENSIONS:
                continue
            rel = normalize_path(path.relative_to(workspace))
            if should_exclude(rel, exclude):
                continue
            try:
                size = path.stat().st_size
            except OSError:
                continue
            if size > max_bytes:
                out.append(
                    Finding(
                        file_path=rel,
                        rule_id="compiled.engine.file_too_large",
                        severity="info",
                        title="文件过大已跳过",
                        description=(
                            f"文件大小 {size // (1024 * 1024)}MB 超过上限 {max_size_mb}MB，"
                            "已在扫描时跳过。可在创建任务时调高 max_binary_size_mb。"
                        ),
                        tool="compiled.engine",
                    )
                )
        return out

    def _dedupe(self, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[tuple[str, str, str]] = set()
        out: list[dict[str, Any]] = []
        for f in findings:
            key = (f["file_path"], f["rule_id"], f.get("code_snippet", ""))
            if key in seen:
                continue
            seen.add(key)
            out.append(f)
        return out
