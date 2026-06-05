"""代码分析服务

提供统一的代码分析入口，整合:
- API 接口资产提取
- 函数调用图分析
- 文件包含/依赖关系
- 控制流图生成
"""

import os
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path
from dataclasses import dataclass, field, asdict, is_dataclass

from .parser import TreeSitterParser
from .extractors import (
    FileDependencyExtractor,
    APIEndpointExtractor,
    CallGraphExtractor,
    ControlFlowExtractor,
    ImportInfo,
    APIEndpointInfo,
    CallEdgeInfo,
    ControlFlowResult,
)

logger = logging.getLogger(__name__)


@dataclass
class APIEndpoint:
    """API 端点信息"""
    file_path: str
    line_number: int
    method: str  # GET, POST, PUT, DELETE, etc.
    path: str  # URL path pattern
    handler: Optional[str] = None  # Handler function name
    framework: Optional[str] = None  # Framework name (spring, express, etc.)
    parameters: List[Dict[str, str]] = field(default_factory=list)
    annotations: List[str] = field(default_factory=list)
    source_code: Optional[str] = None


@dataclass
class CallEdge:
    """函数调用边"""
    caller_file: str
    caller_function: str
    caller_line: int
    callee_file: Optional[str]  # 可能为空(外部调用)
    callee_function: str
    call_type: str = "direct"  # direct, virtual, dynamic


@dataclass
class FileDependency:
    """文件依赖关系"""
    source_file: str
    target_file: str
    dependency_type: str  # import, include, require, etc.
    line_number: int
    is_external: bool = False  # 是否为外部依赖


@dataclass
class ControlFlowNode:
    """控制流节点"""
    node_id: str
    node_type: str  # entry, exit, branch, merge, statement
    line_number: int
    file_path: str
    condition: Optional[str] = None  # 条件表达式(针对分支节点)
    statements: List[str] = field(default_factory=list)


@dataclass
class ControlFlowEdge:
    """控制流边"""
    source_id: str
    target_id: str
    edge_type: str  # normal, true, false, exception


