import importlib.util
import json
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
QUICK_SCAN_PATH = REPO_ROOT / "backend" / "app" / "services" / "quick_scan.py"
SEMGREP_RULES_PATH = REPO_ROOT / "rules" / "semgrep" / "deepaudit-rules.yml"


def load_quick_scan():
    settings = SimpleNamespace(MAX_FILE_SIZE_BYTES=1024 * 1024)
    app_mod = types.ModuleType("app")
    core_mod = types.ModuleType("app.core")
    config_mod = types.ModuleType("app.core.config")
    config_mod.settings = settings
    with patch.dict(
        sys.modules,
        {
            "app": app_mod,
            "app.core": core_mod,
            "app.core.config": config_mod,
        },
    ):
        spec = importlib.util.spec_from_file_location("quick_scan_under_test", QUICK_SCAN_PATH)
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(module)
        return module


class QuickScanSecurityEngineTest(unittest.TestCase):
    def setUp(self):
        self.quick_scan = load_quick_scan()

    def _source_file(self, root: Path, relative_path: str, content: str):
        file_path = root / relative_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
        return {
            "path": relative_path,
            "absolute_path": str(file_path),
            "language": self.quick_scan.get_language_from_path(file_path),
            "size": file_path.stat().st_size,
            "line_count": 0,
        }

    def test_semgrep_rules_yaml_is_valid_and_declares_vulnerability_types(self):
        data = yaml.safe_load(SEMGREP_RULES_PATH.read_text(encoding="utf-8"))

        rules = data["rules"]
        by_id = {rule["id"]: rule for rule in rules}
        expected = {
            "deepaudit.java.sqli-statement-execute": "sql_injection",
            "deepaudit.java.xss-response-writer": "xss",
            "deepaudit.java.ssrf-resttemplate": "ssrf",
            "deepaudit.java.cmdi-runtime-exec": "command_injection",
            "deepaudit.java.path-traversal-file": "path_traversal",
            "deepaudit.java.hardcoded-password": "hardcoded_secret",
            "deepaudit.java.weak-crypto-hash": "weak_crypto",
            "deepaudit.java.resource-leak-stream": "resource_leak",
        }

        for rule_id, vuln_type in expected.items():
            self.assertIn(rule_id, by_id)
            self.assertEqual(by_id[rule_id]["metadata"]["vulnerability_type"], vuln_type)

    def test_pattern_scan_reports_required_vulnerability_types(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source_files = [
                self._source_file(
                    root,
                    "src/Vulnerable.java",
                    "\n".join(
                        [
                            'stmt.executeQuery("SELECT * FROM users WHERE id=" + request.getParameter("id"));',
                            'response.getWriter().write(request.getParameter("name"));',
                            'restTemplate.getForObject(request.getParameter("url"), String.class);',
                            'Runtime.getRuntime().exec("sh -c " + request.getParameter("cmd"));',
                            'new FileInputStream(request.getParameter("file"));',
                            'String password = "ProdPassword123!";',
                            'MessageDigest.getInstance("MD5");',
                            'InputStream in = new FileInputStream(path);',
                        ]
                    ),
                )
            ]

            findings = self.quick_scan.run_pattern_scan(source_files)
            by_type = {finding["issue_type"] for finding in findings}

        self.assertGreaterEqual(
            by_type,
            {
                "sql_injection",
                "xss",
                "ssrf",
                "command_injection",
                "path_traversal",
                "hardcoded_secret",
                "weak_crypto",
                "resource_leak",
            },
        )

    def test_pattern_scan_suppresses_common_false_positives(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source_files = [
                self._source_file(
                    root,
                    "src/Safe.java",
                    "\n".join(
                        [
                            'String algorithmName = "md5";',
                            'String password = "${DB_PASSWORD}";',
                            'String testPassword = "changeme";',
                            'try (InputStream in = new FileInputStream(path)) { return in.read(); }',
                            'InputStream stream = new FileInputStream(path);',
                            'stream.close();',
                        ]
                    ),
                )
            ]

            findings = self.quick_scan.run_pattern_scan(source_files)
            reported = {(finding["issue_type"], finding["line_number"]) for finding in findings}

        self.assertNotIn(("weak_crypto", 1), reported)
        self.assertNotIn(("hardcoded_secret", 2), reported)
        self.assertNotIn(("hardcoded_secret", 3), reported)
        self.assertNotIn(("resource_leak", 4), reported)
        self.assertNotIn(("resource_leak", 5), reported)

    def test_semgrep_metadata_maps_to_issue_type(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = self._source_file(root, "src/App.java", "Runtime.getRuntime().exec(cmd);\n")
            payload = {
                "results": [
                    {
                        "path": str(root / "src/App.java"),
                        "check_id": "deepaudit.java.cmdi-runtime-exec",
                        "start": {"line": 1, "col": 1},
                        "extra": {
                            "message": "command injection",
                            "severity": "ERROR",
                            "lines": "Runtime.getRuntime().exec(cmd);",
                            "metadata": {"vulnerability_type": "command_injection"},
                        },
                    }
                ]
            }
            completed = subprocess.CompletedProcess(
                args=["semgrep"],
                returncode=1,
                stdout=json.dumps(payload),
                stderr="",
            )

            with patch.object(self.quick_scan.shutil, "which", return_value="/usr/bin/semgrep"), \
                 patch.object(Path, "exists", return_value=True), \
                 patch.object(self.quick_scan.subprocess, "run", return_value=completed):
                findings = self.quick_scan.run_semgrep_scan(root, [source], rules_file=SEMGREP_RULES_PATH)

        self.assertEqual(findings[0]["issue_type"], "command_injection")


if __name__ == "__main__":
    unittest.main()
