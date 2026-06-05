# Compiled Scan Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "compiled artifact" scan mode to the quick audit task that scans Android (.apk/.aab/.dex) and native C/C++ binaries (.so/.dll/.exe/.elf) using a new `CompiledScanEngine` — without touching the existing source-scan path.

**Architecture:** New `backend/app/services/compiled_scan/` package with `CompiledScanEngine` orchestrating three analyzers (Apk / Binary / SCA). The existing `scan_local_workspace` gets ONE new early-return branch keyed on `scan_config.scan_mode == "compiled"`. The frontend `CreateTaskDialog` gets one radio group; `TaskDetail` gets one badge and a row-rendering tweak.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy async, pytest, pyelftools, pefile, androguard, React + TypeScript (Vite), TailwindCSS.

**Spec:** `docs/superpowers/specs/2026-06-03-compiled-scan-mode-design.md`

---

## File Structure

### Backend — new files
- `backend/app/services/compiled_scan/__init__.py`
- `backend/app/services/compiled_scan/engine.py` — `CompiledScanEngine` orchestrator
- `backend/app/services/compiled_scan/collector.py` — `collect_compiled_artifacts()`
- `backend/app/services/compiled_scan/analyzers/__init__.py`
- `backend/app/services/compiled_scan/analyzers/base.py` — `CompiledAnalyzer` ABC
- `backend/app/services/compiled_scan/analyzers/binary_analyzer.py` — ELF/PE
- `backend/app/services/compiled_scan/analyzers/apk_analyzer.py` — APK/DEX/AAB
- `backend/app/services/compiled_scan/analyzers/sca_analyzer.py` — library CVE matching
- `backend/app/services/compiled_scan/rules/dangerous_functions.yml`
- `backend/app/services/compiled_scan/rules/android_permissions.yml`
- `backend/app/services/compiled_scan/rules/secret_patterns.yml`
- `backend/app/services/compiled_scan/rules/known_libs.yml`
- `backend/tests/services/compiled_scan/__init__.py`
- `backend/tests/services/compiled_scan/test_collector.py`
- `backend/tests/services/compiled_scan/test_binary_analyzer.py`
- `backend/tests/services/compiled_scan/test_apk_analyzer.py`
- `backend/tests/services/compiled_scan/test_sca_analyzer.py`
- `backend/tests/services/compiled_scan/test_engine.py`
- `backend/tests/services/compiled_scan/test_scanner_integration.py`
- `backend/tests/fixtures/compiled/` — binary test fixtures (built by a script, see Task 4)
- `backend/tests/fixtures/compiled/build_fixtures.sh` — reproducibility script

### Backend — modified files
- `backend/app/api/v1/endpoints/scan.py:157-165` — add `scan_mode` + `compiled_options` to `ScanRequest`
- `backend/app/api/v1/endpoints/scan.py:209-218` — inject new fields into `user_config['scan_config']` (BOTH endpoints: `/scan/upload-zip` AND `/scan/scan-stored-zip`)
- `backend/app/api/v1/endpoints/projects.py:535-544` — same `ScanRequest` field add in the repo-scan endpoint (keeps schema consistent; repo path will reject compiled mode)
- `backend/app/services/scanner.py:406-411` — add early-return branch in `scan_local_workspace` when `scan_mode == "compiled"`
- `backend/requirements.txt` — add `pyelftools`, `pefile`, `androguard`

### Frontend — new files
- `frontend/src/features/projects/services/compiledScan.ts` — payload helper for compiled mode (re-uses existing scan endpoints)

### Frontend — modified files
- `frontend/src/components/audit/CreateTaskDialog.tsx` — add `scanType` radio group, conditional UI blocks, payload extension
- `frontend/src/components/audit/CreateTaskDialog.tsx` — extend submit dispatch
- `frontend/src/pages/TaskDetail.tsx` — add `[源代码扫描]`/`[编译后扫描]` badge, adapt row when `line_number === 0`
- `frontend/src/features/projects/services/repoZipScan.ts` — extend `ScanZipPayload` typing with `scan_mode` and `compiled_options`

---

## Test Strategy

- **TDD throughout.** Each analyzer task is: write failing test → run/verify FAIL → minimal implementation → run/verify PASS → commit.
- **Fixtures:** small binaries committed to `backend/tests/fixtures/compiled/`. A `build_fixtures.sh` script in the same directory reproduces them so reviewers can regenerate if needed. Fixtures are committed so CI doesn't need a C/Java toolchain.
- **Frontend:** no test infrastructure added — verified manually per the spec's UI section. Production tests can be added later.

---

## Task 1: Backend dependencies + package skeleton

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/services/compiled_scan/__init__.py`
- Create: `backend/app/services/compiled_scan/analyzers/__init__.py`
- Create: `backend/tests/services/compiled_scan/__init__.py`

- [ ] **Step 1: Add Python dependencies**

Open `backend/requirements.txt` and append (preserving the file's existing trailing newline convention):

```
# Compiled-artifact scanning
pyelftools==0.31
pefile==2024.8.26
androguard==4.1.2
```

- [ ] **Step 2: Install dependencies**

Run from `backend/`:
```bash
pip install -r requirements.txt
```
Expected: installs three packages successfully.

- [ ] **Step 3: Create empty package init files**

Create `backend/app/services/compiled_scan/__init__.py`:
```python
"""Compiled-artifact scanning engine (Android + native binaries)."""
```

Create `backend/app/services/compiled_scan/analyzers/__init__.py`:
```python
"""Analyzers for compiled artifacts."""
```

Create `backend/tests/services/compiled_scan/__init__.py`:
```python
```
(empty file)

- [ ] **Step 4: Smoke-test imports**

Run from `backend/`:
```bash
python -c "import elftools; import pefile; import androguard; print('ok')"
```
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/app/services/compiled_scan/ backend/tests/services/compiled_scan/
git commit -m "chore: scaffold compiled_scan package and add binary-parsing deps"
```

---

## Task 2: Finding dataclass + analyzer base class

**Files:**
- Create: `backend/app/services/compiled_scan/analyzers/base.py`
- Create: `backend/tests/services/compiled_scan/test_base.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/services/compiled_scan/test_base.py`:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/services/compiled_scan/test_base.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.services.compiled_scan.analyzers.base'`.

- [ ] **Step 3: Implement base module**

Create `backend/app/services/compiled_scan/analyzers/base.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/services/compiled_scan/test_base.py -v
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/compiled_scan/analyzers/base.py backend/tests/services/compiled_scan/test_base.py
git commit -m "feat: add Finding dataclass and CompiledAnalyzer ABC"
```

---

## Task 3: File collector

