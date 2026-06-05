from pathlib import Path
import shutil
import tempfile

from app.services.scanner import _collect_iac_files


def test_collect_iac_files_finds_all_three_types():
    tmp = Path(tempfile.mkdtemp())
    try:
        (tmp / "Dockerfile").write_text("FROM alpine\n")
        (tmp / "docker-compose.yml").write_text("services: {}\n")
        wf = tmp / ".github" / "workflows"
        wf.mkdir(parents=True)
        (wf / "ci.yml").write_text("name: ci\n")
        (tmp / "README.md").write_text("ignored\n")

        files = _collect_iac_files(tmp)
        paths = sorted(f["path"] for f in files)
        assert paths == [".github/workflows/ci.yml", "Dockerfile", "docker-compose.yml"]
    finally:
        shutil.rmtree(tmp)
