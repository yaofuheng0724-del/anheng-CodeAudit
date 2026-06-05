from pathlib import Path

import pytest

from app.services.compiled_scan.analyzers.sca_analyzer import SCAAnalyzer

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "compiled"


def test_applies_to_all_compiled_extensions():
    a = SCAAnalyzer()
    for ext in (".so", ".dll", ".exe", ".elf", ".apk", ".dex", ".aab"):
        assert a.applies_to(Path(f"x{ext}"))


@pytest.mark.skipif(not (FIXTURES / "libssl-fake-1.0.0.so").exists(), reason="fixture missing")
def test_detects_openssl_heartbleed_in_fake_lib():
    a = SCAAnalyzer()
    findings = a.analyze(FIXTURES / "libssl-fake-1.0.0.so", {"enable_sca": True})
    rules = {f.rule_id for f in findings}
    assert "compiled.sca.CVE-2014-0160" in rules


def test_disabled_when_enable_sca_false(tmp_path: Path):
    f = tmp_path / "fake.so"
    f.write_bytes(b"... OpenSSL 1.0.0 ...")
    a = SCAAnalyzer()
    assert a.analyze(f, {"enable_sca": False}) == []


def test_no_findings_for_clean_binary(tmp_path: Path):
    f = tmp_path / "clean.so"
    f.write_bytes(b"nothing interesting here")
    a = SCAAnalyzer()
    assert a.analyze(f, {"enable_sca": True}) == []


def test_handles_unreadable_file(tmp_path: Path):
    a = SCAAnalyzer()
    assert a.analyze(tmp_path / "missing.so", {"enable_sca": True}) == []


def test_detects_zlib_cve_via_no_capture_group_regex(tmp_path: Path):
    """The zlib known_libs entry uses `1\\.2\\.\\d+` with no capture group,
    so the analyzer falls back to `m.group(0)` for the version. This test
    pins that fallback path."""
    f = tmp_path / "libz.so"
    f.write_bytes(b"... inflate 1.2.11 from zlib copyright ...")
    a = SCAAnalyzer()
    findings = a.analyze(f, {"enable_sca": True})
    rules = {finding.rule_id for finding in findings}
    assert "compiled.sca.CVE-2018-25032" in rules