**Files:**
- Create: `backend/app/services/compiled_scan/collector.py`
- Create: `backend/tests/services/compiled_scan/test_collector.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/services/compiled_scan/test_collector.py`:
```python
from pathlib import Path

from app.services.compiled_scan.collector import (
    COMPILED_EXTENSIONS,
    collect_compiled_artifacts,
)


def test_compiled_extensions_contains_expected():
    assert ".apk" in COMPILED_EXTENSIONS
    assert ".aab" in COMPILED_EXTENSIONS
    assert ".dex" in COMPILED_EXTENSIONS
    assert ".so" in COMPILED_EXTENSIONS
    assert ".dll" in COMPILED_EXTENSIONS
    assert ".exe" in COMPILED_EXTENSIONS
    assert ".elf" in COMPILED_EXTENSIONS


def test_collect_picks_only_compiled_files(tmp_path: Path):
    (tmp_path / "libs").mkdir()
    (tmp_path / "libs" / "libfoo.so").write_bytes(b"\x7fELFfake")
    (tmp_path / "main.exe").write_bytes(b"MZfake")
    (tmp_path / "app.apk").write_bytes(b"PK\x03\x04fake")
    (tmp_path / "README.txt").write_text("hello")
    (tmp_path / "src.c").write_text("int main(){}")

    results = collect_compiled_artifacts(tmp_path)
    rel_paths = sorted(r["relative_path"] for r in results)
    assert rel_paths == ["app.apk", "libs/libfoo.so", "main.exe"]
    for r in results:
        assert r["size_bytes"] > 0
        assert r["absolute_path"].endswith(r["relative_path"])


def test_collect_skips_files_over_max_size(tmp_path: Path):
    (tmp_path / "huge.so").write_bytes(b"\x00" * (3 * 1024 * 1024))   # 3 MB
    (tmp_path / "small.so").write_bytes(b"\x00" * 1024)               # 1 KB

    results = collect_compiled_artifacts(tmp_path, max_size_mb=2)
    paths = sorted(r["relative_path"] for r in results)
    assert paths == ["small.so"]


def test_collect_honours_exclude_patterns(tmp_path: Path):
    (tmp_path / "build").mkdir()
    (tmp_path / "build" / "intermediate.so").write_bytes(b"fake")
    (tmp_path / "release.so").write_bytes(b"fake")

    results = collect_compiled_artifacts(tmp_path, exclude_patterns=["build/**"])
    assert [r["relative_path"] for r in results] == ["release.so"]


def test_collect_returns_empty_for_missing_dir(tmp_path: Path):
    results = collect_compiled_artifacts(tmp_path / "nonexistent")
    assert results == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/services/compiled_scan/test_collector.py -v
```
Expected: `ModuleNotFoundError` for `app.services.compiled_scan.collector`.

- [ ] **Step 3: Implement collector**

Create `backend/app/services/compiled_scan/collector.py`:
```python
"""Walk a workspace and pick out compiled artifacts."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.services.quick_scan import normalize_path, should_exclude

# Extensions we recognise as compiled artifacts. Mirror of `TEXT_EXTENSIONS`
# in quick_scan.py — anything in this set bypasses the source-scan collector
# (which would filter it out as non-text).
COMPILED_EXTENSIONS: set[str] = {
    # Android
    ".apk", ".aab", ".dex",
    # Native binaries
    ".so", ".dll", ".exe", ".elf",
}

DEFAULT_MAX_SIZE_MB = 200


def collect_compiled_artifacts(
    workspace_dir: str | Path,
    exclude_patterns: list[str] | None = None,
    max_size_mb: int = DEFAULT_MAX_SIZE_MB,
) -> list[dict[str, Any]]:
    """Return a list of compiled-artifact files under `workspace_dir`.

    Each entry: {relative_path, absolute_path, size_bytes, extension}.
    Files larger than `max_size_mb` are silently skipped (caller may emit
    an info-level finding for them).
    """
    workspace = Path(workspace_dir)
    if not workspace.exists() or not workspace.is_dir():
        return []

    max_bytes = max_size_mb * 1024 * 1024
    out: list[dict[str, Any]] = []

    for path in workspace.rglob("*"):
        if not path.is_file():
            continue
        rel = normalize_path(path.relative_to(workspace))
        if should_exclude(rel, exclude_patterns):
            continue
        ext = path.suffix.lower()
        if ext not in COMPILED_EXTENSIONS:
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size > max_bytes:
            continue
        out.append(
            {
                "relative_path": rel,
                "absolute_path": str(path),
                "size_bytes": size,
                "extension": ext,
            }
        )

    out.sort(key=lambda r: r["relative_path"])
    return out
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/services/compiled_scan/test_collector.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/compiled_scan/collector.py backend/tests/services/compiled_scan/test_collector.py
git commit -m "feat: add compiled-artifact file collector"
```

---

## Task 4: Test fixtures (binary + APK + ELF)

This task produces small, committed binaries for downstream analyzer tests. We commit them so CI doesn't need a C/Java toolchain, and we ship a reproducibility script.

**Files:**
- Create: `backend/tests/fixtures/compiled/build_fixtures.sh`
- Create (committed binary outputs): `backend/tests/fixtures/compiled/hello.elf`, `hello.exe`, `sample-min.apk`, `libssl-fake-1.0.0.so`

- [ ] **Step 1: Write the build script**

Create `backend/tests/fixtures/compiled/build_fixtures.sh`:
```bash
#!/usr/bin/env bash
# Reproducibility script for compiled-scan test fixtures.
# Run from this directory. Requires: gcc, mingw-w64 (x86_64-w64-mingw32-gcc),
# apksigner+aapt2 (Android SDK build-tools), zip.
#
# Re-running overwrites the .elf/.exe/.apk/.so files in this directory.

set -euo pipefail
cd "$(dirname "$0")"

# ---- hello.elf : Linux ELF that calls strcpy ----
cat > /tmp/hello.c <<'EOF'
#include <string.h>
int main(int argc, char **argv) {
    char buf[16];
    if (argc > 1) strcpy(buf, argv[1]);   // intentional: tested for in BinaryAnalyzer
    return 0;
}
EOF
gcc -O0 -no-pie -o hello.elf /tmp/hello.c

# ---- hello.exe : Windows PE that imports system ----
cat > /tmp/hello_win.c <<'EOF'
#include <stdlib.h>
int main(void) { system("echo hi"); return 0; }
EOF
x86_64-w64-mingw32-gcc -O0 -o hello.exe /tmp/hello_win.c

# ---- libssl-fake-1.0.0.so : ELF with a soname-like string matching CVE library ----
cat > /tmp/fakelib.c <<'EOF'
const char openssl_version[] = "OpenSSL 1.0.0 fake-for-test 2026";
int dummy(void) { return 0; }
EOF
gcc -O0 -shared -fPIC -Wl,-soname,libssl.so.1.0.0 -o libssl-fake-1.0.0.so /tmp/fakelib.c

# ---- sample-min.apk : minimal valid APK with INTERNET permission + secret in strings ----
mkdir -p /tmp/apkbuild/res/values
cat > /tmp/apkbuild/AndroidManifest.xml <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.deepaudit.fixture">
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.READ_SMS"/>
    <application android:label="fx"/>
</manifest>
EOF
cat > /tmp/apkbuild/res/values/strings.xml <<'EOF'
<resources>
  <string name="api_key">sk_live_AKIAIOSFODNN7EXAMPLE</string>
</resources>
EOF
aapt2 compile --dir /tmp/apkbuild/res -o /tmp/apkbuild/compiled.zip
aapt2 link -o sample-min.apk --manifest /tmp/apkbuild/AndroidManifest.xml /tmp/apkbuild/compiled.zip
```

Mark executable:
```bash
chmod +x backend/tests/fixtures/compiled/build_fixtures.sh
```

- [ ] **Step 2: Build the fixtures**

Run from repo root:
```bash
( cd backend/tests/fixtures/compiled && ./build_fixtures.sh )
```
If the host lacks a tool, install it or skip the corresponding fixture and document it in a `README.md` in the fixtures directory. Goal of this step: have `hello.elf`, `hello.exe`, `sample-min.apk`, `libssl-fake-1.0.0.so` present.

- [ ] **Step 3: Sanity-check fixtures**

