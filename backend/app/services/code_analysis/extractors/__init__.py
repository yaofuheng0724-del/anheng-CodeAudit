"""代码资产提取器模块

提供各类代码资产的提取器:
- API 端点提取
- 函数调用关系提取
- 文件依赖提取
- 控制流分析
"""

from .base import BaseExtractor
from .file_dependency import FileDependencyExtractor, ImportInfo
from .api_endpoint import APIEndpointExtractor, APIEndpointInfo
from .call_graph import CallGraphExtractor, CallEdgeInfo
from .control_flow import (
    ControlFlowExtractor,
    ControlFlowNodeInfo,
    ControlFlowEdgeInfo,
    ControlFlowResult,
)

__all__ = [
    # 基础类
    'BaseExtractor',

    # 文件依赖
    'FileDependencyExtractor',
    'ImportInfo',

    # API 端点
    'APIEndpointExtractor',
    'APIEndpointInfo',

    # 调用图
    'CallGraphExtractor',
    'CallEdgeInfo',

    # 控制流
    'ControlFlowExtractor',
    'ControlFlowNodeInfo',
    'ControlFlowEdgeInfo',
    'ControlFlowResult',
]
