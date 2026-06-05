"""IaC Semgrep 规则集成测试 - 验证规则触发与未误报。"""
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

def _default_rules_path() -> Path:
    parents = Path(__file__).resolve().parents
    if len(parents) >= 4:
        return parents[3] / "rules" / "semgrep" / "iac-rules.yml"
    return Path("rules/semgrep/iac-rules.yml")


RULES_PATH = Path(os.environ.get("IAC_RULES_PATH", str(_default_rules_path())))
FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def semgrep_findings() -> dict:
    """对 fixtures 目录跑一次 IaC 规则集，返回 rule_id -> [file_path, ...]。"""
    if not shutil.which("semgrep"):
        pytest.skip("semgrep CLI 未安装")
    if not RULES_PATH.exists():
        pytest.skip(f"规则文件不存在: {RULES_PATH}")
    result = subprocess.run(
        ["semgrep", "scan", "--json", "--quiet", "--config", str(RULES_PATH), str(FIXTURES)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert result.returncode in (0, 1), result.stderr
    payload = json.loads(result.stdout or "{}")
    findings: dict = {}
    for item in payload.get("results", []):
        # semgrep 会按规则文件名给 check_id 加前缀（例如 'tmp.IAC-CTR-001'）
        # 这里只取最后一段，便于断言。
        raw_id = item["check_id"]
        normalized = raw_id.rsplit(".", 1)[-1]
        findings.setdefault(normalized, []).append(item["path"])
    return findings


EXPECTED_BAD_HITS = [
    ("IAC-CTR-001", "Dockerfile.bad"),
    ("IAC-CTR-002", "Dockerfile.bad"),
    ("IAC-CTR-003", "Dockerfile.bad"),
    ("IAC-CTR-004", "Dockerfile.bad"),
    ("IAC-ORC-001", "docker-compose.bad.yml"),
    ("IAC-ORC-002", "docker-compose.bad.yml"),
    ("IAC-ORC-003", "docker-compose.bad.yml"),
    ("IAC-CI-001", "bad.yml"),
    ("IAC-CI-002", "bad.yml"),
    ("IAC-CI-003", "bad.yml"),
]


@pytest.mark.parametrize("rule_id,filename", EXPECTED_BAD_HITS)
def test_bad_fixture_triggers_rule(semgrep_findings, rule_id, filename):
    hits = semgrep_findings.get(rule_id, [])
    assert any(filename in p for p in hits), f"{rule_id} 未在 {filename} 中触发，命中={hits}"


GOOD_FILES = ["Dockerfile.good", "docker-compose.good.yml", "good.yml"]


def test_good_fixtures_do_not_trigger(semgrep_findings):
    for rule_id, hits in semgrep_findings.items():
        for path in hits:
            for good in GOOD_FILES:
                assert good not in path, f"规则 {rule_id} 在 good 样本 {path} 误报"