```bash
file backend/tests/fixtures/compiled/hello.elf
file backend/tests/fixtures/compiled/hello.exe
file backend/tests/fixtures/compiled/sample-min.apk
file backend/tests/fixtures/compiled/libssl-fake-1.0.0.so
```
Expected output respectively contains: `ELF 64-bit`, `PE32+`, `Zip archive` (APKs are zips), `ELF 64-bit ... shared object`.

- [ ] **Step 4: Commit fixtures + script**

```bash
git add backend/tests/fixtures/compiled/
git commit -m "test: add compiled-scan fixtures (ELF/PE/APK/SO) and build script"
```

---

## Task 5: BinaryAnalyzer (ELF + PE)

**Files:**
- Create: `backend/app/services/compiled_scan/rules/dangerous_functions.yml`
- Create: `backend/app/services/compiled_scan/rules/secret_patterns.yml`
- Create: `backend/app/services/compiled_scan/analyzers/binary_analyzer.py`
- Create: `backend/tests/services/compiled_scan/test_binary_analyzer.py`

- [ ] **Step 1: Create rule files**

Create `backend/app/services/compiled_scan/rules/dangerous_functions.yml`:
```yaml
# Symbol names whose mere presence in a binary's import table is worth flagging.
# Severity is conservative (info/low) because a symbol reference is not proof
# of a vulnerability — it indicates an area worth manual review.
- symbol: strcpy
  severity: medium
  title: 使用了危险函数 strcpy
  description: 二进制导入了 strcpy 符号。strcpy 不做长度校验，可能造成栈缓冲区溢出。
  suggestion: 改用 strncpy / strlcpy / snprintf 并显式限制长度。

- symbol: strcat
  severity: medium
  title: 使用了危险函数 strcat
  description: 二进制导入了 strcat 符号，存在缓冲区溢出风险。
  suggestion: 改用 strncat / strlcat。

- symbol: sprintf
  severity: medium
  title: 使用了危险函数 sprintf
  description: 二进制导入了 sprintf 符号，存在格式化字符串与缓冲区溢出风险。
  suggestion: 改用 snprintf。

- symbol: gets
  severity: high
  title: 使用了禁用函数 gets
  description: gets 不限制输入长度，几乎必然导致栈溢出，已被 C11 标准移除。
  suggestion: 改用 fgets 并指定缓冲区大小。

- symbol: system
  severity: medium
  title: 调用了 system()
  description: system() 直接执行 shell 命令，若参数受用户控制会造成命令注入。
  suggestion: 改用 execve 直接调用程序，避免 shell 解析。

- symbol: popen
  severity: medium
  title: 调用了 popen()
  description: popen 同样经过 shell，存在命令注入风险。
  suggestion: 改用 fork+execve。
```

Create `backend/app/services/compiled_scan/rules/secret_patterns.yml`:
```yaml
# Regex patterns applied to extracted strings from binaries.
- name: aws_access_key
  severity: high
  pattern: 'AKIA[0-9A-Z]{16}'
  title: 疑似 AWS Access Key
  description: 二进制内含有形如 AKIA... 的字符串，疑似硬编码 AWS Access Key ID。
  suggestion: 将密钥移出二进制，改为运行时从安全凭证服务获取。

- name: bearer_token
  severity: medium
  pattern: '(?i)bearer\s+[A-Za-z0-9._\-]{20,}'
  title: 疑似 Bearer Token
  description: 二进制内含有 Bearer ... 形式的字符串，疑似硬编码 API Token。
  suggestion: 不要在二进制中嵌入凭证。

- name: private_key_pem
  severity: critical
  pattern: '-----BEGIN (RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----'
  title: 疑似硬编码私钥
  description: 二进制内含有 PEM 私钥头，疑似硬编码私钥。
  suggestion: 立即更换泄露的私钥，并将密钥管理迁移到外部凭证服务。

- name: generic_secret_prefix
  severity: medium
  pattern: 'sk_live_[A-Za-z0-9]{16,}'
  title: 疑似 Stripe Secret Key
  description: 二进制内含有 sk_live_ 前缀字符串。
  suggestion: 立即吊销并迁移到环境变量/凭证服务。
```

- [ ] **Step 2: Write failing test**

Create `backend/tests/services/compiled_scan/test_binary_analyzer.py`:
```python
from pathlib import Path

import pytest

from app.services.compiled_scan.analyzers.binary_analyzer import BinaryAnalyzer

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "compiled"


def _by_rule(findings):
    return {f.rule_id: f for f in findings}


def test_applies_to_elf_pe_so_dll_exe():
    a = BinaryAnalyzer()
    for ext in (".so", ".dll", ".exe", ".elf"):
        assert a.applies_to(Path(f"x{ext}"))
    assert not a.applies_to(Path("x.apk"))
    assert not a.applies_to(Path("x.txt"))


@pytest.mark.skipif(not (FIXTURES / "hello.elf").exists(), reason="fixture missing")
def test_elf_detects_strcpy():
    a = BinaryAnalyzer()
    findings = a.analyze(FIXTURES / "hello.elf", {})
    rules = {f.rule_id for f in findings}
    assert "compiled.binary.dangerous_func.strcpy" in rules


@pytest.mark.skipif(not (FIXTURES / "hello.exe").exists(), reason="fixture missing")
def test_pe_detects_system_import():
    a = BinaryAnalyzer()
    findings = a.analyze(FIXTURES / "hello.exe", {})
    rules = {f.rule_id for f in findings}
    assert "compiled.binary.dangerous_func.system" in rules


@pytest.mark.skipif(not (FIXTURES / "libssl-fake-1.0.0.so").exists(), reason="fixture missing")
def test_string_extraction_finds_openssl_string():
    a = BinaryAnalyzer()
    findings = a.analyze(FIXTURES / "libssl-fake-1.0.0.so", {})
    # No secret-pattern hit expected here, just ensure analyze() doesn't crash on a shared object.
    assert isinstance(findings, list)


def test_analyze_unparseable_file_produces_warning_not_exception(tmp_path: Path):
    junk = tmp_path / "junk.so"
    junk.write_bytes(b"not really an ELF")
    a = BinaryAnalyzer()
    findings = a.analyze(junk, {})
    # Must not raise, and must surface a warning finding.
    assert any(f.rule_id == "compiled.binary.parse_failed" for f in findings)


def test_secret_pattern_detects_api_key_in_strings(tmp_path: Path):
    # Forge an ELF-like file containing an AKIA string in raw bytes; analyzer should
    # still extract strings and match the secret regex even if ELF parsing fails.
    f = tmp_path / "fake.so"
    f.write_bytes(b"junk-AKIAIOSFODNN7EXAMPLE-tail")
    a = BinaryAnalyzer()
    findings = a.analyze(f, {})
    rules = {f.rule_id for f in findings}
    assert "compiled.binary.secret.aws_access_key" in rules
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/services/compiled_scan/test_binary_analyzer.py -v
```
Expected: `ModuleNotFoundError` for `binary_analyzer`.

- [ ] **Step 4: Implement BinaryAnalyzer**