class CodeAnalysisService:
    """
    代码分析服务 - 统一入口

    提供项目级别的代码静态分析能力，支持多种编程语言。
    """

    # 支持的语言及其文件扩展名
    # 注意：实际可解析的语言由 TreeSitterParser.LANGUAGE_MAP 决定（由 tree-sitter-language-pack 加载）。
    # 这里列出所有"候选语言"。若某语言 tree-sitter 没加载，对应文件会在 parse_file() 处优雅返回 None。
    LANGUAGE_EXTENSIONS = {
        # Java / JVM
        '.java': 'java',
        '.kt': 'kotlin',
        '.kts': 'kotlin',
        '.scala': 'scala',
        '.groovy': 'groovy',
        # C / C++ / Obj-C
        '.c': 'c',
        '.h': 'c',
        '.cpp': 'cpp',
        '.hpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.hh': 'cpp',
        '.hxx': 'cpp',
        '.m': 'objc',
        '.mm': 'objc',
        # JS / TS
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.mjs': 'javascript',
        '.cjs': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.mts': 'typescript',
        '.cts': 'typescript',
        # Python
        '.py': 'python',
        '.pyi': 'python',
        '.pyw': 'python',
        # Go
        '.go': 'go',
        # PHP
        '.php': 'php',
        '.phtml': 'php',
        # Ruby
        '.rb': 'ruby',
        # C#
        '.cs': 'csharp',
        # Rust
        '.rs': 'rust',
        # Swift
        '.swift': 'swift',
        # Lua
        '.lua': 'lua',
    }

    # 默认排除模式
    DEFAULT_EXCLUDE_PATTERNS = [
        'node_modules/',
        '__pycache__/',
        '.git/',
        'venv/',
        '.venv/',
        'dist/',
        'build/',
        'target/',
        '.idea/',
        '.vscode/',
        'vendor/',
        'third_party/',
        'third-party/',
        'minified/',
        '.min.js',
    ]

    def __init__(self, project_root: str):
        """
        初始化代码分析服务

        Args:
            project_root: 项目根目录路径
        """
        self.project_root = os.path.abspath(project_root)
        self.parser = TreeSitterParser()

        # 初始化提取器
        self._file_dependency_extractor = FileDependencyExtractor(self.parser)
        self._api_endpoint_extractor = APIEndpointExtractor(self.parser)
        self._call_graph_extractor = CallGraphExtractor(self.parser)
        self._control_flow_extractor = ControlFlowExtractor(self.parser)

        logger.info(f"CodeAnalysisService initialized for project: {self.project_root}")

    def detect_language(self, file_path: str) -> Optional[str]:
        """
        检测文件语言

        Args:
            file_path: 文件路径

        Returns:
            语言名称或 None
        """
        ext = Path(file_path).suffix.lower()
        return self.LANGUAGE_EXTENSIONS.get(ext)

    def analyze(
        self,
        exclude_patterns: Optional[List[str]] = None,
        target_files: Optional[List[str]] = None,
        extract_api: bool = True,
        extract_calls: bool = True,
        extract_dependencies: bool = True,
        extract_control_flow: bool = False,
    ) -> Dict[str, Any]:
        """
        执行完整代码分析

        Args:
            exclude_patterns: 排除模式列表
            target_files: 目标文件列表(相对于项目根目录)
            extract_api: 是否提取 API 端点
            extract_calls: 是否提取调用关系
            extract_dependencies: 是否提取文件依赖
            extract_control_flow: 是否提取控制流

        Returns:
            分析结果字典
        """
        results = {
            "project_root": self.project_root,
            "api_endpoints": [],
            "call_graph": [],
            "file_dependencies": [],
            "control_flow": {},
            "statistics": {
                "total_files": 0,
                "analyzed_files": 0,
                "by_language": {},
            }
        }

        # 合并排除模式
        exclude_set = set(exclude_patterns or [])
        exclude_set.update(self.DEFAULT_EXCLUDE_PATTERNS)

        # 扫描文件
        files = self._scan_files(list(exclude_set), target_files)
        results["statistics"]["total_files"] = len(files)

        logger.info(f"Found {len(files)} files to analyze")

        # 按语言分组统计
        for file_path in files:
            lang = self.detect_language(file_path)
            if lang:
                results["statistics"]["by_language"][lang] = \
                    results["statistics"]["by_language"].get(lang, 0) + 1

        # 执行分析
        # project_functions：收集本次扫描所有文件解析出的函数名（去重 set）
        # 用于主循环结束后过滤 call_graph，只保留「项目内函数 A 调项目内函数 B」的边。
        # 这是噪音控制的核心——实测可把测试断言、内置 API、JSX 工厂等噪音过滤掉约 70-80%。
        project_functions: set = set()

        for file_path in files:
            try:
                file_result = self._analyze_single_file(
                    file_path,
                    extract_api=extract_api,
                    extract_calls=extract_calls,
                    extract_dependencies=extract_dependencies,
                    extract_control_flow=extract_control_flow,
                )

                # 合并结果
                if extract_api:
                    results["api_endpoints"].extend(file_result.get("api_endpoints", []))
                if extract_calls:
                    results["call_graph"].extend(file_result.get("call_graph", []))
                    project_functions.update(file_result.get("function_names", []))
                if extract_dependencies:
                    results["file_dependencies"].extend(file_result.get("file_dependencies", []))
                if extract_control_flow:
                    rel_path = os.path.relpath(file_path, self.project_root)
                    cf_result = file_result.get("control_flow")
                    if cf_result:
                        results["control_flow"][rel_path] = cf_result

                results["statistics"]["analyzed_files"] += 1

            except Exception as e:
                logger.error(f"Failed to analyze file {file_path}: {e}")

        # 主循环后过滤 call_graph：只保留 callee 在项目内的边。
        # 保险栓：project_functions 为空（极端情况：项目里一个函数都没解析出来）时跳过过滤，
        # 否则会把全部 call_graph 清空。
        if extract_calls and project_functions:
            before = len(results["call_graph"])
            results["call_graph"] = [
                edge for edge in results["call_graph"]
                if edge.get("callee_name") in project_functions
            ]
            after = len(results["call_graph"])
            logger.info(
                "call_graph filtered: %d → %d edges (kept project-internal only; "
                "%d distinct project functions)",
                before, after, len(project_functions),
            )
        elif extract_calls and results["call_graph"]:
            logger.warning(
                "call_graph filter skipped: project_functions is empty "
                "(kept all %d edges as fallback)",
                len(results["call_graph"]),
            )

        logger.info(f"Analysis completed: {results['statistics']}")

        return results

    def analyze_file(
        self,
        file_path: str,
        extract_api: bool = True,
        extract_calls: bool = True,
        extract_dependencies: bool = True,
    ) -> Dict[str, Any]:
        """
        分析单个文件

        Args:
            file_path: 文件路径
            extract_api: 是否提取 API 端点
            extract_calls: 是否提取调用关系
            extract_dependencies: 是否提取文件依赖

        Returns:
            文件分析结果
        """
        abs_path = os.path.abspath(file_path)
        rel_path = os.path.relpath(abs_path, self.project_root)
        language = self.detect_language(abs_path)

        results = {
            "file_path": rel_path,
            "language": language,
            "api_endpoints": [],
            "function_calls": [],
            "imports": [],
            "definitions": [],
            "error": None,
        }

        if language is None:
            results["error"] = f"Unsupported file type: {abs_path}"
            return results

        # 解析文件
        tree = self.parser.parse_file(abs_path, language)
        if tree is None:
            results["error"] = f"Failed to parse file: {abs_path}"
            return results

        # 读取源代码(用于提取文本)
        try:
            with open(abs_path, "rb") as f:
                source_code = f.read()
        except Exception as e:
            results["error"] = f"Failed to read file: {e}"
            return results

        # 调用提取器
        if extract_dependencies:
            imports = self._file_dependency_extractor.extract(tree, source_code, rel_path, language)
            results["imports"] = [
                {
                    "module_name": imp.module_name,
                    "imported_names": imp.imported_names,
                    "line_number": imp.line_number,
                    "import_type": imp.import_type,
                    "is_external": imp.is_external,
                    "alias": imp.alias,
                }
                for imp in imports
            ]

        if extract_api:
            endpoints = self._api_endpoint_extractor.extract(tree, source_code, rel_path, language)
            results["api_endpoints"] = [
                {
                    "file_path": ep.file_path,
                    "line_number": ep.line_number,
                    "method": ep.method,
                    "path": ep.path,
                    "handler": ep.handler,
                    "framework": ep.framework,
                    "parameters": ep.parameters,
                    "annotations": ep.annotations,
                    "source_snippet": ep.source_snippet,
                }
                for ep in endpoints
            ]

        if extract_calls:
            calls = self._call_graph_extractor.extract(tree, source_code, rel_path, language)
            results["function_calls"] = [
                {
                    "caller_file": call.caller_file,
                    "caller_function": call.caller_function,
                    "caller_line": call.caller_line,
                    "callee_name": call.callee_name,
                    "callee_object": call.callee_object,
                    "call_type": call.call_type,
                    "arguments": call.arguments,
                }
                for call in calls
            ]

        return results

    def _analyze_single_file(
        self,
        file_path: str,
        extract_api: bool = True,
        extract_calls: bool = True,
        extract_dependencies: bool = True,
        extract_control_flow: bool = False,
    ) -> Dict[str, Any]:
        """
        分析单个文件（内部方法）

        Args:
            file_path: 文件绝对路径
            extract_api: 是否提取 API 端点
            extract_calls: 是否提取调用关系
            extract_dependencies: 是否提取文件依赖
            extract_control_flow: 是否提取控制流

        Returns:
            文件分析结果
        """
        rel_path = os.path.relpath(file_path, self.project_root)
        language = self.detect_language(file_path)

        result = {
            "file_path": rel_path,
            "language": language,
            "api_endpoints": [],
            "call_graph": [],
            "file_dependencies": [],
            "control_flow": None,
        }

        if language is None:
            return result

        # 解析文件
        tree = self.parser.parse_file(file_path, language)
        if tree is None:
            return result

        # 读取源代码
        try:
            with open(file_path, "rb") as f:
                source_code = f.read()
        except Exception as e:
            logger.error(f"Failed to read file {file_path}: {e}")
            return result

        # 提取 API 端点
        if extract_api:
            endpoints = self._api_endpoint_extractor.extract(tree, source_code, rel_path, language)
            # 将 dataclass 对象转换为字典，确保 JSON 序列化正常
            result["api_endpoints"] = [asdict(ep) if is_dataclass(ep) else ep for ep in endpoints]

        # 提取调用图
        if extract_calls:
            calls = self._call_graph_extractor.extract(tree, source_code, rel_path, language)
            # 将 dataclass 对象转换为字典
            result["call_graph"] = [asdict(call) if is_dataclass(call) else call for call in calls]

            # 同时收集本文件解析出的函数名（用于 analyze() 做项目内调用过滤）。
            # _build_function_map 是 protected 的；extract() 内部已构造过一次但未返回，
            # 这里再调一次只遍历 FUNCTION_NODE_TYPES，开销远低于 extract() 主流程。
            try:
                func_map = self._call_graph_extractor._build_function_map(tree, source_code, language)
                result["function_names"] = [name for name in func_map.values() if name]
            except Exception as e:
                logger.debug(f"Failed to collect function names for {rel_path}: {e}")
                result["function_names"] = []

        # 提取文件依赖
        if extract_dependencies:
            imports = self._file_dependency_extractor.extract(tree, source_code, rel_path, language)
            # 将 dataclass 对象转换为字典
            result["file_dependencies"] = [
                asdict(FileDependency(
                    source_file=rel_path,
                    target_file=imp.module_name,
                    dependency_type=imp.import_type,
                    line_number=imp.line_number,
                    is_external=imp.is_external,
                ))
                for imp in imports
            ]

        # 提取控制流
        if extract_control_flow:
            cf_result = self._control_flow_extractor.extract(tree, source_code, rel_path, language)
            result["control_flow"] = {
                "nodes": [
                    {
                        "node_id": node.node_id,
                        "node_type": node.node_type,
                        "line_number": node.line_number,
                        "condition": node.condition,
                        "statements": node.statements,
                        "depth": node.depth,
                    }
                    for node in cf_result.nodes
                ],
                "edges": [
                    {
                        "source_id": edge.source_id,
                        "target_id": edge.target_id,
                        "edge_type": edge.edge_type,
                    }
                    for edge in cf_result.edges
                ],
                "complexity": cf_result.complexity,
            }

        return result

    def _scan_files(
        self,
        exclude_patterns: List[str],
        target_files: Optional[List[str]] = None
    ) -> List[str]:
        """
        扫描项目文件

        Args:
            exclude_patterns: 排除模式列表
            target_files: 目标文件列表(相对路径)

        Returns:
            文件路径列表(绝对路径)
        """
        files = []
        target_set = set(target_files) if target_files else None
        # 诊断计数器
        seen_files = 0
        skipped_by_dir_exclude = 0
        skipped_by_file_exclude = 0
        skipped_unsupported = 0
        skipped_not_target = 0

        try:
            for root, dirs, filenames in os.walk(self.project_root):
                # 过滤排除的目录
                before = len(dirs)
                dirs[:] = [d for d in dirs if not self._should_exclude_dir(d, exclude_patterns)]
                skipped_by_dir_exclude += (before - len(dirs))

                for filename in filenames:
                    seen_files += 1
                    file_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(file_path, self.project_root)

                    # 检查排除模式
                    if self._should_exclude_file(rel_path, exclude_patterns):
                        skipped_by_file_exclude += 1
                        continue

                    # 检查是否是目标语言文件
                    if not self.detect_language(file_path):
                        skipped_unsupported += 1
                        continue

                    # 如果指定了目标文件，只处理目标文件
                    if target_set and rel_path not in target_set:
                        skipped_not_target += 1
                        continue

                    files.append(file_path)

        except Exception as e:
            logger.error(f"Error scanning files: {e}")

        # 诊断输出：帮助排查 "Found 0 files" 类问题
        logger.info(
            f"[scan_files] root={self.project_root} "
            f"seen={seen_files} kept={len(files)} "
            f"skip_dir={skipped_by_dir_exclude} skip_file_exclude={skipped_by_file_exclude} "
            f"skip_unsupported_ext={skipped_unsupported} skip_not_target={skipped_not_target} "
            f"target_files_filter={'on' if target_set else 'off'}"
        )
        if len(files) == 0 and seen_files > 0:
            logger.warning(
                f"[scan_files] No files matched out of {seen_files} seen. "
                f"Possible causes: all files excluded by patterns ({skipped_by_file_exclude}), "
                f"unsupported extensions ({skipped_unsupported}), "
                f"or target_files filter mismatched ({skipped_not_target})."
            )

        return files

    def _should_exclude_dir(self, dir_name: str, exclude_patterns: List[str]) -> bool:
        """检查目录是否应该被排除

        匹配规则（按精确度优先）：
        - pattern 以 `/` 结尾且去掉 `/` 后与 dir_name 相等：精确匹配（如 'node_modules/' 排除 'node_modules'）
        - pattern 中不含 `/`，且与 dir_name 相等：精确匹配（如 'node_modules'）
        - 含 glob 通配符则用 fnmatch
        - 否则一律不匹配（避免子串误杀，如旧逻辑 `'node' in 'node_modules/'` 会把 'node' 目录也排除）
        """
        import fnmatch
        for raw_pattern in exclude_patterns:
            pattern = (raw_pattern or "").strip()
            if not pattern:
                continue
            # 精确目录匹配
            if pattern.endswith('/'):
                if pattern[:-1] == dir_name:
                    return True
                continue
            # glob 通配
            if any(ch in pattern for ch in '*?['):
                if fnmatch.fnmatch(dir_name, pattern):
                    return True
                continue
            # 不含 / 的纯名字，按精确匹配
            if '/' not in pattern and pattern == dir_name:
                return True
        return False

    def _should_exclude_file(self, rel_path: str, exclude_patterns: List[str]) -> bool:
        """检查文件是否应该被排除

        匹配规则：
        - pattern 以 `.` 开头（如 '.min.js'）：按文件名后缀匹配
        - pattern 以 `/` 结尾（如 'dist/'）：路径中包含该目录段则匹配
        - pattern 含通配符：fnmatch 全路径或 basename
        - 否则按"路径段精确匹配"（如 pattern='vendor' 匹配 'a/vendor/b.js'）
          —— 不再用 `if pattern in rel_path` 这种子串匹配（避免 'targeting.ts' 命中 'target'）。
        """
        import fnmatch
        # 规范化分隔符
        norm_path = rel_path.replace('\\', '/')
        segments = set(norm_path.split('/'))
        basename = norm_path.rsplit('/', 1)[-1]

        for raw_pattern in exclude_patterns:
            pattern = (raw_pattern or "").strip()
            if not pattern:
                continue
            # 后缀 / 隐藏文件型
            if pattern.startswith('.'):
                if basename.endswith(pattern) or pattern in segments:
                    return True
                continue
            # 目录段匹配
            if pattern.endswith('/'):
                if pattern[:-1] in segments:
                    return True
                continue
            # glob
            if any(ch in pattern for ch in '*?['):
                if fnmatch.fnmatch(norm_path, pattern) or fnmatch.fnmatch(basename, pattern):
                    return True
                continue
            # 路径段精确匹配（兼容用户传入裸目录名）
            if pattern in segments:
                return True
        return False

    def get_supported_languages(self) -> List[str]:
        """获取支持的语言列表"""
        return list(set(self.LANGUAGE_EXTENSIONS.values()))

    def get_project_structure(self) -> Dict[str, Any]:
        """
        获取项目结构

        Returns:
            项目结构树
        """
        structure = {
            "name": os.path.basename(self.project_root),
            "type": "directory",
            "children": [],
        }

        def build_tree(path: str, node: dict):
            try:
                items = sorted(os.listdir(path))
            except PermissionError:
                return

            for item in items:
                item_path = os.path.join(path, item)

                # 跳过隐藏文件和排除目录
                if item.startswith('.'):
                    continue
                if self._should_exclude_dir(item, self.DEFAULT_EXCLUDE_PATTERNS):
                    continue

                if os.path.isdir(item_path):
                    child = {
                        "name": item,
                        "type": "directory",
                        "children": [],
                    }
                    build_tree(item_path, child)
                    if child["children"]:  # 只添加非空目录
                        node["children"].append(child)
                else:
                    lang = self.detect_language(item_path)
                    if lang:
                        node["children"].append({
                            "name": item,
                            "type": "file",
                            "language": lang,
                        })

        build_tree(self.project_root, structure)
        return structure