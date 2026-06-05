from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.api.v1.endpoints.schedules import ScheduledScanCreate, _serialize_schedule
from app.api.v1.endpoints.schedules import _calculate_next_run_at
from app.models.agent_task import AgentTask
from app.models.audit import AuditTask
from app.services.scheduled_scans import ScheduledScanRunner
from app.schemas.user import UserCreate
from app.services.quick_scan import collect_source_files, run_pattern_scan, should_exclude


def test_user_create_full_name_is_optional():
    payload = UserCreate(username="alice", password="Admin@123456")

    assert payload.full_name is None


def test_collect_source_files_prunes_default_excluded_directories(tmp_path):
    source = tmp_path / "src"
    excluded = tmp_path / "node_modules" / "pkg"
    source.mkdir()
    excluded.mkdir(parents=True)
    (source / "main.py").write_text("password = 'admin123456'\n")
    (excluded / "index.js").write_text("const token = 'secret-token'\n")

    files = collect_source_files(tmp_path)

    assert [item["path"] for item in files] == ["src/main.py"]
    assert should_exclude("src/node_modules/pkg/index.js") is True


def test_pattern_scan_sets_line_counts_and_finds_secret(tmp_path):
    source = tmp_path / "main.py"
    source.write_text("print('ok')\napi_key = '1234567890'\n")
    files = collect_source_files(tmp_path)

    findings = run_pattern_scan(files)

    assert files[0]["line_count"] == 2
    assert any(finding["rule_id"] == "DA-SECRET-001" for finding in findings)


def test_schedule_next_run_moves_into_same_day_window():
    base = datetime(2026, 5, 18, 0, 0, tzinfo=timezone.utc)

    next_run = _calculate_next_run_at(base, 60, "10:00", "12:00", "Asia/Shanghai")

    assert next_run == datetime(2026, 5, 18, 2, 0, tzinfo=timezone.utc)


def test_schedule_next_run_supports_cross_midnight_window():
    base = datetime(2026, 5, 18, 11, 30, tzinfo=timezone.utc)

    next_run = _calculate_next_run_at(base, 60, "22:00", "02:00", "Asia/Shanghai")

    assert next_run == datetime(2026, 5, 18, 14, 0, tzinfo=timezone.utc)


def test_schedule_create_defaults_to_fast_scan_mode():
    payload = ScheduledScanCreate(project_id="proj-1", name="daily")

    assert payload.scan_mode == "fast"


def test_schedule_create_accepts_agent_scan_mode():
    payload = ScheduledScanCreate(project_id="proj-1", name="daily-agent", scan_mode="agent")

    assert payload.scan_mode == "agent"


def test_schedule_serialization_defaults_missing_scan_mode_to_fast():
    item = SimpleNamespace(
        id="schedule-1",
        project_id="proj-1",
        name="daily",
        scan_mode=None,
        branch_name="main",
        interval_minutes=60,
        time_window_start="00:00",
        time_window_end="23:59",
        timezone="Asia/Shanghai",
        rule_set_id=None,
        prompt_template_id=None,
        exclude_patterns="[]",
        file_paths="[]",
        is_active=True,
        created_by="user-1",
        last_run_at=None,
        next_run_at=None,
        created_at=datetime(2026, 5, 18, tzinfo=timezone.utc),
        updated_at=None,
    )

    response = _serialize_schedule(item)

    assert response.scan_mode == "fast"


class _FakeResult:
    def __init__(self, schedules):
        self._schedules = schedules

    def scalars(self):
        return self

    def all(self):
        return self._schedules


class _FakeSession:
    def __init__(self, schedules, project):
        self.schedules = schedules
        self.project = project
        self.added = []
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, _query):
        return _FakeResult(self.schedules)

    async def get(self, _model, _id):
        return self.project

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        for index, obj in enumerate(self.added, start=1):
            if not getattr(obj, "id", None):
                obj.id = f"task-{index}"

    async def commit(self):
        self.committed = True


def _due_schedule(scan_mode: str):
    return SimpleNamespace(
        id=f"schedule-{scan_mode}",
        project_id="proj-1",
        created_by="user-1",
        name=f"{scan_mode}-schedule",
        scan_mode=scan_mode,
        branch_name="develop",
        interval_minutes=60,
        time_window_start="00:00",
        time_window_end="23:59",
        timezone="Asia/Shanghai",
        rule_set_id=None,
        prompt_template_id=None,
        exclude_patterns='["node_modules/**"]',
        file_paths='["src/app.py"]',
        is_active=True,
        last_run_at=None,
        next_run_at=datetime(2026, 5, 18, tzinfo=timezone.utc),
    )


@pytest.mark.asyncio
async def test_scheduled_runner_creates_agent_task_for_agent_schedule():
    schedule = _due_schedule("agent")
    project = SimpleNamespace(
        id="proj-1",
        is_active=True,
        source_type="repository",
        default_branch="main",
    )
    session = _FakeSession([schedule], project)
    created_jobs = []

    async def fake_execute_agent_task(_task_id):
        return None

    def fake_create_task(coro):
        coro.close()
        created_jobs.append(coro)
        return MagicMock()

    with patch("app.services.scheduled_scans.AsyncSessionLocal", return_value=session):
        with patch("app.api.v1.endpoints.agent_tasks._execute_agent_task", fake_execute_agent_task):
            with patch("app.services.scheduled_scans.asyncio.create_task", side_effect=fake_create_task):
                await ScheduledScanRunner().run_once()

    added_task = session.added[0]
    assert isinstance(added_task, AgentTask)
    assert added_task.audit_scope["scheduled_scan_id"] == schedule.id
    assert added_task.branch_name == "develop"
    assert added_task.exclude_patterns == ["node_modules/**"]
    assert added_task.target_files == ["src/app.py"]
    assert session.committed is True
    assert len(created_jobs) == 1


@pytest.mark.asyncio
async def test_scheduled_runner_keeps_fast_schedule_on_audit_task_path():
    schedule = _due_schedule("fast")
    project = SimpleNamespace(
        id="proj-1",
        is_active=True,
        source_type="repository",
        default_branch="main",
    )
    session = _FakeSession([schedule], project)
    created_jobs = []

    async def fake_load_user_config(_user_id):
        return {}

    def fake_create_task(coro):
        coro.close()
        created_jobs.append(coro)
        return MagicMock()

    with patch("app.services.scheduled_scans.AsyncSessionLocal", return_value=session):
        with patch("app.services.scheduled_scans._load_user_config", fake_load_user_config):
            with patch("app.services.scheduled_scans.asyncio.create_task", side_effect=fake_create_task):
                await ScheduledScanRunner().run_once()

    added_task = session.added[0]
    assert isinstance(added_task, AuditTask)
    assert added_task.task_type == "scheduled_scan"
    assert session.committed is True
    assert len(created_jobs) == 1