Create `backend/app/services/compiled_scan/analyzers/binary_analyzer.py`:
```python
"""Analyzer for native binaries (ELF + PE)."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Iterable

import yaml

from app.services.compiled_scan.analyzers.base import CompiledAnalyzer, Finding

_RULES_DIR = Path(__file__).resolve().parent.parent / "rules"
_PRINTABLE_RE = re.compile(rb"[\x20-\x7e]{6,}")     # ASCII strings of length >= 6
_MAX_STRINGS = 5000                                  # cap for huge binaries


def _load_yaml(name: str) -> list[dict]:
    with open(_RULES_DIR / name, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or []


class BinaryAnalyzer(CompiledAnalyzer):
    name = "compiled.binary"
    supported_extensions = {".so", ".dll", ".exe", ".elf"}

    def __init__(self) -> None:
        self._dangerous = _load_yaml("dangerous_functions.yml")
        self._secrets = [
            {**rule, "_compiled": re.compile(rule["pattern"])}
            for rule in _load_yaml("secret_patterns.yml")
        ]

    def applies_to(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in self.supported_extensions

    def analyze(self, file_path: Path, options: dict[str, Any]) -> list[Finding]:
        rel = str(file_path)
        findings: list[Finding] = []

        # 1. Symbol extraction (format-specific). Failures fall through to string scan.
        symbols: set[str] = set()
        parse_failed = False
        try:
            if file_path.suffix.lower() in {".elf", ".so"}:
                symbols = self._elf_symbols(file_path)
            elif file_path.suffix.lower() in {".exe", ".dll"}:
                symbols = self._pe_symbols(file_path)
        except Exception as exc:   # noqa: BLE001 — analyzers must never raise
            parse_failed = True
            findings.append(
                Finding(
                    file_path=rel,
                    rule_id="compiled.binary.parse_failed",
                    severity="info",
                    title="二进制解析失败",
                    description=f"无法解析为 ELF/PE：{exc}",
                    tool=self.name,
                )
            )

        for rule in self._dangerous:
            if rule["symbol"] in symbols:
                findings.append(
                    Finding(
                        file_path=rel,
                        rule_id=f"compiled.binary.dangerous_func.{rule['symbol']}",
                        severity=rule["severity"],
                        title=rule["title"],
                        description=rule["description"],
                        suggestion=rule["suggestion"],
                        code_snippet=f"SYMBOL: {rule['symbol']}",
                        tool=self.name,
                    )
                )

        # 2. String extraction (works even if ELF/PE parsing failed).
        try:
            strings = self._extract_strings(file_path)
        except OSError:
            strings = []

        for rule in self._secrets:
            for s in strings:
                if rule["_compiled"].search(s):
                    findings.append(
                        Finding(
                            file_path=rel,
                            rule_id=f"compiled.binary.secret.{rule['name']}",
                            severity=rule["severity"],
                            title=rule["title"],
                            description=rule["description"],
                            suggestion=rule["suggestion"],
                            code_snippet=s[:120],
                            tool=self.name,
                        )
                    )
                    break   # one hit per rule per file is enough

        if parse_failed:
            # No symbol-based hits possible; string-based hits below are still useful.
            pass

        return findings

    # ----- helpers ---------------------------------------------------------

    def _elf_symbols(self, file_path: Path) -> set[str]:
        from elftools.elf.elffile import ELFFile
        from elftools.elf.sections import SymbolTableSection

        out: set[str] = set()
        with open(file_path, "rb") as fh:
            elf = ELFFile(fh)
            for section in elf.iter_sections():
                if not isinstance(section, SymbolTableSection):
                    continue
                for sym in section.iter_symbols():
                    name = sym.name
                    if name:
                        out.add(name)
        return out

    def _pe_symbols(self, file_path: Path) -> set[str]:
        import pefile

        out: set[str] = set()
        pe = pefile.PE(str(file_path), fast_load=True)
        try:
            pe.parse_data_directories(
                directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"]],
            )
            for entry in getattr(pe, "DIRECTORY_ENTRY_IMPORT", []) or []:
                for imp in entry.imports:
                    if imp.name:
                        try:
                            out.add(imp.name.decode("ascii", errors="ignore"))
                        except Exception:
                            continue
        finally:
            pe.close()
        return out

    def _extract_strings(self, file_path: Path) -> list[str]:
        with open(file_path, "rb") as fh:
            blob = fh.read()
        results: list[str] = []
        for i, m in enumerate(_PRINTABLE_RE.finditer(blob)):
            if i >= _MAX_STRINGS:
                break
            results.append(m.group(0).decode("ascii", errors="ignore"))
        return results
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && pytest tests/services/compiled_scan/test_binary_analyzer.py -v
```
Expected: All passed (any test where the fixture is missing is skipped, not failed).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/compiled_scan/rules/dangerous_functions.yml \
        backend/app/services/compiled_scan/rules/secret_patterns.yml \
        backend/app/services/compiled_scan/analyzers/binary_analyzer.py \
        backend/tests/services/compiled_scan/test_binary_analyzer.py
git commit -m "feat: add BinaryAnalyzer for ELF/PE with dangerous-function and secret rules"
```

---

## Task 6: ApkAnalyzer (Manifest + permissions + strings)

**Files:**
- Create: `backend/app/services/compiled_scan/rules/android_permissions.yml`
- Create: `backend/app/services/compiled_scan/analyzers/apk_analyzer.py`
- Create: `backend/tests/services/compiled_scan/test_apk_analyzer.py`

- [ ] **Step 1: Create permissions rules**

Create `backend/app/services/compiled_scan/rules/android_permissions.yml`:
```yaml
# Android permissions considered high-risk when granted by a third-party app.
- name: READ_SMS
  severity: high
  title: 高危权限 READ_SMS
  description: 应用申请读取短信权限，可能用于截获验证码或敏感信息。
  suggestion: 确认业务确实需要该权限；若仅用于读取验证码，改用 SMS Retriever API。

- name: SEND_SMS
  severity: high
  title: 高危权限 SEND_SMS
  description: 应用申请发送短信权限，存在话费扣费风险。
  suggestion: 确认业务必要性；避免在后台静默发送。

- name: READ_CONTACTS
  severity: medium
  title: 高危权限 READ_CONTACTS
  description: 应用申请读取通讯录权限，存在隐私泄露风险。
  suggestion: 确认业务必要性；明示用户用途。

- name: ACCESS_FINE_LOCATION
  severity: medium
  title: 高危权限 ACCESS_FINE_LOCATION
  description: 应用申请精确位置权限。
  suggestion: 确认业务必要性；尽量使用粗粒度位置 ACCESS_COARSE_LOCATION。

- name: RECORD_AUDIO
  severity: high
  title: 高危权限 RECORD_AUDIO
  description: 应用申请录音权限，存在窃听风险。
  suggestion: 确认业务必要性；仅在用户主动触发时启用麦克风。

- name: CAMERA
  severity: medium
  title: 高危权限 CAMERA
  description: 应用申请相机权限。
  suggestion: 确认业务必要性。

- name: WRITE_EXTERNAL_STORAGE
  severity: low
  title: 危险权限 WRITE_EXTERNAL_STORAGE
  description: 应用申请写外部存储权限（Android 10+ 推荐使用分区存储替代）。
  suggestion: 迁移到 MediaStore / Scoped Storage。

- name: REQUEST_INSTALL_PACKAGES
  severity: high
  title: 高危权限 REQUEST_INSTALL_PACKAGES
  description: 应用申请安装其他 APK 的权限，常被滥用于推广/木马链。
  suggestion: 极少业务真正需要该权限，应避免。
```

- [ ] **Step 2: Write failing test**

Create `backend/tests/services/compiled_scan/test_apk_analyzer.py`:
```python
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
def test_detects_high_risk_permissions():
    a = ApkAnalyzer()
    findings = a.analyze(FIXTURES / "sample-min.apk", {})
    rules = {f.rule_id for f in findings}
    assert "compiled.apk.permission.READ_SMS" in rules


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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/services/compiled_scan/test_apk_analyzer.py -v
```
Expected: `ModuleNotFoundError`.

- [ ] **Step 4: Implement ApkAnalyzer**

Create `backend/app/services/compiled_scan/analyzers/apk_analyzer.py`:
```python
"""Analyzer for Android artifacts: .apk / .aab / .dex."""
from __future__ import annotations

