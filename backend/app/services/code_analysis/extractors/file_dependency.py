"""文件依赖提取器

提取文件间的 import/include/require 等依赖关系。
支持 Java, C, C++, JavaScript, TypeScript。
"""

import os
import re
import logging
from typing import List, Any, Optional, Set
from dataclasses import dataclass

from .base import BaseExtractor

logger = logging.getLogger(__name__)


@dataclass
class ImportInfo:
    """导入信息"""
    module_name: str       # 导入的模块名
    imported_names: List[str]  # 导入的名称列表 (如 from X import a, b)
    line_number: int
    import_type: str       # import, from_import, include, require
    is_external: bool = False  # 是否为外部依赖
    alias: Optional[str] = None  # 别名 (import X as Y)


class FileDependencyExtractor(BaseExtractor):
    """
    文件依赖提取器

    提取文件间的依赖关系，包括:
    - Java: import 语句
    - C/C++: #include 预处理指令
    - JS/TS: import, require, export 语句
    """

    # 各语言的 import 节点类型
    IMPORT_NODE_TYPES = {
        'java': {'import_declaration'},
        'c': {'preproc_include'},
        'cpp': {'preproc_include'},
        'javascript': {
            'import_statement',
            'export_statement',
            'call_expression',  # require()
        },
        'typescript': {
            'import_statement',
            'export_statement',
            'call_expression',
        },
    }

    def extract(self, tree: Any, source: bytes, file_path: str, language: str) -> List[ImportInfo]:
        """
        提取文件依赖

        Args:
            tree: tree-sitter AST 树
            source: 源代码字节
            file_path: 文件路径
            language: 语言名称

        Returns:
            ImportInfo 列表
        """
        if language not in self.IMPORT_NODE_TYPES:
            return []

        imports = []
        node_types = self.IMPORT_NODE_TYPES[language]

        # 查找所有 import 相关节点
        nodes = self.find_nodes_by_types(tree, node_types)

        for node in nodes:
            try:
                if language in ('java',):
                    info = self._extract_java_import(node, source)
                elif language in ('c', 'cpp'):
                    info = self._extract_c_include(node, source)
                elif language in ('javascript', 'typescript'):
                    info = self._extract_js_import(node, source)
                else:
                    continue

                if info:
                    if isinstance(info, list):
                        imports.extend(info)
                    else:
                        imports.append(info)
            except Exception as e:
                logger.debug(f"Failed to extract import at line {node.start_point[0] + 1}: {e}")

        return imports

    def _extract_java_import(self, node: Any, source: bytes) -> Optional[ImportInfo]:
        """
        提取 Java import 语句

        示例:
        - import java.util.List;
        - import java.util.*;
        - import static java.util.Collections.sort;
        """
        if node.type != 'import_declaration':
            return None

        line_number = node.start_point[0] + 1
        import_text = self.get_node_text(node, source)

        # 判断是否为静态导入
        is_static = 'static ' in import_text

        # 提取包名
        for child in node.children:
            if child.type == 'scoped_identifier':
                module_name = self.get_node_text(child, source)
                break
            elif child.type == 'asterisk':
                # import java.util.* 形式
                for sibling in child.children:
                    if sibling.type == 'scoped_identifier':
                        module_name = self.get_node_text(sibling, source) + '.*'
                        break
                else:
                    # 向上查找 scoped_identifier
                    for prev in node.children:
                        if prev.type == 'scoped_identifier':
                            module_name = self.get_node_text(prev, source) + '.*'
                            break
                break
        else:
            # 直接从文本提取
            match = re.search(r'import\s+(?:static\s+)?([\w.\*]+)', import_text)
            if match:
                module_name = match.group(1)
            else:
                return None

        # 判断是否为外部依赖 (Java 标准库和常见框架)
        is_external = self._is_java_external(module_name)

        return ImportInfo(
            module_name=module_name,
            imported_names=['*'] if module_name.endswith('.*') else [module_name.split('.')[-1]],
            line_number=line_number,
            import_type='static_import' if is_static else 'import',
            is_external=is_external,
        )

    def _extract_c_include(self, node: Any, source: bytes) -> Optional[ImportInfo]:
        """
        提取 C/C++ #include 指令

        示例:
        - #include <stdio.h>
        - #include "myheader.h"
        """
        if node.type != 'preproc_include':
            return None

        line_number = node.start_point[0] + 1

        # 查找路径节点
        path_node = None
        is_system = False

        for child in node.children:
            if child.type == 'string_literal':
                path_node = child
                is_system = False
            elif child.type == 'system_lib_string':
                path_node = child
                is_system = True

        if path_node is None:
            return None

        # 提取路径文本 (去除引号/尖括号)
        path_text = self.get_node_text(path_node, source)
        module_name = path_text.strip('<>"\'')

        return ImportInfo(
            module_name=module_name,
            imported_names=[module_name],
            line_number=line_number,
            import_type='include',
            is_external=is_system,
        )

    def _extract_js_import(self, node: Any, source: bytes) -> Optional[List[ImportInfo]]:
        """
        提取 JS/TS import/require 语句

        示例:
        - import fs from 'fs';
        - import { a, b } from 'module';
        - import * as alias from 'module';
        - const x = require('module');
        - export { x } from 'module';
        """
        results = []

        if node.type == 'import_statement':
            info = self._parse_js_import_statement(node, source)
            if info:
                results.append(info)

        elif node.type == 'export_statement':
            # export 可能包含 from 子句
            infos = self._parse_js_export_statement(node, source)
            results.extend(infos)

        elif node.type == 'call_expression':
            # require() 调用
            info = self._parse_js_require(node, source)
            if info:
                results.append(info)

        return results if results else None

    def _parse_js_import_statement(self, node: Any, source: bytes) -> Optional[ImportInfo]:
        """解析 JS import 语句"""
        line_number = node.start_point[0] + 1

        module_name = None
        imported_names = []
        alias = None

        for child in node.children:
            # 模块源
            if child.type == 'string':
                module_name = self.get_node_text(child, source).strip('\'"')

            # import 子句
            elif child.type == 'import_clause':
                for sub_child in child.children:
                    # import x from 'module'
                    if sub_child.type == 'identifier':
                        imported_names.append(self.get_node_text(sub_child, source))

                    # import * as alias from 'module'
                    elif sub_child.type == 'namespace_import':
                        for ns_child in sub_child.children:
                            if ns_child.type == 'identifier':
                                alias = self.get_node_text(ns_child, source)
                                imported_names.append('*')

                    # import { a, b } from 'module'
                    elif sub_child.type == 'named_imports':
                        for spec in sub_child.children:
                            if spec.type == 'import_specifier':
                                name = self.get_node_text(spec, source)
                                imported_names.append(name)

        if module_name is None:
            return None

        is_external = self._is_js_external(module_name)

        return ImportInfo(
            module_name=module_name,
            imported_names=imported_names,
            line_number=line_number,
            import_type='import',
            is_external=is_external,
            alias=alias,
        )

    def _parse_js_export_statement(self, node: Any, source: bytes) -> List[ImportInfo]:
        """解析 JS export 语句 (可能包含 from 子句)"""
        results = []

        line_number = node.start_point[0] + 1
        module_name = None

        # 查找 from 子句中的模块
        for child in node.children:
            if child.type == 'string':
                module_name = self.get_node_text(child, source).strip('\'"')
                break

        if module_name is None:
            return results

        is_external = self._is_js_external(module_name)

        results.append(ImportInfo(
            module_name=module_name,
            imported_names=[],
            line_number=line_number,
            import_type='export_from',
            is_external=is_external,
        ))

        return results

    def _parse_js_require(self, node: Any, source: bytes) -> Optional[ImportInfo]:
        """解析 require() 调用"""
        # 检查是否为 require 调用
        func_node = node.child_by_field_name('function')
        if func_node is None:
            return None

        func_text = self.get_node_text(func_node, source)
        if func_text != 'require':
            return None

        # 获取参数
        args_node = node.child_by_field_name('arguments')
        if args_node is None or len(args_node.children) == 0:
            return None

        # 查找字符串参数
        for child in args_node.children:
            if child.type == 'string':
                module_name = self.get_node_text(child, source).strip('\'"')
                is_external = self._is_js_external(module_name)

                return ImportInfo(
                    module_name=module_name,
                    imported_names=[module_name],
                    line_number=node.start_point[0] + 1,
                    import_type='require',
                    is_external=is_external,
                )

        return None

    def _is_java_external(self, module_name: str) -> bool:
        """判断 Java 模块是否为外部依赖"""
        external_prefixes = {
            'java.', 'javax.', 'org.w3c.', 'org.xml.', 'org.omg.',
            'sun.', 'com.sun.',
            'org.springframework.', 'org.hibernate.', 'org.apache.',
            'com.google.', 'com.fasterxml.', 'org.slf4j.', 'ch.qos.',
            'io.netty.', 'io.reactivex.', 'okhttp3.', 'retrofit2.',
            'org.junit.', 'org.mockito.', 'org.hamcrest.',
        }
        return any(module_name.startswith(prefix) for prefix in external_prefixes)

    def _is_js_external(self, module_name: str) -> bool:
        """判断 JS/TS 模块是否为外部依赖"""
        # Node.js 内置模块
        node_modules = {
            'fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'net',
            'util', 'stream', 'events', 'buffer', 'querystring', 'child_process',
            'cluster', 'dgram', 'dns', 'readline', 'repl', 'tls', 'tty', 'v8',
            'vm', 'zlib', 'worker_threads', 'perf_hooks', 'async_hooks',
        }

        # 以 . 或 / 开头的是本地模块
        if module_name.startswith('.') or module_name.startswith('/'):
            return False

        # Node.js 内置模块
        if module_name in node_modules:
            return True

        # 常见外部包 (不以 ./ 开头)
        if not module_name.startswith('.'):
            # npm 包名 (可能有作用域 @org/package)
            return True

        return False
