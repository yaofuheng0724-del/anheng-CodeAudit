"""
Tests for CodeAnalysisService.analyze() — focused on the call_graph
project-internal filter introduced to cut noise (test assertions, builtins,
JSX factories, etc.) from massive scans.

We bypass tree-sitter entirely by patching _analyze_single_file and
_scan_files; the filter logic lives in the main loop and is what we want
to cover.
"""

import logging
from unittest.mock import patch

import pytest

from app.services.code_analysis.service import CodeAnalysisService


def _make_edge(callee_name: str, caller_function: str = "myFunc"):
    """Mimic the dict shape produced by extract_calls in _analyze_single_file."""
    return {
        "caller_file": "src/a.ts",
        "caller_function": caller_function,
        "caller_line": 10,
        "callee_name": callee_name,
        "callee_object": None,
        "call_type": "direct",
        "arguments": [],
    }


@pytest.fixture
def service(tmp_path):
    # project_root must exist (constructor calls os.path.abspath); contents don't matter
    return CodeAnalysisService(str(tmp_path))


def test_call_graph_filters_external_callees(service):
    """callee 不在 project_functions 集合里的边应当被剔除。"""
    fake_file_results = {
        "/tmp/a.ts": {
            "file_path": "src/a.ts",
            "language": "typescript",
            "api_endpoints": [],
            "call_graph": [
                _make_edge("foo"),         # 项目内函数 → 保留
                _make_edge("bar"),         # 项目内函数 → 保留
                _make_edge("assertThat"),  # 测试断言 → 剔除
                _make_edge("isEqualTo"),   # 测试断言 → 剔除
                _make_edge("Number"),      # 内置 → 剔除
                _make_edge("jsx"),         # JSX 工厂 → 剔除
            ],
            "function_names": ["foo", "bar"],
            "file_dependencies": [],
            "control_flow": None,
        },
    }

    def fake_single(file_path, **_kw):
        return fake_file_results[file_path]

    with patch.object(service, "_scan_files", return_value=list(fake_file_results.keys())), \
         patch.object(service, "_analyze_single_file", side_effect=fake_single):
        result = service.analyze(extract_calls=True, extract_api=False,
                                 extract_dependencies=False, extract_control_flow=False)

    kept = [e["callee_name"] for e in result["call_graph"]]
    assert kept == ["foo", "bar"]


def test_call_graph_passes_through_when_no_functions(service, caplog):
    """project_functions 为空时跳过过滤，原样返回所有边并打 warning。"""
    fake_results = {
        "/tmp/x.cfg": {
            "file_path": "x.cfg",
            "language": None,
            "api_endpoints": [],
            "call_graph": [_make_edge("anything"), _make_edge("more")],
            "function_names": [],  # 空：没解析出任何函数
            "file_dependencies": [],
            "control_flow": None,
        },
    }

    def fake_single(file_path, **_kw):
        return fake_results[file_path]

    with patch.object(service, "_scan_files", return_value=list(fake_results.keys())), \
         patch.object(service, "_analyze_single_file", side_effect=fake_single), \
         caplog.at_level(logging.WARNING, logger="app.services.code_analysis.service"):
        result = service.analyze(extract_calls=True, extract_api=False,
                                 extract_dependencies=False, extract_control_flow=False)

    # 兜底：原样保留全部边
    assert [e["callee_name"] for e in result["call_graph"]] == ["anything", "more"]
    # 告知运维：跳过了过滤
    assert any("project_functions is empty" in rec.message for rec in caplog.records)


def test_call_graph_filter_skipped_when_extract_calls_false(service):
    """extract_calls=False 时不应该触发过滤分支（call_graph 也不会有数据）。"""
    fake_results = {
        "/tmp/a.ts": {
            "file_path": "src/a.ts",
            "language": "typescript",
            "api_endpoints": [{"path": "/x"}],
            "call_graph": [],
            "function_names": [],
            "file_dependencies": [],
            "control_flow": None,
        },
    }

    def fake_single(file_path, **_kw):
        return fake_results[file_path]

    with patch.object(service, "_scan_files", return_value=list(fake_results.keys())), \
         patch.object(service, "_analyze_single_file", side_effect=fake_single):
        result = service.analyze(extract_calls=False, extract_api=True,
                                 extract_dependencies=False, extract_control_flow=False)

    assert result["call_graph"] == []
    assert result["api_endpoints"] == [{"path": "/x"}]


def test_call_graph_aggregates_functions_across_files(service):
    """project_functions 集合应跨文件累加 —— 不同文件定义的函数都视为项目内。"""
    fake_results = {
        "/tmp/a.ts": {
            "file_path": "src/a.ts",
            "language": "typescript",
            "api_endpoints": [],
            "call_graph": [_make_edge("helperInB")],   # a.ts 里调用 b.ts 定义的 helperInB
            "function_names": ["foo"],
            "file_dependencies": [],
            "control_flow": None,
        },
        "/tmp/b.ts": {
            "file_path": "src/b.ts",
            "language": "typescript",
            "api_endpoints": [],
            "call_graph": [_make_edge("foo")],         # b.ts 里调用 a.ts 定义的 foo
            "function_names": ["helperInB"],
            "file_dependencies": [],
            "control_flow": None,
        },
    }

    def fake_single(file_path, **_kw):
        return fake_results[file_path]

    with patch.object(service, "_scan_files", return_value=list(fake_results.keys())), \
         patch.object(service, "_analyze_single_file", side_effect=fake_single):
        result = service.analyze(extract_calls=True, extract_api=False,
                                 extract_dependencies=False, extract_control_flow=False)

    kept = sorted(e["callee_name"] for e in result["call_graph"])
    assert kept == ["foo", "helperInB"]  # 跨文件调用都被保留
