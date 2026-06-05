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