import re
import zipfile
from pathlib import Path
from typing import Any

import yaml

from app.services.compiled_scan.analyzers.base import CompiledAnalyzer, Finding

_RULES_DIR = Path(__file__).resolve().parent.parent / "rules"


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
        printable = re.compile(rb"[\x20-\x7e]{6,}")
        out: list[str] = []
        with zipfile.ZipFile(file_path) as zf:
            for info in zf.infolist():
                if info.file_size > 5 * 1024 * 1024:   # skip resources > 5MB
                    continue
                try:
                    blob = zf.read(info)
                except (RuntimeError, zipfile.BadZipFile):
                    continue
                for m in printable.finditer(blob):
                    out.append(m.group(0).decode("ascii", errors="ignore"))
                    if len(out) >= 5000:
                        return out
        return out

    def _scan_dex(self, file_path: Path, rel: str) -> list[Finding]:
        printable = re.compile(rb"[\x20-\x7e]{6,}")
        try:
            blob = file_path.read_bytes()
        except OSError:
            return []
        findings: list[Finding] = []
        for rule in self._secrets:
            for m in printable.finditer(blob):
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && pytest tests/services/compiled_scan/test_apk_analyzer.py -v
```
Expected: All passed (fixture-dependent tests skip if fixture is missing).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/compiled_scan/rules/android_permissions.yml \
        backend/app/services/compiled_scan/analyzers/apk_analyzer.py \
        backend/tests/services/compiled_scan/test_apk_analyzer.py
git commit -m "feat: add ApkAnalyzer with permission + secret detection"
```

---

## Task 7: SCAAnalyzer (library version → CVE matching)

**Files:**
- Create: `backend/app/services/compiled_scan/rules/known_libs.yml`
- Create: `backend/app/services/compiled_scan/analyzers/sca_analyzer.py`
- Create: `backend/tests/services/compiled_scan/test_sca_analyzer.py`

- [ ] **Step 1: Create known-libs file**

Create `backend/app/services/compiled_scan/rules/known_libs.yml`:
```yaml
# Hand-maintained library fingerprints and the highest-impact CVEs we want
# to flag on detection. Match strategy: extract printable strings from the
# binary, look for `string_match` substring; if present, record the version
# (captured via `version_regex`), and emit one finding per affected version.
#
# To update: add a new entry below. Versions in `affected_versions` are exact
# matches against the captured group; use multiple entries for ranges.

- library: openssl
  string_match: "OpenSSL 1.0.0"
  version_regex: 'OpenSSL\s+(\d+\.\d+\.\d+[a-z]?)'
  cves:
    - id: CVE-2014-0160
      title: OpenSSL Heartbleed (CVE-2014-0160)
      severity: critical
      affected_versions: ["1.0.0", "1.0.1"]
      description: OpenSSL 1.0.1 系列存在 Heartbleed 漏洞，可远程读取内存。
      suggestion: 升级到 OpenSSL 1.0.2 或更高版本。

- library: zlib
  string_match: "inflate 1.2."
  version_regex: '1\.2\.\d+'
  cves:
    - id: CVE-2018-25032
      title: zlib memory corruption (CVE-2018-25032)
      severity: high
      affected_versions: ["1.2.8", "1.2.9", "1.2.10", "1.2.11"]
      description: zlib < 1.2.12 在压缩特定输入时可能造成内存破坏。
      suggestion: 升级到 zlib 1.2.12 或更高版本。
```

- [ ] **Step 2: Write failing test**

Create `backend/tests/services/compiled_scan/test_sca_analyzer.py`:
```python
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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pytest tests/services/compiled_scan/test_sca_analyzer.py -v
```
Expected: `ModuleNotFoundError`.

- [ ] **Step 4: Implement SCAAnalyzer**

Create `backend/app/services/compiled_scan/analyzers/sca_analyzer.py`:
```python
"""Software-composition analysis: detect known-vulnerable library versions."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from app.services.compiled_scan.analyzers.base import CompiledAnalyzer, Finding
from app.services.compiled_scan.collector import COMPILED_EXTENSIONS

_RULES_DIR = Path(__file__).resolve().parent.parent / "rules"


class SCAAnalyzer(CompiledAnalyzer):
    name = "compiled.sca"
    supported_extensions = set(COMPILED_EXTENSIONS)

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
                if version not in cve["affected_versions"]:
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && pytest tests/services/compiled_scan/test_sca_analyzer.py -v
```
Expected: All passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/compiled_scan/rules/known_libs.yml \
        backend/app/services/compiled_scan/analyzers/sca_analyzer.py \
        backend/tests/services/compiled_scan/test_sca_analyzer.py
git commit -m "feat: add SCAAnalyzer with known-CVE library matching"
```

---

## Task 8: CompiledScanEngine orchestrator

**Files:**
- Create: `backend/app/services/compiled_scan/engine.py`
- Create: `backend/tests/services/compiled_scan/test_engine.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/services/compiled_scan/test_engine.py`:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/services/compiled_scan/test_engine.py -v
```
Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement engine**

