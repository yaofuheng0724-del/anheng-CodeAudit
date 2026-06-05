"""Base abstractions for compiled-artifact analyzers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Finding:
    """One finding produced by a compiled-artifact analyzer.

    Field names mirror what `scan_local_workspace` reads when persisting
    `AuditIssue` rows in backend/app/services/scanner.py:482-509, so the
    same persistence loop can ingest these without adapter code.
    """

    file_path: str
    rule_id: str
    severity: str           # "info" | "low" | "medium" | "high" | "critical"
    title: str
    description: str
    suggestion: str = ""
    code_snippet: str = ""
    tool: str = "compiled"
    line_number: int = 0    # 0 means "non-line-based locator"
    column_number: int | None = None
    issue_type: str = "security"
    source: str | None = None
    sink: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        # Flatten `extra` into the top-level dict so persistence layer sees a flat shape.
        extra = d.pop("extra")
        d.update(extra)
        return d


class CompiledAnalyzer(ABC):
    """Abstract base class for one compiled-artifact analyzer."""

    name: str = ""
    supported_extensions: set[str] = set()

    @abstractmethod
    def applies_to(self, file_path: Path) -> bool:
        """Return True if this analyzer should be run on `file_path`."""

    @abstractmethod
    def analyze(self, file_path: Path, options: dict[str, Any]) -> list[Finding]:
        """Analyze `file_path` and return a list of findings."""
