"""Top-level orchestrator for compiled-artifact scanning."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.services.compiled_scan.analyzers.apk_analyzer import ApkAnalyzer
from app.services.compiled_scan.analyzers.base import CompiledAnalyzer, Finding
from app.services.compiled_scan.analyzers.binary_analyzer import BinaryAnalyzer
from app.services.compiled_scan.analyzers.java_archive_analyzer import JavaArchiveAnalyzer
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
            JavaArchiveAnalyzer(),
            BinaryAnalyzer(),
            SCAAnalyzer(),
        ]

    def scan(self, workspace_dir: str | Path, options: dict[str, Any]) -> list[dict[str, Any]]:
        """Scan `workspace_dir`. Returns a list of finding dicts ready to persist."""
        return self.scan_with_metrics(workspace_dir, options)["findings"]

    def scan_with_metrics(self, workspace_dir: str | Path, options: dict[str, Any]) -> dict[str, Any]:
        """Scan `workspace_dir` and return findings plus accounting metrics."""
        exclude = (options or {}).get("exclude_patterns", []) or []
        max_size = (options or {}).get("max_binary_size_mb", DEFAULT_MAX_SIZE_MB)
        workspace = Path(workspace_dir)

        # 1. Emit info findings for over-sized files BEFORE filtering them out.
        oversize = self._find_oversize_files(workspace_dir, exclude, max_size)
        findings: list[Finding] = oversize

        # 2. Collect in-range artifacts and dispatch to analyzers.
        artifacts = collect_compiled_artifacts(
            workspace_dir,
            exclude_patterns=exclude,
            max_size_mb=max_size,
        )
        metrics = {
            "artifact_count": len(artifacts),
            "internal_file_count": 0,
            "dependency_count": 0,
            "metadata_count": 0,
            "class_count": 0,
            "resource_count": 0,
            "scanned_file_count": 0,
        }
        for artifact in artifacts:
            path = Path(artifact["absolute_path"])
            artifact_units = 1
            for analyzer in self.analyzers:
                if not analyzer.applies_to(path):
                    continue
                analyzer_options = {
                    **(options or {}),
                    "display_path": artifact["relative_path"],
                }
                analyzer_metrics = analyzer.collect_metrics(path, analyzer_options)
                if analyzer_metrics:
                    for key in ("internal_file_count", "dependency_count", "metadata_count", "class_count", "resource_count"):
                        metrics[key] += int(analyzer_metrics.get(key) or 0)
                    artifact_units = max(artifact_units, int(analyzer_metrics.get("internal_file_count") or 0) or 1)
                try:
                    analyzer_findings = analyzer.analyze(path, analyzer_options)
                    for finding in analyzer_findings:
                        finding.file_path = self._normalize_finding_path(finding.file_path, workspace)
                    findings.extend(analyzer_findings)
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
            metrics["scanned_file_count"] += artifact_units

        deduped = self._dedupe([f.to_dict() for f in findings])
        return {"findings": deduped, "metrics": metrics}

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

    def _normalize_finding_path(self, file_path: str, workspace: Path) -> str:
        marker = "!/"
        outer_path = file_path
        inner_path = ""
        if marker in file_path:
            outer_path, inner_path = file_path.split(marker, 1)

        path = Path(outer_path)
        if path.is_absolute():
            try:
                outer_path = path.relative_to(workspace).as_posix()
            except ValueError:
                outer_path = path.name
        else:
            outer_path = outer_path.replace("\\", "/")

        if inner_path:
            normalized_inner = inner_path.replace("\\", "/")
            return f"{outer_path}{marker}{normalized_inner}"
        return outer_path
