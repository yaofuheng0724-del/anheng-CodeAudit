"""Analyzer for Android artifacts: .apk / .aab / .dex."""
from __future__ import annotations

import re
import zipfile
from pathlib import Path
from typing import Any

import yaml

from app.services.compiled_scan.analyzers.base import CompiledAnalyzer, Finding

_RULES_DIR = Path(__file__).resolve().parent.parent / "rules"
_PRINTABLE_RE = re.compile(rb"[\x20-\x7e]{6,}")    # ASCII printable runs, length >= 6


def _load_yaml(name: str) -> list[dict]:
    with open(_RULES_DIR / name, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or []


class ApkAnalyzer(CompiledAnalyzer):
    name = "compiled.apk"
    supported_extensions = {".apk", ".aab", ".dex"}

    def __init__(self) -> None:
        self._permissions = {rule["name"]: rule for rule in _load_yaml("android_permissions.yml")}
        self._secrets = [
            {**rule, "_compiled": re.compile(rule["pattern"])}
            for rule in _load_yaml("secret_patterns.yml")
        ]

    def applies_to(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in self.supported_extensions

    def analyze(self, file_path: Path, options: dict[str, Any]) -> list[Finding]:
        rel = str(file_path)
        findings: list[Finding] = []

        # DEX alone: only do string extraction (no manifest available).
        if file_path.suffix.lower() == ".dex":
            findings.extend(self._scan_dex(file_path, rel))
            return findings

        try:
            permissions = self._extract_permissions(file_path)
        except Exception as exc:   # noqa: BLE001
            findings.append(
                Finding(
                    file_path=rel,
                    rule_id="compiled.apk.parse_failed",
                    severity="info",
                    title="APK/AAB 解析失败",
                    description=f"androguard 无法解析此文件：{exc}",
                    tool=self.name,
                )
            )
            permissions = []

        for perm in permissions:
            short = perm.rsplit(".", 1)[-1]
            rule = self._permissions.get(short)
            if not rule:
                continue
            findings.append(
                Finding(
                    file_path=rel,
                    rule_id=f"compiled.apk.permission.{short}",
                    severity=rule["severity"],
                    title=rule["title"],
                    description=rule["description"],
                    suggestion=rule["suggestion"],
                    code_snippet=f"<uses-permission android:name=\"{perm}\"/>",
                    tool=self.name,
                )
            )

        # Pull printable strings from any embedded resource files inside the zip.
        try:
            strings = self._extract_apk_strings(file_path)
        except (OSError, zipfile.BadZipFile):
            strings = []

        for rule in self._secrets:
            for s in strings:
                if rule["_compiled"].search(s):
                    findings.append(
                        Finding(
                            file_path=rel,
                            rule_id=f"compiled.apk.secret.{rule['name']}",
                            severity=rule["severity"],
                            title=rule["title"],
                            description=rule["description"],
                            suggestion=rule["suggestion"],
                            code_snippet=s[:120],
                            tool=self.name,
                        )
                    )
                    break

        return findings

    # ----- helpers ---------------------------------------------------------

    def _extract_permissions(self, file_path: Path) -> list[str]:
        # androguard imports are heavy and noisy on stderr; keep them local.
        from androguard.core.apk import APK

        apk = APK(str(file_path))
        return list(apk.get_permissions())

    def _extract_apk_strings(self, file_path: Path) -> list[str]:
        out: list[str] = []
        with zipfile.ZipFile(file_path) as zf:
            for info in zf.infolist():
                if info.file_size > 5 * 1024 * 1024:   # skip resources > 5MB
                    continue
                try:
                    blob = zf.read(info)
                except (RuntimeError, zipfile.BadZipFile):
                    continue
                for m in _PRINTABLE_RE.finditer(blob):
                    out.append(m.group(0).decode("ascii", errors="ignore"))
                    if len(out) >= 5000:   # bounded memory: cap is per-file (across all entries)
                        return out
        return out

    def _scan_dex(self, file_path: Path, rel: str) -> list[Finding]:
        try:
            blob = file_path.read_bytes()
        except OSError:
            return []
        findings: list[Finding] = []
        for rule in self._secrets:
            for m in _PRINTABLE_RE.finditer(blob):
                s = m.group(0).decode("ascii", errors="ignore")
                if rule["_compiled"].search(s):
                    findings.append(
                        Finding(
                            file_path=rel,
                            rule_id=f"compiled.apk.secret.{rule['name']}",
                            severity=rule["severity"],
                            title=rule["title"],
                            description=rule["description"],
                            suggestion=rule["suggestion"],
                            code_snippet=s[:120],
                            tool=self.name,
                        )
                    )
                    break
        return findings
