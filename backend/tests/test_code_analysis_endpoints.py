"""
Tests for code analysis lazy-load endpoints (Task 1-3).

Covers:
- _get_code_analysis_summary / _get_code_analysis_section helpers
- GET /tasks/{id}/code-analysis/summary
- GET /tasks/{id}/code-analysis/{section}
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.api.v1.endpoints.tasks import (
    _CODE_ANALYSIS_SECTIONS,
    _CODE_ANALYSIS_TABLES,
    _PAGEABLE_SECTIONS,
    _get_code_analysis_summary,
    _get_code_analysis_section,
    _get_code_analysis_section_page,
    get_code_analysis_summary,
    get_code_analysis_section,
    get_code_analysis_section_page,
)


USER_ID = "user-001"
TASK_ID = "task-001"


def _make_user(user_id=USER_ID):
    user = MagicMock()
    user.id = user_id
    user.is_active = True
    return user


def _mock_db_execute_returns(row):
    """构造一个 db.execute 的 mock，让 .one_or_none() 返回 row。"""
    db = MagicMock()
    result_proxy = MagicMock()
    result_proxy.one_or_none.return_value = row
    db.execute = AsyncMock(return_value=result_proxy)
    return db


def _mock_db_execute_raises(exc):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=exc)
    return db


def _mock_db_execute_returns_rows(rows):
    """构造一个 db.execute 的 mock，让 .all() 返回 rows 列表。"""
    db = MagicMock()
    result_proxy = MagicMock()
    result_proxy.all.return_value = rows
    db.execute = AsyncMock(return_value=result_proxy)
    return db


# ─────────────────────────────────────────
# Module-level constants sanity check
# ─────────────────────────────────────────


def test_section_whitelist_constants():
    assert "api_endpoints" in _CODE_ANALYSIS_SECTIONS
    assert "call_graph" in _CODE_ANALYSIS_SECTIONS
    assert "file_dependencies" in _CODE_ANALYSIS_SECTIONS
    assert "control_flow" in _CODE_ANALYSIS_SECTIONS
    assert "audit_tasks" in _CODE_ANALYSIS_TABLES
    assert "agent_tasks" in _CODE_ANALYSIS_TABLES


# ─────────────────────────────────────────
# Helper: _get_code_analysis_summary
# ─────────────────────────────────────────


class TestGetCodeAnalysisSummary:
    @pytest.mark.asyncio
    async def test_returns_counts(self):
        row = MagicMock(api_count=5, call_count=10, dep_count=3, cfg_count=2)
        db = _mock_db_execute_returns(row)
        result = await _get_code_analysis_summary(db, TASK_ID)
        assert result == {
            "api_endpoints": 5,
            "call_graph": 10,
            "file_dependencies": 3,
            "control_flow_files": 2,
        }

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_row(self):
        db = _mock_db_execute_returns(None)
        result = await _get_code_analysis_summary(db, TASK_ID)
        assert result == {}

    @pytest.mark.asyncio
    async def test_fallback_on_db_error(self):
        db = _mock_db_execute_raises(Exception("boom"))
        result = await _get_code_analysis_summary(db, TASK_ID)
        assert result == {
            "api_endpoints": -1,
            "call_graph": -1,
            "file_dependencies": -1,
            "control_flow_files": -1,
        }

    @pytest.mark.asyncio
    async def test_invalid_task_table_raises(self):
        db = MagicMock()
        with pytest.raises(ValueError, match="invalid task_table"):
            await _get_code_analysis_summary(db, TASK_ID, task_table="injection;drop")

    @pytest.mark.asyncio
    async def test_handles_null_counts(self):
        row = MagicMock(api_count=None, call_count=None, dep_count=None, cfg_count=None)
        db = _mock_db_execute_returns(row)
        result = await _get_code_analysis_summary(db, TASK_ID)
        assert result == {
            "api_endpoints": 0,
            "call_graph": 0,
            "file_dependencies": 0,
            "control_flow_files": 0,
        }

    @pytest.mark.asyncio
    async def test_accepts_agent_tasks_table(self):
        row = MagicMock(api_count=1, call_count=2, dep_count=3, cfg_count=4)
        db = _mock_db_execute_returns(row)
        result = await _get_code_analysis_summary(db, TASK_ID, task_table="agent_tasks")
        assert result["api_endpoints"] == 1
        assert result["control_flow_files"] == 4


# ─────────────────────────────────────────
# Helper: _get_code_analysis_section
# ─────────────────────────────────────────


class TestGetCodeAnalysisSection:
    @pytest.mark.asyncio
    async def test_returns_section_data(self):
        payload = [{"method": "GET", "path": "/users"}]
        row = MagicMock(value=payload)
        db = _mock_db_execute_returns(row)
        result = await _get_code_analysis_section(db, TASK_ID, "api_endpoints")
        assert result == payload

    @pytest.mark.asyncio
    async def test_returns_none_when_no_row(self):
        db = _mock_db_execute_returns(None)
        result = await _get_code_analysis_section(db, TASK_ID, "api_endpoints")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_value_null(self):
        db = _mock_db_execute_returns(MagicMock(value=None))
        result = await _get_code_analysis_section(db, TASK_ID, "api_endpoints")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_invalid_section(self):
        db = MagicMock()
        db.execute = AsyncMock()
        result = await _get_code_analysis_section(db, TASK_ID, "bogus_section")
        assert result is None
        # 关键：白名单拒绝时不应触发 SQL
        db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_fallback_to_none_on_db_error(self):
        db = _mock_db_execute_raises(Exception("boom"))
        result = await _get_code_analysis_section(db, TASK_ID, "call_graph")
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_task_table_raises(self):
        db = MagicMock()
        with pytest.raises(ValueError, match="invalid task_table"):
            await _get_code_analysis_section(
                db, TASK_ID, "api_endpoints", task_table="x;drop"
            )

    @pytest.mark.asyncio
    async def test_returns_control_flow_dict(self):
        payload = {"file_a.py": {"branches": 3}}
        row = MagicMock(value=payload)
        db = _mock_db_execute_returns(row)
        result = await _get_code_analysis_section(db, TASK_ID, "control_flow")
        assert result == payload


# ─────────────────────────────────────────
# Endpoint: get_code_analysis_summary
# ─────────────────────────────────────────


class TestSummaryEndpoint:
    @pytest.mark.asyncio
    async def test_returns_summary(self):
        db = MagicMock()
        user = _make_user()
        summary = {
            "api_endpoints": 5,
            "call_graph": 10,
            "file_dependencies": 3,
            "control_flow_files": 2,
        }
        with patch(
            "app.api.v1.endpoints.tasks._verify_task_access",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.api.v1.endpoints.tasks._get_code_analysis_summary",
            new=AsyncMock(return_value=summary),
        ):
            result = await get_code_analysis_summary(TASK_ID, db, user)
            assert result == summary

    @pytest.mark.asyncio
    async def test_propagates_verify_403(self):
        db = MagicMock()
        user = _make_user()
        with patch(
            "app.api.v1.endpoints.tasks._verify_task_access",
            new=AsyncMock(side_effect=HTTPException(status_code=403, detail="no")),
        ):
            with pytest.raises(HTTPException) as exc:
                await get_code_analysis_summary(TASK_ID, db, user)
            assert exc.value.status_code == 403


# ─────────────────────────────────────────
# Endpoint: get_code_analysis_section
# ─────────────────────────────────────────


class TestSectionEndpoint:
    @pytest.mark.asyncio
    async def test_returns_section_data(self):
        db = MagicMock()
        user = _make_user()
        payload = [{"foo": "bar"}]
        with patch(
            "app.api.v1.endpoints.tasks._verify_task_access",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.api.v1.endpoints.tasks._get_code_analysis_section",
            new=AsyncMock(return_value=payload),
        ):
            result = await get_code_analysis_section(TASK_ID, "api_endpoints", db, user)
            assert result == payload

    @pytest.mark.asyncio
    async def test_rejects_invalid_section(self):
        db = MagicMock()
        user = _make_user()
        with pytest.raises(HTTPException) as exc:
            await get_code_analysis_section(TASK_ID, "bogus", db, user)
        assert exc.value.status_code == 400
        assert "bogus" in exc.value.detail

    @pytest.mark.asyncio
    async def test_returns_empty_list_for_missing_list_section(self):
        """list 类型 section（api_endpoints / call_graph / file_dependencies）数据为 None 时返回 []。"""
        db = MagicMock()
        user = _make_user()
        with patch(
            "app.api.v1.endpoints.tasks._verify_task_access",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.api.v1.endpoints.tasks._get_code_analysis_section",
            new=AsyncMock(return_value=None),
        ):
            result = await get_code_analysis_section(TASK_ID, "api_endpoints", db, user)
            assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_dict_for_missing_control_flow(self):
        """control_flow 是 dict 类型，None 时返回 {}。"""
        db = MagicMock()
        user = _make_user()
        with patch(
            "app.api.v1.endpoints.tasks._verify_task_access",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.api.v1.endpoints.tasks._get_code_analysis_section",
            new=AsyncMock(return_value=None),
        ):
            result = await get_code_analysis_section(TASK_ID, "control_flow", db, user)
            assert result == {}


# ─────────────────────────────────────────
# Helper: _get_code_analysis_section_page
# ─────────────────────────────────────────


class TestGetCodeAnalysisSectionPage:
    @pytest.mark.asyncio
    async def test_returns_sliced_items(self):
        rows = [MagicMock(value={"i": 0}), MagicMock(value={"i": 1})]
        db = _mock_db_execute_returns_rows(rows)
        result = await _get_code_analysis_section_page(
            db, TASK_ID, "api_endpoints", offset=10, limit=2,
        )
        assert result == [{"i": 0}, {"i": 1}]

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_rows(self):
        db = _mock_db_execute_returns_rows([])
        result = await _get_code_analysis_section_page(
            db, TASK_ID, "call_graph", offset=0, limit=50,
        )
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_for_non_pageable_section(self):
        """control_flow 不在分页白名单 → 直接返回 []，不触发 SQL。"""
        db = MagicMock()
        db.execute = AsyncMock()
        result = await _get_code_analysis_section_page(
            db, TASK_ID, "control_flow", offset=0, limit=50,
        )
        assert result == []
        db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_empty_for_bogus_section(self):
        db = MagicMock()
        db.execute = AsyncMock()
        result = await _get_code_analysis_section_page(
            db, TASK_ID, "bogus", offset=0, limit=50,
        )
        assert result == []
        db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_invalid_task_table_raises(self):
        db = MagicMock()
        with pytest.raises(ValueError, match="invalid task_table"):
            await _get_code_analysis_section_page(
                db, TASK_ID, "api_endpoints", task_table="x;drop", offset=0, limit=50,
            )

    @pytest.mark.asyncio
    async def test_fallback_to_empty_on_db_error(self):
        db = _mock_db_execute_raises(Exception("boom"))
        result = await _get_code_analysis_section_page(
            db, TASK_ID, "file_dependencies", offset=0, limit=50,
        )
        assert result == []


# ─────────────────────────────────────────
# Module-level constants: pageable subset
# ─────────────────────────────────────────


def test_pageable_sections_subset_of_sections():
    """分页支持的 section 必须是总 section 白名单子集，且不含 control_flow。"""
    assert set(_PAGEABLE_SECTIONS).issubset(set(_CODE_ANALYSIS_SECTIONS))
    assert "control_flow" not in _PAGEABLE_SECTIONS
    assert "api_endpoints" in _PAGEABLE_SECTIONS
    assert "call_graph" in _PAGEABLE_SECTIONS
    assert "file_dependencies" in _PAGEABLE_SECTIONS


# ─────────────────────────────────────────
# Endpoint: get_code_analysis_section_page
# ─────────────────────────────────────────


class TestSectionPageEndpoint:
    @pytest.mark.asyncio
    async def test_returns_page_data(self):
        db = MagicMock()
        user = _make_user()
        payload = [{"i": 0}, {"i": 1}]
        with patch(
            "app.api.v1.endpoints.tasks._verify_task_access",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.api.v1.endpoints.tasks._get_code_analysis_section_page",
            new=AsyncMock(return_value=payload),
        ):
            result = await get_code_analysis_section_page(
                TASK_ID, "api_endpoints", offset=0, limit=50, db=db, current_user=user,
            )
            assert result == payload

    @pytest.mark.asyncio
    async def test_rejects_control_flow(self):
        db = MagicMock()
        user = _make_user()
        with pytest.raises(HTTPException) as exc:
            await get_code_analysis_section_page(
                TASK_ID, "control_flow", offset=0, limit=50, db=db, current_user=user,
            )
        assert exc.value.status_code == 400
        assert "control_flow" in exc.value.detail

    @pytest.mark.asyncio
    async def test_rejects_bogus_section(self):
        db = MagicMock()
        user = _make_user()
        with pytest.raises(HTTPException) as exc:
            await get_code_analysis_section_page(
                TASK_ID, "bogus", offset=0, limit=50, db=db, current_user=user,
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_clamps_limit_and_offset(self):
        """limit/offset 越界值要在传入 helper 前被夹紧。"""
        db = MagicMock()
        user = _make_user()
        captured = {}

        async def fake_page(_db, _tid, _section, *, task_table, offset, limit):
            captured.update(offset=offset, limit=limit)
            return []

        with patch(
            "app.api.v1.endpoints.tasks._verify_task_access",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.api.v1.endpoints.tasks._get_code_analysis_section_page",
            new=fake_page,
        ):
            await get_code_analysis_section_page(
                TASK_ID, "api_endpoints", offset=-100, limit=99999, db=db, current_user=user,
            )
            assert captured["offset"] == 0       # 负值 → 0
            assert captured["limit"] == 500      # 超大值 → 500 上限
