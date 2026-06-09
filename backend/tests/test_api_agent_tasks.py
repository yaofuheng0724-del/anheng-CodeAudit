"""
Tests for app/api/v1/endpoints/agent_tasks.py

Covers:
- list_agent_tasks: safe response serialization and status filtering
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api.v1.endpoints.agent_tasks import AgentTaskResponse, list_agent_tasks
from app.models.agent_task import AgentTask, AgentTaskStatus


USER_ID = "user-001"
PROJECT_ID = "proj-001"
TASK_ID = "agent-task-001"


def _make_user(user_id=USER_ID):
    user = MagicMock()
    user.id = user_id
    return user


def _make_task(**overrides):
    values = {
        "id": TASK_ID,
        "project_id": PROJECT_ID,
        "name": "Deep audit",
        "description": "Agent audit task",
        "task_type": "agent_audit",
        "status": AgentTaskStatus.RUNNING,
        "current_phase": "analysis",
        "current_step": "Analyzing files",
        "total_files": 10,
        "total_lines": 500,
        "indexed_files": 10,
        "analyzed_files": 5,
        "total_chunks": 20,
        "total_iterations": 3,
        "tool_calls_count": 7,
        "tokens_used": 1200,
        "findings_count": 2,
        "verified_count": 1,
        "false_positive_count": 0,
        "critical_count": 0,
        "high_count": 1,
        "medium_count": 1,
        "low_count": 0,
        "quality_score": 88.5,
        "security_score": 72.0,
        "created_at": datetime.now(timezone.utc),
        "started_at": datetime.now(timezone.utc),
        "completed_at": None,
        "error_message": None,
        "audit_scope": {"type": "full"},
        "target_vulnerabilities": ["sql_injection"],
        "verification_level": "sandbox",
        "exclude_patterns": ["node_modules"],
        "target_files": ["app/main.py"],
        "agent_config": {
            "functionWhitelist": ["safe_query"],
            "vulnerabilityWhitelist": ["known-fp"],
            "sanitizerFunctions": ["escape_html"],
        },
    }
    values.update(overrides)
    return AgentTask(**values)


@pytest.mark.asyncio
async def test_list_agent_tasks_returns_serialized_response_models():
    db = AsyncMock()

    project_result = MagicMock()
    project_result.fetchall.return_value = [(PROJECT_ID,)]

    task = _make_task()
    task_result = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = [task]
    task_result.scalars.return_value = scalars

    counts_result = MagicMock()
    counts_result.all.return_value = [(TASK_ID, 2)]

    db.execute.side_effect = [project_result, task_result, counts_result]

    result = await list_agent_tasks(limit=100, db=db, current_user=_make_user())

    assert len(result) == 1
    assert isinstance(result[0], AgentTaskResponse)
    assert result[0].id == TASK_ID
    assert result[0].total_findings == 2
    assert result[0].verified_findings == 1
    assert result[0].functionWhitelist == ["safe_query"]
    assert result[0].vulnerabilityWhitelist == ["known-fp"]
    assert result[0].sanitizerFunctions == ["escape_html"]


@pytest.mark.asyncio
async def test_list_agent_tasks_valid_status_filter_does_not_call_status_as_enum():
    db = AsyncMock()

    project_result = MagicMock()
    project_result.fetchall.return_value = [(PROJECT_ID,)]

    task_result = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = []
    task_result.scalars.return_value = scalars

    db.execute.side_effect = [project_result, task_result]

    result = await list_agent_tasks(status=AgentTaskStatus.RUNNING, db=db, current_user=_make_user())

    assert result == []