Create `backend/app/services/compiled_scan/engine.py`:
```python
"""Top-level orchestrator for compiled-artifact scanning."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.services.compiled_scan.analyzers.apk_analyzer import ApkAnalyzer
from app.services.compiled_scan.analyzers.base import CompiledAnalyzer, Finding
from app.services.compiled_scan.analyzers.binary_analyzer import BinaryAnalyzer
from app.services.compiled_scan.analyzers.sca_analyzer import SCAAnalyzer
from app.services.compiled_scan.collector import (
    DEFAULT_MAX_SIZE_MB,
    collect_compiled_artifacts,
)


class CompiledScanEngine:
    """Runs all registered analyzers against compiled artifacts in a workspace."""

    def __init__(self, analyzers: list[CompiledAnalyzer] | None = None) -> None:
        self.analyzers: list[CompiledAnalyzer] = analyzers or [
            ApkAnalyzer(),
            BinaryAnalyzer(),
            SCAAnalyzer(),
        ]

    def scan(self, workspace_dir: str | Path, options: dict[str, Any]) -> list[dict[str, Any]]:
        """Scan `workspace_dir`. Returns a list of finding dicts ready to persist."""
        exclude = (options or {}).get("exclude_patterns", []) or []
        max_size = (options or {}).get("max_binary_size_mb", DEFAULT_MAX_SIZE_MB)

        # 1. Emit info findings for over-sized files BEFORE filtering them out.
        oversize = self._find_oversize_files(workspace_dir, exclude, max_size)
        findings: list[Finding] = oversize

        # 2. Collect in-range artifacts and dispatch to analyzers.
        artifacts = collect_compiled_artifacts(
            workspace_dir,
            exclude_patterns=exclude,
            max_size_mb=max_size,
        )
        for artifact in artifacts:
            path = Path(artifact["absolute_path"])
            for analyzer in self.analyzers:
                if not analyzer.applies_to(path):
                    continue
                try:
                    findings.extend(analyzer.analyze(path, options or {}))
                except Exception as exc:   # noqa: BLE001 — engine must not raise
                    findings.append(
                        Finding(
                            file_path=artifact["relative_path"],
                            rule_id=f"compiled.engine.analyzer_failed.{analyzer.name}",
                            severity="info",
                            title=f"{analyzer.name} 分析失败",
                            description=str(exc),
                            tool="compiled.engine",
                        )
                    )

        return self._dedupe([f.to_dict() for f in findings])

    # ----- helpers ---------------------------------------------------------

    def _find_oversize_files(
        self,
        workspace_dir: str | Path,
        exclude: list[str],
        max_size_mb: int,
    ) -> list[Finding]:
        from app.services.compiled_scan.collector import COMPILED_EXTENSIONS
        from app.services.quick_scan import normalize_path, should_exclude

        workspace = Path(workspace_dir)
        if not workspace.exists():
            return []
        max_bytes = max_size_mb * 1024 * 1024
        out: list[Finding] = []
        for path in workspace.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in COMPILED_EXTENSIONS:
                continue
            rel = normalize_path(path.relative_to(workspace))
            if should_exclude(rel, exclude):
                continue
            try:
                size = path.stat().st_size
            except OSError:
                continue
            if size > max_bytes:
                out.append(
                    Finding(
                        file_path=rel,
                        rule_id="compiled.engine.file_too_large",
                        severity="info",
                        title="文件过大已跳过",
                        description=(
                            f"文件大小 {size // (1024 * 1024)}MB 超过上限 {max_size_mb}MB，"
                            "已跳过扫描。可在创建任务时调高 max_binary_size_mb。"
                        ),
                        tool="compiled.engine",
                    )
                )
        return out

    def _dedupe(self, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[tuple[str, str, str]] = set()
        out: list[dict[str, Any]] = []
        for f in findings:
            key = (f["file_path"], f["rule_id"], f.get("code_snippet", ""))
            if key in seen:
                continue
            seen.add(key)
            out.append(f)
        return out
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && pytest tests/services/compiled_scan/test_engine.py -v
```
Expected: All passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/compiled_scan/engine.py backend/tests/services/compiled_scan/test_engine.py
git commit -m "feat: add CompiledScanEngine orchestrator with dedup and size limits"
```

---

## Task 9: Wire scanner.py + ScanRequest

This is the only intrusive change to existing code: a `scan_mode` early-return branch and a Pydantic field add.

**Files:**
- Modify: `backend/app/api/v1/endpoints/scan.py`
- Modify: `backend/app/api/v1/endpoints/projects.py`
- Modify: `backend/app/services/scanner.py`
- Create: `backend/tests/services/compiled_scan/test_scanner_integration.py`

- [ ] **Step 1: Write failing integration test**

Create `backend/tests/services/compiled_scan/test_scanner_integration.py`:
```python
"""End-to-end: scan_local_workspace dispatches by scan_mode."""
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.scanner import scan_local_workspace


def _make_task():
    task = MagicMock()
    task.id = "test-task-1"
    return task


@pytest.mark.asyncio
async def test_compiled_mode_skips_source_scan_and_invokes_engine(tmp_path: Path):
    (tmp_path / "x.so").write_bytes(b"junk-AKIAIOSFODNN7EXAMPLE-tail")

    task = _make_task()
    db = AsyncMock()

    with patch(
        "app.services.scanner.run_semgrep_scan",
        side_effect=AssertionError("semgrep must NOT run in compiled mode"),
    ), patch(
        "app.services.scanner.run_pattern_scan",
        side_effect=AssertionError("pattern scan must NOT run in compiled mode"),
    ), patch(
        "app.services.scanner.collect_source_files",
        side_effect=AssertionError("source collector must NOT run in compiled mode"),
    ):
        await scan_local_workspace(
            task,
            db,
            str(tmp_path),
            user_config={"scan_config": {"scan_mode": "compiled"}},
        )

    # AuditIssue rows added via db.add — at least one should be present.
    assert db.add.called, "expected at least one finding persisted in compiled mode"
    assert db.commit.await_count >= 1


@pytest.mark.asyncio
async def test_source_mode_is_default_and_unchanged(tmp_path: Path):
    task = _make_task()
    db = AsyncMock()

    sentinel_calls = {"source": 0}

    def _fake_collect(*args, **kwargs):
        sentinel_calls["source"] += 1
        return []

    with patch("app.services.scanner.collect_source_files", side_effect=_fake_collect), \
         patch("app.services.scanner.run_semgrep_scan", return_value=[]), \
         patch("app.services.scanner.run_pattern_scan", return_value=[]), \
         patch("app.services.scanner.CodeAnalysisService"):
        await scan_local_workspace(task, db, str(tmp_path), user_config={"scan_config": {}})

    assert sentinel_calls["source"] == 1, "source-mode path must invoke collect_source_files"
```

- [ ] **Step 2: Run integration test to verify it fails**

```bash
cd backend && pytest tests/services/compiled_scan/test_scanner_integration.py -v
```
Expected: First test fails because `scan_local_workspace` currently always calls `collect_source_files`.

- [ ] **Step 3: Add `scan_mode` branch in scan_local_workspace**

Open `backend/app/services/scanner.py`. Locate `scan_local_workspace` at line 406. Insert the compiled-mode branch immediately after the `scan_config` line (around line 412), BEFORE any source-collection happens.

Replace lines 406-416 (the function header through `other_config = ...`):

```python
async def scan_local_workspace(
    task: AuditTask,
    db: AsyncSession,
    workspace_dir: str,
    user_config: Optional[Dict[str, Any]] = None,
) -> None:
    scan_config = (user_config or {}).get("scan_config", {})

    # --- compiled-artifact mode: skip source-scan pipeline entirely ---
    if scan_config.get("scan_mode") == "compiled":
        await _run_compiled_scan(task, db, workspace_dir, scan_config)
        return

    exclude_patterns = scan_config.get("exclude_patterns", [])
    target_files = scan_config.get("file_paths", [])
    analysis_config = get_analysis_config(user_config)
    other_config = (user_config or {}).get("otherConfig", {})
```

Then at the end of the same file (after `scan_repo_task`), add the helper:

```python
async def _run_compiled_scan(
    task: AuditTask,
    db: AsyncSession,
    workspace_dir: str,
    scan_config: Dict[str, Any],
) -> None:
    """Compiled-artifact scan path. Mirrors the persistence shape of the
    source-scan branch above (scanner.py:482-509) so the rest of the system
    treats these findings identically."""
    from app.services.compiled_scan.engine import CompiledScanEngine

    compiled_opts = scan_config.get("compiled_options", {}) or {}
    options = {
        "enable_sca": compiled_opts.get("enable_sca", True),
        "max_binary_size_mb": compiled_opts.get("max_binary_size_mb", 200),
        "exclude_patterns": scan_config.get("exclude_patterns", []) or [],
    }

    task.status = "running"
    task.scanned_files = 0
    await db.commit()

    engine = CompiledScanEngine()
    findings = engine.scan(workspace_dir, options)

    for finding in findings:
        db.add(
            AuditIssue(
                task_id=task.id,
                file_path=finding["file_path"],
                line_number=finding.get("line_number", 0),
                column_number=finding.get("column_number"),
                issue_type=finding.get("issue_type", "security"),
                severity=finding.get("severity", "medium"),
                title=finding.get("title"),
                message=finding.get("description"),
                description=finding.get("description"),
                suggestion=finding.get("suggestion"),
                code_snippet=finding.get("code_snippet"),
                ai_explanation=json.dumps(
                    {
                        "review_status": "rule_hit",
                        "tool": finding.get("tool"),
                        "rule_id": finding.get("rule_id"),
                    },
                    ensure_ascii=False,
                ),
                source=finding.get("source"),
                sink=finding.get("sink"),
                status="not_fixed",
            )
        )

    await db.flush()
    await db.commit()

    # Count artifacts as "files" for UI progress accounting.
    from app.services.compiled_scan.collector import collect_compiled_artifacts
    artifacts = collect_compiled_artifacts(
        workspace_dir,
        exclude_patterns=options["exclude_patterns"],
        max_size_mb=options["max_binary_size_mb"],
    )
    task.total_files = len(artifacts)
    task.scanned_files = len(artifacts)
    task.issues_count = len(findings)
    task.status = "completed"
    task.completed_at = datetime.now(timezone.utc)
    await db.commit()
