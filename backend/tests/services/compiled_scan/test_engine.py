from pathlib import Path

import pytest

from app.services.compiled_scan.engine import CompiledScanEngine

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "compiled"


def test_scan_empty_workspace_returns_empty(tmp_path: Path):
    engine = CompiledScanEngine()
    assert engine.scan(tmp_path, {}) == []


@pytest.mark.skipif(not (FIXTURES / "hello.elf").exists(), reason="fixture missing")
def test_scan_workspace_with_elf_returns_findings(tmp_path: Path):
    (tmp_path / "hello.elf").write_bytes((FIXTURES / "hello.elf").read_bytes())
    engine = CompiledScanEngine()
    findings = engine.scan(tmp_path, {"enable_sca": True})
    assert any(f["rule_id"] == "compiled.binary.dangerous_func.strcpy" for f in findings)


def test_engine_returns_dict_shape_compatible_with_persistence(tmp_path: Path):
    # Forge a fake .so with an AKIA key so BinaryAnalyzer fires on it.
    (tmp_path / "x.so").write_bytes(b"junk-AKIAIOSFODNN7EXAMPLE-tail")
    engine = CompiledScanEngine()
    findings = engine.scan(tmp_path, {})
    assert findings, "expected at least one finding"
    for f in findings:
        # Persistence layer reads these keys (scanner.py:482-509).
        assert "file_path" in f
        assert "rule_id" in f
        assert "severity" in f
        assert "title" in f
        assert "description" in f


def test_dedup_collapses_duplicate_findings(tmp_path: Path):
    """Two analyzers may produce the same secret-pattern hit on the same file."""
    (tmp_path / "x.so").write_bytes(b"junk-AKIAIOSFODNN7EXAMPLE-tail")
    engine = CompiledScanEngine()
    findings = engine.scan(tmp_path, {})
    keys = [(f["file_path"], f["rule_id"]) for f in findings]
    assert len(keys) == len(set(keys))


def test_oversized_file_produces_info_finding(tmp_path: Path):
    big = tmp_path / "huge.so"
    big.write_bytes(b"\x00" * (3 * 1024 * 1024))
    engine = CompiledScanEngine()
    findings = engine.scan(tmp_path, {"max_binary_size_mb": 2})
    assert any(f["rule_id"] == "compiled.engine.file_too_large" for f in findings)
