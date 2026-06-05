from pathlib import Path

from app.services.compiled_scan.analyzers.base import (
    CompiledAnalyzer,
    Finding,
)


def test_finding_to_dict_returns_scanner_compatible_keys():
    f = Finding(
        file_path="libs/libfoo.so",
        rule_id="compiled.binary.dangerous_func.strcpy",
        severity="medium",
        title="使用了危险函数 strcpy",
        description="二进制导入了 strcpy 符号,可能存在缓冲区溢出风险。",
        suggestion="改用 strncpy/strlcpy 并校验长度。",
        code_snippet="DYN SYMBOL: strcpy",
        tool="compiled.binary",
        line_number=0,
    )
    d = f.to_dict()
    assert d["file_path"] == "libs/libfoo.so"
    assert d["rule_id"] == "compiled.binary.dangerous_func.strcpy"
    assert d["line_number"] == 0
    assert d["severity"] == "medium"
    assert d["tool"] == "compiled.binary"


def test_compiled_analyzer_is_abstract():
    import pytest

    with pytest.raises(TypeError):
        CompiledAnalyzer()  # type: ignore[abstract]


class _DummyAnalyzer(CompiledAnalyzer):
    name = "dummy"
    supported_extensions = {".xyz"}

    def applies_to(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in self.supported_extensions

    def analyze(self, file_path: Path, options: dict) -> list[Finding]:
        return []


def test_applies_to_matches_extension():
    a = _DummyAnalyzer()
    assert a.applies_to(Path("a/b.xyz"))
    assert not a.applies_to(Path("a/b.txt"))
