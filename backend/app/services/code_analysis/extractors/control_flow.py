"""控制流提取器

提取代码的控制流结构，包括分支、循环、异常处理等。
支持 Java, C, C++, JavaScript, TypeScript。
"""

import logging
from typing import List, Any, Optional, Dict, Set, Tuple
from dataclasses import dataclass, field
import hashlib

from .base import BaseExtractor

logger = logging.getLogger(__name__)


@dataclass
class ControlFlowNodeInfo:
    """控制流节点信息"""
    node_id: str
    node_type: str  # entry, exit, branch, merge, loop, statement, try, catch, throw
    line_number: int
    file_path: str
    condition: Optional[str] = None  # 条件表达式
    statements: List[str] = field(default_factory=list)  # 包含的语句
    depth: int = 0  # 嵌套深度


@dataclass
class ControlFlowEdgeInfo:
    """控制流边信息"""
    source_id: str
    target_id: str
    edge_type: str  # normal, true, false, exception, break, continue


@dataclass
class ControlFlowResult:
    """控制流提取结果"""
    nodes: List[ControlFlowNodeInfo]
    edges: List[ControlFlowEdgeInfo]
    complexity: int  # 圈复杂度


class ControlFlowExtractor(BaseExtractor):
    """
    控制流提取器

    提取代码的控制流结构，包括:
    - 分支: if, switch, ternary
    - 循环: for, while, do-while, for-each
    - 异常: try, catch, finally, throw
    - 跳转: break, continue, return
    """

    # 各语言的控制流节点类型
    BRANCH_TYPES = {
        # Java 普通 switch 是 switch_statement；JDK 14+ switch 表达式才是 switch_expression
        'java': {'if_statement', 'switch_statement', 'switch_expression'},
        'c': {'if_statement', 'switch_statement'},
        'cpp': {'if_statement', 'switch_statement'},
        'javascript': {'if_statement', 'switch_statement'},
        'typescript': {'if_statement', 'switch_statement'},
    }

    LOOP_TYPES = {
        'java': {'for_statement', 'enhanced_for_statement', 'while_statement', 'do_statement'},
        'c': {'for_statement', 'while_statement', 'do_statement'},
        'cpp': {'for_statement', 'for_range_loop', 'while_statement', 'do_statement'},
        'javascript': {'for_statement', 'for_in_statement', 'for_of_statement', 'while_statement', 'do_statement'},
        'typescript': {'for_statement', 'for_in_statement', 'for_of_statement', 'while_statement', 'do_statement'},
    }

    EXCEPTION_TYPES = {
        'java': {'try_statement', 'throw_statement', 'catch_clause', 'finally_clause'},
        'c': set(),  # C 没有异常
        'cpp': {'try_statement', 'throw_statement', 'catch_clause'},
        'javascript': {'try_statement', 'throw_statement', 'catch_clause', 'finally_clause'},
        'typescript': {'try_statement', 'throw_statement', 'catch_clause', 'finally_clause'},
    }

    # 节点类型映射
    NODE_TYPE_MAP = {
        'if_statement': 'branch',
        'switch_statement': 'branch',
        'switch_expression': 'branch',
        'for_statement': 'loop',
        'enhanced_for_statement': 'loop',
        'for_range_loop': 'loop',
        'for_in_statement': 'loop',
        'for_of_statement': 'loop',
        'while_statement': 'loop',
        'do_statement': 'loop',
        'try_statement': 'try',
        'catch_clause': 'catch',
        'finally_clause': 'finally',
        'throw_statement': 'throw',
        'catch_block': 'catch',
    }

    def extract(self, tree: Any, source: bytes, file_path: str, language: str) -> ControlFlowResult:
        """
        提取控制流

        Args:
            tree: tree-sitter AST 树
            source: 源代码字节
            file_path: 文件路径
            language: 语言名称

        Returns:
            ControlFlowResult 包含节点、边和复杂度
        """
        nodes: List[ControlFlowNodeInfo] = []
        edges: List[ControlFlowEdgeInfo] = []

        if language not in self.BRANCH_TYPES:
            return ControlFlowResult(nodes=nodes, edges=edges, complexity=1)

        # 收集所有控制流节点
        all_types = (
            self.BRANCH_TYPES.get(language, set()) |
            self.LOOP_TYPES.get(language, set()) |
            self.EXCEPTION_TYPES.get(language, set())
        )

        control_nodes = self.find_nodes_by_types(tree, all_types)

        # 计算圈复杂度
        complexity = self._calculate_complexity(control_nodes, language)

        # 构建控制流节点
        node_counter = 0
        for node in control_nodes:
            try:
                cf_node, cf_edges = self._process_control_node(
                    node, source, file_path, language, node_counter
                )
                if cf_node:
                    nodes.append(cf_node)
                    edges.extend(cf_edges)
                    node_counter += 1
            except Exception as e:
                logger.debug(f"Failed to process control node at line {node.start_point[0] + 1}: {e}")

        # 添加入口和出口节点
        if nodes:
            entry_node = ControlFlowNodeInfo(
                node_id=f"{file_path}:entry",
                node_type='entry',
                line_number=1,
                file_path=file_path,
                depth=0,
            )
            exit_node = ControlFlowNodeInfo(
                node_id=f"{file_path}:exit",
                node_type='exit',
                line_number=tree.root_node.end_point[0] + 1 if tree else 1,
                file_path=file_path,
                depth=0,
            )
            nodes.insert(0, entry_node)
            nodes.append(exit_node)

            # 添加入口到第一个节点的边
            if len(nodes) > 2:
                edges.insert(0, ControlFlowEdgeInfo(
                    source_id=entry_node.node_id,
                    target_id=nodes[1].node_id,
                    edge_type='normal',
                ))

        return ControlFlowResult(nodes=nodes, edges=edges, complexity=complexity)

    def _process_control_node(
        self,
        node: Any,
        source: bytes,
        file_path: str,
        language: str,
        counter: int
    ) -> Tuple[Optional[ControlFlowNodeInfo], List[ControlFlowEdgeInfo]]:
        """
        处理单个控制流节点

        Returns:
            (节点信息, 边列表)
        """
        node_type = self.NODE_TYPE_MAP.get(node.type)
        if node_type is None:
            return None, []

        line_number = node.start_point[0] + 1
        node_id = f"{file_path}:{node_type}:{line_number}:{counter}"

        # 提取条件表达式
        condition = self._extract_condition(node, source, language)

        # 计算嵌套深度
        depth = self._calculate_depth(node)

        # 提取包含的语句
        statements = self._extract_statements(node, source)

        # 创建节点
        cf_node = ControlFlowNodeInfo(
            node_id=node_id,
            node_type=node_type,
            line_number=line_number,
            file_path=file_path,
            condition=condition,
            statements=statements,
            depth=depth,
        )

        # 创建边
        edges = self._create_edges(node, cf_node, source, language)

        return cf_node, edges

    def _extract_condition(self, node: Any, source: bytes, language: str) -> Optional[str]:
        """
        提取条件表达式

        对于 if, while, for 等语句提取其条件部分
        """
        condition_node = None

        # if/while 条件在 condition 字段
        condition_node = node.child_by_field_name('condition')

        if condition_node is None:
            # for 循环条件
            for child in node.children:
                if child.type in ('parenthesized_expression', 'condition_clause'):
                    condition_node = child
                    break
                # Java/C++ for 语句
                if child.type == 'for_header':
                    for sub_child in child.children:
                        if sub_child.type in ('condition', 'condition_clause', 'binary_expression'):
                            condition_node = sub_child
                            break

        if condition_node is None:
            # 查找括号内的表达式
            in_parens = False
            for child in node.children:
                if child.type == '(':
                    in_parens = True
                elif child.type == ')':
                    in_parens = False
                elif in_parens and child.type not in ('(', ')'):
                    condition_node = child
                    break

        if condition_node:
            condition_text = self.get_node_text(condition_node, source)
            # 清理括号
            condition_text = condition_text.strip('()')
            # 截断过长条件
            if len(condition_text) > 200:
                condition_text = condition_text[:200] + '...'
            return condition_text

        return None

    def _extract_statements(self, node: Any, source: bytes) -> List[str]:
        """提取控制语句包含的子语句类型"""
        statements = []

        # 收集直接子语句的类型
        statement_types = set()

        def collect_statements(n, depth=0):
            if depth > 2:  # 限制深度
                return
            for child in n.children:
                if 'statement' in child.type:
                    statement_types.add(child.type)
                elif child.type == 'block':
                    collect_statements(child, depth + 1)
                elif child.type in ('catch_clause', 'finally_clause'):
                    collect_statements(child, depth + 1)

        collect_statements(node)

        # 映射到友好名称
        type_names = {
            'expression_statement': 'expression',
            'return_statement': 'return',
            'break_statement': 'break',
            'continue_statement': 'continue',
            'throw_statement': 'throw',
            'if_statement': 'if',
            'for_statement': 'for',
            'while_statement': 'while',
            'do_statement': 'do-while',
            'switch_statement': 'switch',
            'try_statement': 'try',
        }

        for st_type in statement_types:
            name = type_names.get(st_type, st_type.replace('_statement', ''))
            statements.append(name)

        return statements[:10]  # 限制数量

    def _calculate_depth(self, node: Any) -> int:
        """计算控制结构嵌套深度"""
        depth = 0
        control_types = (
            self.BRANCH_TYPES.get('java', set()) |
            self.LOOP_TYPES.get('java', set())
        )

        current = node.parent
        while current:
            if current.type in control_types:
                depth += 1
            current = current.parent

        return depth

    def _create_edges(
        self,
        node: Any,
        cf_node: ControlFlowNodeInfo,
        source: bytes,
        language: str
    ) -> List[ControlFlowEdgeInfo]:
        """
        创建控制流边

        为分支和循环结构创建 true/false 边
        """
        edges = []

        node_type = node.type

        if node_type in ('if_statement',):
            # if 语句有 true 和 false 分支
            # 查找 consequence 和 alternative
            consequence = node.child_by_field_name('consequence')
            alternative = node.child_by_field_name('alternative')

            if consequence:
                # true 边到 consequence
                true_id = self._get_branch_node_id(consequence, cf_node.file_path, 'true')
                edges.append(ControlFlowEdgeInfo(
                    source_id=cf_node.node_id,
                    target_id=true_id,
                    edge_type='true',
                ))

            if alternative:
                # false 边到 alternative
                false_id = self._get_branch_node_id(alternative, cf_node.file_path, 'false')
                edges.append(ControlFlowEdgeInfo(
                    source_id=cf_node.node_id,
                    target_id=false_id,
                    edge_type='false',
                ))

        elif node_type in ('switch_statement', 'switch_expression'):
            # switch 有多个 case 分支
            case_counter = 0
            for child in node.children:
                if child.type in ('switch_case', 'case_statement'):
                    case_id = f"{cf_node.node_id}:case:{case_counter}"
                    edges.append(ControlFlowEdgeInfo(
                        source_id=cf_node.node_id,
                        target_id=case_id,
                        edge_type='normal',
                    ))
                    case_counter += 1

        elif node_type in self.LOOP_TYPES.get(language, set()):
            # 循环有 continue 和 break 边
            loop_body = node.child_by_field_name('body')
            if loop_body:
                body_id = f"{cf_node.node_id}:body"
                edges.append(ControlFlowEdgeInfo(
                    source_id=cf_node.node_id,
                    target_id=body_id,
                    edge_type='true',
                ))

            # 循环退出
            exit_id = f"{cf_node.node_id}:exit"
            edges.append(ControlFlowEdgeInfo(
                source_id=cf_node.node_id,
                target_id=exit_id,
                edge_type='false',
            ))

        elif node_type == 'try_statement':
            # try 语句有异常处理边
            for child in node.children:
                if child.type == 'catch_clause':
                    catch_id = f"{cf_node.node_id}:catch"
                    edges.append(ControlFlowEdgeInfo(
                        source_id=cf_node.node_id,
                        target_id=catch_id,
                        edge_type='exception',
                    ))
                elif child.type in ('finally_clause', 'finally'):
                    finally_id = f"{cf_node.node_id}:finally"
                    edges.append(ControlFlowEdgeInfo(
                        source_id=cf_node.node_id,
                        target_id=finally_id,
                        edge_type='normal',
                    ))

        return edges

    def _get_branch_node_id(self, branch_node: Any, file_path: str, branch_type: str) -> str:
        """生成分支节点 ID"""
        line = branch_node.start_point[0] + 1
        return f"{file_path}:{branch_type}:{line}"

    def _calculate_complexity(self, control_nodes: List[Any], language: str) -> int:
        """
        计算圈复杂度 (McCabe)

        复杂度 = 1 + (分支数) + (循环数) + (case数) + (异常处理数)
        """
        complexity = 1

        branch_types = self.BRANCH_TYPES.get(language, set())
        loop_types = self.LOOP_TYPES.get(language, set())

        for node in control_nodes:
            if node.type in branch_types:
                if node.type in ('if_statement',):
                    # if 语句增加 1
                    complexity += 1
                    # else if 也增加
                    for child in node.children:
                        if child.type == 'else':
                            for else_child in child.children:
                                if else_child.type == 'if_statement':
                                    complexity += 1

                elif node.type in ('switch_statement', 'switch_expression'):
                    # switch 按 case 数增加
                    for child in node.children:
                        if child.type in ('switch_case', 'case_statement', 'switch_body'):
                            for case_child in child.children:
                                if case_child.type in ('switch_case', 'case_statement'):
                                    complexity += 1

            elif node.type in loop_types:
                # 循环增加 1
                complexity += 1

            elif node.type in ('catch_clause', 'catch_block'):
                # catch 子句增加 1
                complexity += 1

        return complexity

    def get_function_complexity(self, tree: Any, source: bytes, language: str) -> Dict[str, int]:
        """
        获取每个函数的复杂度

        Returns:
            {函数名: 复杂度}
        """
        result = {}

        # 查找函数定义
        function_types = {
            'java': {'method_declaration', 'constructor_declaration'},
            'c': {'function_definition'},
            'cpp': {'function_definition', 'function_declaration'},
            'javascript': {'function_declaration', 'function_expression', 'arrow_function', 'method_definition'},
            'typescript': {'function_declaration', 'function_expression', 'arrow_function', 'method_definition'},
        }

        types = function_types.get(language, set())
        func_nodes = self.find_nodes_by_types(tree, types)

        for func_node in func_nodes:
            func_name = self._get_function_name(func_node, source, language)
            if func_name is None:
                continue

            # 收集函数内的控制流节点
            control_nodes = []
            self._collect_control_nodes(func_node, control_nodes, language)

            # 计算复杂度
            complexity = self._calculate_complexity(control_nodes, language)
            result[func_name] = complexity

        return result

    def _collect_control_nodes(self, node: Any, nodes: List[Any], language: str):
        """递归收集控制流节点"""
        branch_types = self.BRANCH_TYPES.get(language, set())
        loop_types = self.LOOP_TYPES.get(language, set())
        exception_types = self.EXCEPTION_TYPES.get(language, set())

        all_types = branch_types | loop_types | exception_types

        for child in node.children:
            if child.type in all_types:
                nodes.append(child)
            # 递归处理子节点
            self._collect_control_nodes(child, nodes, language)

    def _get_function_name(self, node: Any, source: bytes, language: str) -> Optional[str]:
        """获取函数名"""
        if language == 'java':
            # Java 方法/构造函数
            for child in node.children:
                if child.type == 'identifier':
                    return self.get_node_text(child, source)

        elif language in ('c', 'cpp'):
            # C/C++ 函数
            for child in node.children:
                if child.type == 'function_declarator':
                    for sub_child in child.children:
                        if sub_child.type == 'identifier':
                            return self.get_node_text(sub_child, source)
                elif child.type == 'identifier':
                    return self.get_node_text(child, source)

        elif language in ('javascript', 'typescript'):
            # JS/TS 函数
            for child in node.children:
                if child.type == 'identifier':
                    return self.get_node_text(child, source)
                elif child.type == 'property_identifier':
                    return self.get_node_text(child, source)

        return None