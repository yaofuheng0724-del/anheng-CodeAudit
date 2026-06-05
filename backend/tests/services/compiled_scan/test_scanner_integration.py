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
    # Break AsyncMock's recursive async chain for SQLAlchemy's
    # `(await db.execute(...)).scalars().all()` idiom.
    exec_result = MagicMock()
    exec_result.scalars.return_value.all.return_value = []
    db.execute.return_value = exec_result

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