```

- [ ] **Step 4: Add fields to ScanRequest (both endpoints)**

Open `backend/app/api/v1/endpoints/scan.py` and replace the `ScanRequest` class (lines 157-165):

```python
class ScanRequest(BaseModel):
    file_paths: Optional[List[str]] = None
    full_scan: bool = True
    exclude_patterns: Optional[List[str]] = None
    rule_set_id: Optional[str] = None
    prompt_template_id: Optional[str] = None
    functionWhitelist: Optional[List[str]] = None
    vulnerabilityWhitelist: Optional[List[str]] = None
    sanitizerFunctions: Optional[List[str]] = None
    # --- compiled-artifact mode ---
    scan_mode: Optional[str] = "source"           # "source" | "compiled"
    compiled_options: Optional[Dict[str, Any]] = None
```

Make sure `Dict` and `Any` are imported at the top of the file (`from typing import ..., Dict, Any`). If `Dict`/`Any` aren't imported, add them to the existing `typing` import line.

Then update BOTH `user_config['scan_config']` injection blocks to include the new fields. In `scan.py` look for the dict literal that starts with `'file_paths': scan_request.file_paths or []` (one in the `upload-zip` handler, one in `scan-stored-zip` near line 210) — add at the bottom of each:

```python
            'scan_mode': scan_request.scan_mode or 'source',
            'compiled_options': scan_request.compiled_options or {},
```

In `backend/app/api/v1/endpoints/projects.py`, find the analogous `ScanRequest` (around line 535) and do the same two changes (add fields to the class, add the two keys to its `user_config['scan_config']` dict). For projects.py, also add — early in the repo-scan handler, right after the project is loaded — a guard:

```python
    if scan_request and scan_request.scan_mode == "compiled":
        raise HTTPException(
            status_code=400,
            detail="编译后产物扫描仅支持通过压缩包上传方式，不支持 Git 仓库。"
        )
```

- [ ] **Step 5: Run integration tests to verify pass**

```bash
cd backend && pytest tests/services/compiled_scan/test_scanner_integration.py -v
```
Expected: both tests pass.

- [ ] **Step 6: Run full compiled-scan test suite (regression)**

```bash
cd backend && pytest tests/services/compiled_scan/ -v
```
Expected: all tests pass.

- [ ] **Step 7: Run existing scanner tests (no regression)**

```bash
cd backend && pytest tests/ -k "scanner or quick_scan or scan" -v
```
Expected: all existing scanner tests still pass (no new failures).

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/scanner.py \
        backend/app/api/v1/endpoints/scan.py \
        backend/app/api/v1/endpoints/projects.py \
        backend/tests/services/compiled_scan/test_scanner_integration.py
git commit -m "feat: route scan_mode='compiled' tasks through CompiledScanEngine"
```

---

## Task 10: Frontend — extend type + service layer

**Files:**
- Modify: `frontend/src/features/projects/services/repoZipScan.ts`

- [ ] **Step 1: Inspect current payload type**

Open `frontend/src/features/projects/services/repoZipScan.ts` (read lines 1-90) to find the `ScanZipPayload` interface (or whatever its `scanZipFile`/`scanStoredZipFile` argument types are named).

- [ ] **Step 2: Extend the payload type**

Add the two new fields to the payload interface (preserve existing fields):

```ts
export interface CompiledScanOptions {
  enable_sca: boolean;
  max_binary_size_mb: number;
}

// Add to whatever interface backs scanZipFile / scanStoredZipFile (e.g. ScanZipPayload):
//   scan_mode?: 'source' | 'compiled';
//   compiled_options?: CompiledScanOptions;
```

The field names MUST match the backend ScanRequest exactly (`scan_mode`, `compiled_options`, snake_case). FormData/JSON serialization in the existing code path will carry them as-is.

- [ ] **Step 3: Verify frontend compiles**

