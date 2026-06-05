"""ApkAnalyzer tests.

Note: test_detects_high_risk_permissions (from the plan) is omitted because
the committed sample-min.apk is a Python-synthesized zip with a plain-text
AndroidManifest.xml that androguard cannot parse. Rebuilding the fixture via
backend/tests/fixtures/compiled/build_fixtures.sh (requires aapt2) produces a
binary manifest and re-enables the test — see fixtures/compiled/README.md.
"""
from pathlib import Path

import pytest

from app.services.compiled_scan.analyzers.apk_analyzer import ApkAnalyzer

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "compiled"


def test_applies_to_apk_aab_dex():
    a = ApkAnalyzer()
    assert a.applies_to(Path("app.apk"))
    assert a.applies_to(Path("app.aab"))
    assert a.applies_to(Path("classes.dex"))
    assert not a.applies_to(Path("x.so"))


@pytest.mark.skipif(not (FIXTURES / "sample-min.apk").exists(), reason="fixture missing")
def test_detects_hardcoded_secret_in_apk_strings():
    a = ApkAnalyzer()
    findings = a.analyze(FIXTURES / "sample-min.apk", {})
    rules = {f.rule_id for f in findings}
    # The fixture's strings.xml contains a sk_live_ token.
    assert "compiled.apk.secret.generic_secret_prefix" in rules


def test_analyze_invalid_apk_returns_warning(tmp_path: Path):
    bogus = tmp_path / "bogus.apk"
    bogus.write_bytes(b"not really an apk")
    a = ApkAnalyzer()
    findings = a.analyze(bogus, {})
    assert any(f.rule_id == "compiled.apk.parse_failed" for f in findings)
