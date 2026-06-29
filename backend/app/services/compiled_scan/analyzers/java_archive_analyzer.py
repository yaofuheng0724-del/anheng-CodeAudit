"""Analyzer for Java archive artifacts: .jar / .war / .ear / .aar."""
from __future__ import annotations

import re
import zipfile
from pathlib import Path
from typing import Any

import yaml

from app.services.compiled_scan.analyzers.base import CompiledAnalyzer, Finding

_RULES_DIR = Path(__file__).resolve().parent.parent / "rules"
_PRINTABLE_RE = re.compile(rb"[\x20-\x7e]{6,}")
_DEPENDENCY_JAR_RE = re.compile(
    r"(?P<artifact>[A-Za-z0-9_.-]+)-(?P<version>\d+(?:[.\-_][A-Za-z0-9]+)+)\.jar$",
    re.IGNORECASE,
)
_MAX_ENTRY_BYTES = 5 * 1024 * 1024
_MAX_STRINGS = 8000


def _load_yaml(name: str) -> list[dict]:
    with open(_RULES_DIR / name, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or []


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


class JavaArchiveAnalyzer(CompiledAnalyzer):
    name = "compiled.java_archive"
    supported_extensions = {".jar", ".war", ".ear", ".aar"}

    def __init__(self) -> None:
        raw_libs = _load_yaml("known_libs.yml")
        self._libs = []
        for entry in raw_libs:
            aliases = {
                str(entry.get("library", "")).lower(),
                str(entry.get("string_match", "")).lower(),
                *(str(alias).lower() for alias in entry.get("aliases", []) or []),
            }
            self._libs.append(
                {
                    **entry,
                    "_aliases": {alias for alias in aliases if alias},
                    "_version_re": re.compile(entry["version_regex"], re.IGNORECASE),
                }
            )
        self._secrets = [
            {**rule, "_compiled": re.compile(rule["pattern"])}
            for rule in _load_yaml("secret_patterns.yml")
        ]

    def applies_to(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in self.supported_extensions

    def analyze(self, file_path: Path, options: dict[str, Any]) -> list[Finding]:
        rel = str(file_path)
        findings: list[Finding] = []

        try:
            with zipfile.ZipFile(file_path) as zf:
                entries = [info for info in zf.infolist() if not info.is_dir()]
                findings.extend(self._scan_dependencies(zf, entries, rel))
                findings.extend(self._scan_strings(zf, entries, rel))
        except zipfile.BadZipFile as exc:
            return [
                Finding(
                    file_path=rel,
                    rule_id="compiled.java_archive.parse_failed",
                    severity="info",
                    title="Java 归档解析失败",
                    description=f"无法按 zip/jar 格式解析此文件：{exc}",
                    tool=self.name,
                )
            ]
        except OSError as exc:
            return [
                Finding(
                    file_path=rel,
                    rule_id="compiled.java_archive.read_failed",
                    severity="info",
                    title="Java 归档读取失败",
                    description=str(exc),
                    tool=self.name,
                )
            ]

        return findings

    def _scan_dependencies(
        self,
        zf: zipfile.ZipFile,
        entries: list[zipfile.ZipInfo],
        archive_path: str,
    ) -> list[Finding]:
        findings: list[Finding] = []
        dependencies = self._collect_dependencies(zf, entries)
        emitted: set[tuple[str, str, str]] = set()

        for dep in dependencies:
            artifact = dep["artifact"].lower()
            version = dep["version"]
            source = dep["source"]
            for entry in self._libs:
                if artifact not in entry["_aliases"]:
                    continue
                for cve in entry.get("cves", []) or []:
                    if not _version_matches(version, cve):
                        continue
                    emit_key = (entry["library"], version, cve["id"])
                    if emit_key in emitted:
                        continue
                    emitted.add(emit_key)
                    findings.append(
                        Finding(
                            file_path=f"{archive_path}!/{source}",
                            rule_id=f"compiled.java_archive.{cve['id']}",
                            severity=cve["severity"],
                            title=cve["title"],
                            description=(
                                f"检测到 {entry['library']} 版本 {version}："
                                + cve["description"]
                            ),
                            suggestion=cve["suggestion"],
                            code_snippet=f"{dep['artifact']} {version}",
                            tool=self.name,
                        )
                    )

        archive_strings = "\n".join(
            f"{dep['artifact']} {dep['version']} {dep['source']}" for dep in dependencies
        )
        for entry in self._libs:
            if entry.get("string_match") and entry["string_match"] not in archive_strings:
                continue
            match = entry["_version_re"].search(archive_strings)
            version = match.group(1) if (match and match.groups()) else (match.group(0) if match else None)
            if not version:
                continue
            for cve in entry.get("cves", []) or []:
                if _version_matches(version, cve):
                    emit_key = (entry["library"], version, cve["id"])
                    if emit_key in emitted:
                        continue
                    emitted.add(emit_key)
                    findings.append(
                        Finding(
                            file_path=archive_path,
                            rule_id=f"compiled.java_archive.{cve['id']}",
                            severity=cve["severity"],
                            title=cve["title"],
                            description=(
                                f"检测到 {entry['library']} 版本 {version}："
                                + cve["description"]
                            ),
                            suggestion=cve["suggestion"],
                            code_snippet=f"{entry['library']} {version}",
                            tool=self.name,
                        )
                    )
        return findings

    def _collect_dependencies(
        self,
        zf: zipfile.ZipFile,
        entries: list[zipfile.ZipInfo],
    ) -> list[dict[str, str]]:
        dependencies: list[dict[str, str]] = []
        seen: set[tuple[str, str, str]] = set()

        def add(artifact: str, version: str, source: str) -> None:
            artifact = artifact.strip()
            version = version.strip()
            if not artifact or not version:
                return
            key = (artifact.lower(), version, source)
            if key in seen:
                return
            seen.add(key)
            dependencies.append({"artifact": artifact, "version": version, "source": source})

        for info in entries:
            name = info.filename
            match = _DEPENDENCY_JAR_RE.search(Path(name).name)
            if match:
                add(match.group("artifact"), match.group("version").replace("_", "."), name)

            lowered = name.lower()
            if lowered.endswith("pom.properties") and info.file_size <= _MAX_ENTRY_BYTES:
                props = self._read_text_entry(zf, info)
                artifact = self._read_property(props, "artifactId")
                version = self._read_property(props, "version")
                if artifact and version:
                    add(artifact, version, name)
            elif lowered.endswith("manifest.mf") and info.file_size <= _MAX_ENTRY_BYTES:
                manifest = self._read_text_entry(zf, info)
                title = self._read_property(manifest, "Implementation-Title")
                version = self._read_property(manifest, "Implementation-Version")
                if title and version:
                    add(title, version, name)

        return dependencies

    def _scan_strings(
        self,
        zf: zipfile.ZipFile,
        entries: list[zipfile.ZipInfo],
        archive_path: str,
    ) -> list[Finding]:
        strings: list[tuple[str, str]] = []
        for info in entries:
            if info.file_size > _MAX_ENTRY_BYTES:
                continue
            try:
                blob = zf.read(info)
            except (RuntimeError, zipfile.BadZipFile):
                continue
            for match in _PRINTABLE_RE.finditer(blob):
                strings.append((info.filename, match.group(0).decode("ascii", errors="ignore")))
                if len(strings) >= _MAX_STRINGS:
                    break
            if len(strings) >= _MAX_STRINGS:
                break

        findings: list[Finding] = []
        for rule in self._secrets:
            for entry_name, value in strings:
                if not rule["_compiled"].search(value):
                    continue
                findings.append(
                    Finding(
                        file_path=f"{archive_path}!/{entry_name}",
                        rule_id=f"compiled.java_archive.secret.{rule['name']}",
                        severity=rule["severity"],
                        title=rule["title"],
                        description=rule["description"],
                        suggestion=rule["suggestion"],
                        code_snippet=value[:120],
                        tool=self.name,
                    )
                )
                break
        return findings

    def _read_text_entry(self, zf: zipfile.ZipFile, info: zipfile.ZipInfo) -> str:
        try:
            return zf.read(info).decode("utf-8", errors="ignore")
        except (RuntimeError, zipfile.BadZipFile):
            return ""

    def _read_property(self, text: str, key: str) -> str | None:
        for line in text.splitlines():
            if line.startswith(f"{key}:"):
                return line.split(":", 1)[1].strip()
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip()
        return None