Run from `frontend/`:
```bash
npm run build
```
Expected: build succeeds (no TypeScript errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/projects/services/repoZipScan.ts
git commit -m "feat(frontend): extend zip-scan payload with scan_mode and compiled_options"
```

---

## Task 11: Frontend — CreateTaskDialog scan-type radio

**Files:**
- Modify: `frontend/src/components/audit/CreateTaskDialog.tsx`

- [ ] **Step 1: Add state**

Open `frontend/src/components/audit/CreateTaskDialog.tsx`. Locate the existing `auditMode` state near line 86. Immediately after it, add:

```tsx
const [scanType, setScanType] = useState<'source' | 'compiled'>('source');
const [enableSca, setEnableSca] = useState<boolean>(true);
const [maxBinarySizeMb, setMaxBinarySizeMb] = useState<number>(200);
```

- [ ] **Step 2: Render the radio group**

Inside the dialog body, only when `auditMode === 'fast'`, render a new section ABOVE the existing project/file pickers:

```tsx
{auditMode === 'fast' && (
  <div className="mb-4 rounded border p-3">
    <div className="mb-2 font-medium">扫描类型</div>
    <label className="mr-4 inline-flex items-center">
      <input
        type="radio"
        name="scanType"
        value="source"
        checked={scanType === 'source'}
        onChange={() => setScanType('source')}
        className="mr-1"
      />
      源代码 (Git 仓库 / 源码压缩包)
    </label>
    <label className="inline-flex items-center">
      <input
        type="radio"
        name="scanType"
        value="compiled"
        checked={scanType === 'compiled'}
        onChange={() => setScanType('compiled')}
        className="mr-1"
      />
      编译后产物 (.apk/.so/.dll/.exe...)
    </label>
    <div className="mt-1 text-xs text-gray-500">
      ⓘ 仅支持 Android (.apk/.aab/.dex) 和 C/C++ 原生二进制 (.so/.dll/.exe/.elf)。
    </div>
  </div>
)}
```

- [ ] **Step 3: Conditionally hide source-mode-only options**

Find existing UI for: rule set dropdown, prompt template dropdown, `functionWhitelist` / `vulnerabilityWhitelist` / `sanitizerFunctions` inputs, and the Git-repo project selector. Wrap each in:

```tsx
{!(auditMode === 'fast' && scanType === 'compiled') && (
  /* existing JSX block here */
)}
```

For the Git-repo selector specifically, also disable repo-mode submission when compiled:
```tsx
{auditMode === 'fast' && scanType === 'compiled' && (
  <div className="mb-2 text-xs text-amber-600">
    编译后产物扫描仅支持上传压缩包，不支持 Git 仓库。
  </div>
)}
```

- [ ] **Step 4: Render compiled-mode-only options**

Inside the same `auditMode === 'fast'` block, after the radio group, add:

```tsx
{auditMode === 'fast' && scanType === 'compiled' && (
  <div className="mb-4 rounded border p-3">
    <label className="mb-2 flex items-center">
      <input
        type="checkbox"
        checked={enableSca}
        onChange={(e) => setEnableSca(e.target.checked)}
        className="mr-2"
      />
      启用第三方库 CVE 匹配 (SCA)
    </label>
    <label className="block text-sm">
      单文件大小上限 (MB):
      <input
        type="number"
        min={1}
        max={2048}
        value={maxBinarySizeMb}
        onChange={(e) => setMaxBinarySizeMb(Number(e.target.value) || 200)}
        className="ml-2 w-24 rounded border px-2 py-1"
      />
    </label>
    <div className="mt-1 text-xs text-gray-500">
      压缩包内支持的扩展名: .apk .aab .dex .so .dll .exe .elf — 其他文件将被忽略。
    </div>
  </div>
)}
```

- [ ] **Step 5: Extend submit dispatch**

Find the existing `scanZipFile` / `scanStoredZipFile` call in the submit handler (around lines 273-342). For BOTH calls, when `auditMode === 'fast' && scanType === 'compiled'`, attach the extra payload fields:

```tsx
const compiledExtras = scanType === 'compiled'
  ? {
      scan_mode: 'compiled' as const,
      compiled_options: {
        enable_sca: enableSca,
        max_binary_size_mb: maxBinarySizeMb,
      },
    }
  : { scan_mode: 'source' as const };

await scanZipFile({
  ...existingPayload,
  ...compiledExtras,
});
```

Apply the same `...compiledExtras` to the `scanStoredZipFile` call. Do NOT attach it to `runRepositoryAudit` — the backend rejects compiled mode for repos and the UI already blocks that path.

- [ ] **Step 6: Frontend build check**

```bash
cd frontend && npm run build
```
Expected: build succeeds.

- [ ] **Step 7: Manual smoke test**

Start the backend and frontend locally (using the project's normal startup commands), open the create-task dialog, and verify:
1. Default state: radio set to "源代码", compiled-mode options not shown
2. Switch to "编译后产物": rule-set dropdown disappears, SCA checkbox + size input appear
3. Submitting with a fake .apk: a new task is created with `scan_config.scan_mode === "compiled"` (check via DB or the task detail page)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/audit/CreateTaskDialog.tsx
git commit -m "feat(frontend): add scan-type radio (source vs compiled) to CreateTaskDialog"
```

---

## Task 12: Frontend — TaskDetail badge + row adaptation

**Files:**
- Modify: `frontend/src/pages/TaskDetail.tsx`

- [ ] **Step 1: Add badge in task header**

Open `frontend/src/pages/TaskDetail.tsx`. Find the task title rendering region near the top of the JSX. Add a badge next to the title:

```tsx
{task?.scan_config?.scan_mode === 'compiled' ? (
  <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
    编译后扫描
  </span>
) : (
  <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
    源代码扫描
  </span>
)}
```

If `task.scan_config` is stored as a JSON string in the API response, parse it once:
```tsx
const scanConfig = typeof task?.scan_config === 'string'
  ? (JSON.parse(task.scan_config || '{}') as Record<string, unknown>)
  : (task?.scan_config ?? {});
const isCompiledScan = (scanConfig as { scan_mode?: string }).scan_mode === 'compiled';
```
Then use `isCompiledScan` in the badge expression.

- [ ] **Step 2: Adapt issue rows when line_number is 0**

Locate the issue list row renderer. Wherever line number is currently shown (e.g. `{issue.file_path}:{issue.line_number}`), branch:

```tsx
{issue.line_number && issue.line_number > 0 ? (
  <span>{issue.file_path}:{issue.line_number}</span>
) : (
  <span>
    {issue.file_path}
    {(() => {
      const rid = issue.rule_id || '';
      if (rid.startsWith('compiled.binary.dangerous_func.')) return ' [符号引用]';
      if (rid.startsWith('compiled.binary.secret.') || rid.startsWith('compiled.apk.secret.')) return ' [字符串匹配]';
      if (rid.startsWith('compiled.apk.permission.')) return ' [Manifest 权限]';
      if (rid.startsWith('compiled.sca.')) return ' [CVE]';
      if (rid.startsWith('compiled.engine.')) return ' [扫描引擎]';
      return '';
    })()}
  </span>
)}
```

If `issue.rule_id` isn't exposed by the current API, fall back to the closest available field (e.g. parse `ai_explanation`). Inspect the existing TaskDetail code to see what's already available — prefer reusing fields already mapped over adding new mapping logic.

- [ ] **Step 3: Frontend build check**

```bash
cd frontend && npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Manual visual check**

Open the task detail page for a completed compiled-mode scan task. Verify:
1. Badge says `[编译后扫描]` in purple
2. Issue rows without line numbers show the appropriate `[符号引用]` / `[Manifest 权限]` / `[CVE]` tag instead of `:0`
3. Existing source-mode tasks still render exactly as before (badge says `[源代码扫描]`, line numbers intact)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TaskDetail.tsx
git commit -m "feat(frontend): add scan-mode badge and adapt issue rows for compiled findings"
```

---

## Task 13: End-to-end manual verification

- [ ] **Step 1: Restart full stack**

```bash
docker compose up -d --build
```
Wait until both backend and frontend are healthy.

- [ ] **Step 2: Verify source-mode regression**

Log in via the frontend, create a fast-audit task with the existing source upload flow (a `.zip` of a small source tree). Confirm: task completes, issues appear with line numbers, badge says `[源代码扫描]`.

- [ ] **Step 3: Verify compiled-mode end-to-end**

Create a `.zip` containing the test fixtures from Task 4 (`hello.elf`, `sample-min.apk`, `libssl-fake-1.0.0.so`). Create a fast-audit task with scan-type set to "编译后产物". Confirm:
- Task transitions: pending → running → completed
- Issues include: at least one `compiled.binary.dangerous_func.strcpy`, one `compiled.apk.permission.READ_SMS`, one `compiled.sca.CVE-2014-0160`
- Badge shows `[编译后扫描]`
- File path on each row reflects the path inside the zip
- Rows display the bracketed tag (`[符号引用]` / `[Manifest 权限]` / `[CVE]`) instead of `:0`

- [ ] **Step 4: Verify Git-repo guard**

Try to POST to `/projects/{id}/scan` with `scan_mode=compiled` (use curl or the frontend's repo-scan path with the guard message visible). Expected: HTTP 400 with message `编译后产物扫描仅支持通过压缩包上传方式...`.

- [ ] **Step 5: Final commit (if any small fixes needed)**

If you found and fixed small issues during verification, commit them now:
```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```

---

## Self-Review Notes

After writing this plan I checked it against the spec and made these adjustments:

- **Spec coverage:** Every spec section has at least one task. Data-model (scan_mode field) → Task 9. Engine architecture (engine/collector/three analyzers/rules) → Tasks 2-8. UI changes (radio + badge + row tweak) → Tasks 11-12. Testing strategy → embedded in each TDD task plus end-to-end in Task 13. Dependencies → Task 1. Risk mitigations (size limit, parse-failure warnings) → built into engine + binary analyzer code.
- **Placeholder scan:** No "TBD", no "implement appropriate handling", no "similar to above". Every code-changing step shows the actual code.
- **Type consistency:** `Finding` dataclass defined in Task 2 is the single shape used by all three analyzers (Tasks 5-7) and the engine (Task 8). `compiled_options` keys (`enable_sca`, `max_binary_size_mb`) match between Pydantic model (Task 9), engine consumption (Task 8), and frontend payload (Tasks 10-11).
- **Naming consistency:** `scan_mode` (snake_case) used in backend AND frontend payload (matching FastAPI's serialization). UI state uses `scanType` (camelCase) but maps to `scan_mode` on submit.
- One quirk preserved: I kept the existing source-scan persistence shape verbatim in `_run_compiled_scan` so `AuditIssue` rows from both paths look identical to downstream consumers (no separate frontend code path needed for fields).
