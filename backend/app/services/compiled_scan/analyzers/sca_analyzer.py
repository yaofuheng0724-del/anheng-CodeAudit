"""Software-composition analysis: detect known-vulnerable library versions."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from app.services.compiled_scan.analyzers.base import CompiledAnalyzer, Finding
from app.services.compiled_scan.collector import COMPILED_EXTENSIONS

_RULES_DIR = Path(__file__).resolve().parent.parent / "rules"


def _version_key(version: str) -> tuple[int, ...]:
    parts = re.findall(r"\d+", version)
    return tuple(int(part) for part in parts) if parts else (0,)


def _version_matches(version: str, cve: dict[str, Any]) -> bool:
    if version in (cve.get("affected_versions") or []):
        return True

    current = _version_key(version)
    for raw_range in cve.get("affected_ranges") or []:
        range_text = str(raw_range).strip()
        if "-" in range_text and not range_text.startswith("-"):
            start, end = [part.strip() for part in range_text.split("-", 1)]
            if _version_key(start) <= current <= _version_key(end):
                return True
        elif range_text.startswith("<="):
            if current <= _version_key(range_text[2:].strip()):
                return True
        elif range_text.startswith("<"):
            if current < _version_key(range_text[1:].strip()):
                return True
    return False


class SCAAnalyzer(CompiledAnalyzer):
    name = "compiled.sca"
    supported_extensions = set(COMPILED_EXTENSIONS) - {".jar", ".war", ".ear", ".aar"}

    def __init__(self) -> None:
        with open(_RULES_DIR / "known_libs.yml", "r", encoding="utf-8") as fh:
            raw = yaml.safe_load(fh) or []
        self._libs = []
        for entry in raw:
            self._libs.append(
                {
                    **entry,
                    "_version_re": re.compile(entry["version_regex"]),
                }
            )

    def applies_to(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in self.supported_extensions

    def analyze(self, file_path: Path, options: dict[str, Any]) -> list[Finding]:
        if not options.get("enable_sca", True):
            return []

        try:
            blob = file_path.read_bytes()
        except OSError:
            return []

        try:
            text = blob.decode("latin-1", errors="ignore")
        except Exception:   # noqa: BLE001
            return []

        rel = str(file_path)
        findings: list[Finding] = []
        for entry in self._libs:
            if entry["string_match"] not in text:
                continue
            m = entry["_version_re"].search(text)
            version = m.group(1) if (m and m.groups()) else (m.group(0) if m else None)
            if not version:
                continue
            for cve in entry["cves"]:
                if not _version_matches(version, cve):
                    continue
                findings.append(
                    Finding(
                        file_path=rel,
                        rule_id=f"compiled.sca.{cve['id']}",
                        severity=cve["severity"],
                        title=cve["title"],
                        description=(
                            f"检测到 {entry['library']} 版本 {version}：" + cve["description"]
                        ),
                        suggestion=cve["suggestion"],
                        code_snippet=f"{entry['library']} {version}",
                        tool=self.name,
                    )
                )
        return findings
