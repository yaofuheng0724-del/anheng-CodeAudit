"""调用图提取器

提取函数调用关系，构建调用图。
支持 Java, C, C++, JavaScript, TypeScript。
"""

import logging
from typing import List, Any, Optional, Dict, Set, Tuple
from dataclasses import dataclass, field

from .base import BaseExtractor

logger = logging.getLogger(__name__)


@dataclass
class CallEdgeInfo:
    """函数调用边信息"""
    caller_file: str
    caller_function: str
    caller_line: int
    callee_name: str  # 被调用函数名
    callee_object: Optional[str] = None  # 对象名 (obj.method 中的 obj)
    call_type: str = "direct"  # direct, method, static, dynamic
    arguments: List[str] = field(default_factory=list)  # 参数列表 (文本)


class CallGraphExtractor(BaseExtractor):
    """
    调用图提取器

    提取函数/方法调用关系，支持:
    - 函数调用: func(args)
    - 方法调用: obj.method(args)
    - 静态调用: Class.staticMethod(args)
    - 构造调用: new Class(args)
    """

    # 各语言的调用表达式节点类型
    CALL_NODE_TYPES = {
        'java': {'method_invocation', 'object_creation_expression', 'explicit_constructor_invocation'},
        'c': {'call_expression'},
        'cpp': {'call_expression'},
        'javascript': {'call_expression', 'new_expression'},
        'typescript': {'call_expression', 'new_expression'},
    }

    # 函数定义节点类型
    FUNCTION_NODE_TYPES = {
        'java': {'method_declaration', 'constructor_declaration'},
        'c': {'function_definition'},
        'cpp': {'function_definition'},
        'javascript': {'function_declaration', 'function_expression', 'arrow_function', 'method_definition'},
        'typescript': {'function_declaration', 'function_expression', 'arrow_function', 'method_definition'},
    }

    def extract(self, tree: Any, source: bytes, file_path: str, language: str) -> List[CallEdgeInfo]:
        """
        提取函数调用关系

        Args:
            tree: tree-sitter AST 树
            source: 源代码字节
            file_path: 文件路径
            language: 语言名称

        Returns:
            CallEdgeInfo 列表
        """
        if language not in self.CALL_NODE_TYPES:
            return []

        edges = []

        # 构建函数位置到函数名的映射
        function_map = self._build_function_map(tree, source, language)

        # 查找所有调用表达式
        call_types = self.CALL_NODE_TYPES[language]
        call_nodes = self.find_nodes_by_types(tree, call_types)

        for call_node in call_nodes:
            try:
                edge = self._parse_call_node(call_node, source, file_path, language, function_map)
                if edge:
                    edges.append(edge)
            except Exception as e:
                logger.debug(f"Failed to parse call at line {call_node.start_point[0] + 1}: {e}")

        return edges

    def _build_function_map(self, tree: Any, source: bytes, language: str) -> Dict[Tuple[int, int], str]:
        """
        构建函数位置映射

        返回: {(start_line, end_line): function_name}
        """
        function_map = {}
        func_types = self.FUNCTION_NODE_TYPES.get(language, set())

        if not func_types:
            return function_map

        func_nodes = self.find_nodes_by_types(tree, func_types)

        for node in func_nodes:
            func_name = self._get_function_name(node, source, language)
            if func_name:
                start_line = node.start_point[0]
                end_line = node.end_point[0]
                function_map[(start_line, end_line)] = func_name

        return function_map

    def _get_function_name(self, node: Any, source: bytes, language: str) -> Optional[str]:
        """根据语言提取函数名"""
        if language == 'java':
            return self._get_java_method_name(node, source)
        elif language in ('c', 'cpp'):
            return self._get_c_function_name(node, source)
        elif language in ('javascript', 'typescript'):
            return self._get_js_function_name(node, source)
        return None

    def _get_java_method_name(self, node: Any, source: bytes) -> Optional[str]:
        """获取 Java 方法/构造函数名"""
        # 方法声明
        if node.type == 'method_declaration':
            for child in node.children:
                if child.type == 'identifier':
                    return self.get_node_text(child, source)
                elif child.type == 'type_identifier':
                    # 泛型方法，继续找
                    continue

        # 构造函数
        elif node.type == 'constructor_declaration':
            for child in node.children:
                if child.type == 'identifier':
                    return self.get_node_text(child, source)

        return None

    def _get_c_function_name(self, node: Any, source: bytes) -> Optional[str]:
        """获取 C/C++ 函数名"""
        if node.type != 'function_definition':
            return None

        # 查找声明符
        for child in node.children:
            if child.type == 'function_declarator':
                # 查找标识符
                for sub_child in child.children:
                    if sub_child.type == 'identifier':
                        return self.get_node_text(sub_child, source)
                    elif sub_child.type == 'qualified_identifier':
                        return self.get_node_text(sub_child, source)
            elif child.type == 'identifier':
                return self.get_node_text(child, source)

        return None

    def _get_js_function_name(self, node: Any, source: bytes) -> Optional[str]:
        """获取 JS/TS 函数名"""
        # 函数声明: function name() {}
        if node.type == 'function_declaration':
            for child in node.children:
                if child.type == 'identifier':
                    return self.get_node_text(child, source)

        # 方法定义: name() {}
        elif node.type == 'method_definition':
            for child in node.children:
                if child.type == 'property_identifier':
                    return self.get_node_text(child, source)

        # 函数表达式: const name = function() {} 或 const name = () => {}
        elif node.type in ('function_expression', 'arrow_function'):
            # 检查父节点是否为变量声明
            parent = node.parent
            if parent:
                # const name = ...
                if parent.type == 'variable_declarator':
                    for child in parent.children:
                        if child.type == 'identifier':
                            return self.get_node_text(child, source)
                # obj.method = ...
                elif parent.type == 'assignment_expression':
                    left = parent.child_by_field_name('left')
                    if left:
                        return self.get_node_text(left, source)

        return None

    def _parse_call_node(
        self,
        call_node: Any,
        source: bytes,
        file_path: str,
        language: str,
        function_map: Dict[Tuple[int, int], str]
    ) -> Optional[CallEdgeInfo]:
        """解析调用节点"""

        if language == 'java':
            return self._parse_java_call(call_node, source, file_path, function_map)
        elif language in ('c', 'cpp'):
            return self._parse_c_call(call_node, source, file_path, function_map)
        elif language in ('javascript', 'typescript'):
            return self._parse_js_call(call_node, source, file_path, function_map)

        return None

    def _parse_java_call(
        self,
        call_node: Any,
        source: bytes,
        file_path: str,
        function_map: Dict[Tuple[int, int], str]
    ) -> Optional[CallEdgeInfo]:
        """
        解析 Java 方法调用

        形式:
        - method(args)
        - obj.method(args)
        - Class.staticMethod(args)
        - new Class(args)
        - super(args)
        """
        call_line = call_node.start_point[0] + 1
        caller_function = self._find_containing_function(call_node, function_map)

        if call_node.type == 'method_invocation':
            # 方法调用
            callee_name = None
            callee_object = None

            # 查找方法名和对象
            for child in call_node.children:
                if child.type == 'identifier':
                    # 简单方法调用: func(args)
                    callee_name = self.get_node_text(child, source)
                elif child.type == 'field_access':
                    # 对象方法调用: obj.method
                    obj_node = child.child_by_field_name('object')
                    field_node = child.child_by_field_name('field')
                    if field_node:
                        callee_name = self.get_node_text(field_node, source)
                    if obj_node:
                        callee_object = self.get_node_text(obj_node, source)
                elif child.type == 'method_selector':
                    # 链式调用
                    for sub_child in child.children:
                        if sub_child.type == 'identifier':
                            callee_name = self.get_node_text(sub_child, source)

            if callee_name is None:
                return None

            # 提取参数
            arguments = self._extract_arguments(call_node, source)

            return CallEdgeInfo(
                caller_file=file_path,
                caller_function=caller_function or '<unknown>',
                caller_line=call_line,
                callee_name=callee_name,
                callee_object=callee_object,
                call_type='method' if callee_object else 'direct',
                arguments=arguments,
            )

        elif call_node.type == 'object_creation_expression':
            # new Class(args)
            class_name = None
            for child in call_node.children:
                if child.type == 'type_identifier':
                    class_name = self.get_node_text(child, source)
                elif child.type == 'scoped_type_identifier':
                    class_name = self.get_node_text(child, source)

            if class_name is None:
                return None

            arguments = self._extract_arguments(call_node, source)

            return CallEdgeInfo(
                caller_file=file_path,
                caller_function=caller_function or '<unknown>',
                caller_line=call_line,
                callee_name=class_name,
                call_type='constructor',
                arguments=arguments,
            )

        elif call_node.type == 'explicit_constructor_invocation':
            # super() 或 this()
            is_super = False
            for child in call_node.children:
                if child.type == 'identifier':
                    text = self.get_node_text(child, source)
                    is_super = (text == 'super')
                    break

            return CallEdgeInfo(
                caller_file=file_path,
                caller_function=caller_function or '<unknown>',
                caller_line=call_line,
                callee_name='super' if is_super else 'this',
                call_type='constructor',
            )

        return None

    def _parse_c_call(
        self,
        call_node: Any,
        source: bytes,
        file_path: str,
        function_map: Dict[Tuple[int, int], str]
    ) -> Optional[CallEdgeInfo]:
        """
        解析 C/C++ 函数调用

        形式:
        - func(args)
        - obj->method(args)
        - obj.method(args)
        - Class::staticMethod(args)
        """
        if call_node.type != 'call_expression':
            return None

        call_line = call_node.start_point[0] + 1
        caller_function = self._find_containing_function(call_node, function_map)

        callee_name = None
        callee_object = None
        call_type = 'direct'

        # 获取调用函数
        func_node = call_node.child_by_field_name('function')
        if func_node is None:
            return None

        func_text = self.get_node_text(func_node, source)

        # 简单调用: func(args)
        if func_node.type == 'identifier':
            callee_name = func_text

        # 成员调用: obj.method 或 obj->method
        elif func_node.type == 'field_expression' or func_node.type == 'member_expression':
            # 分离对象和方法
            parts = func_text.rsplit('.', 1)
            if len(parts) == 2:
                callee_object = parts[0]
                callee_name = parts[1]
                call_type = 'method'
            else:
                parts = func_text.rsplit('->', 1)
                if len(parts) == 2:
                    callee_object = parts[0]
                    callee_name = parts[1]
                    call_type = 'method'

        # 作用域调用: Class::method
        elif func_node.type == 'scoped_identifier':
            callee_name = func_text
            call_type = 'static'

        if callee_name is None:
            return None

        arguments = self._extract_arguments(call_node, source)

        return CallEdgeInfo(
            caller_file=file_path,
            caller_function=caller_function or '<unknown>',
            caller_line=call_line,
            callee_name=callee_name,
            callee_object=callee_object,
            call_type=call_type,
            arguments=arguments,
        )

    def _parse_js_call(
        self,
        call_node: Any,
        source: bytes,
        file_path: str,
        function_map: Dict[Tuple[int, int], str]
    ) -> Optional[CallEdgeInfo]:
        """
        解析 JS/TS 函数调用

        形式:
        - func(args)
        - obj.method(args)
        - Class.staticMethod(args)
        - new Class(args)
        - func.call(obj, args)
        - func.apply(obj, args)
        """
        call_line = call_node.start_point[0] + 1
        caller_function = self._find_containing_function(call_node, function_map)

        if call_node.type == 'new_expression':
            # new Class(args)
            constructor_node = call_node.child_by_field_name('constructor')
            if constructor_node is None:
                return None

            class_name = self.get_node_text(constructor_node, source)
            arguments = self._extract_arguments(call_node, source)

            return CallEdgeInfo(
                caller_file=file_path,
                caller_function=caller_function or '<unknown>',
                caller_line=call_line,
                callee_name=class_name,
                call_type='constructor',
                arguments=arguments,
            )

        if call_node.type != 'call_expression':
            return None

        callee_name = None
        callee_object = None
        call_type = 'direct'

        func_node = call_node.child_by_field_name('function')
        if func_node is None:
            return None

        # 简单调用: func(args)
        if func_node.type == 'identifier':
            callee_name = self.get_node_text(func_node, source)

        # 成员调用: obj.method(args)
        elif func_node.type == 'member_expression':
            obj_node = func_node.child_by_field_name('object')
            prop_node = func_node.child_by_field_name('property')

            if prop_node:
                callee_name = self.get_node_text(prop_node, source)
            if obj_node:
                callee_object = self.get_node_text(obj_node, source)

            call_type = 'method'

            # 特殊处理 .call 和 .apply
            if callee_name in ('call', 'apply'):
                # func.call(obj, args) -> 实际是调用 func
                if obj_node and obj_node.type == 'member_expression':
                    real_prop = obj_node.child_by_field_name('property')
                    if real_prop:
                        callee_name = self.get_node_text(real_prop, source)
                        callee_object = None

        arguments = self._extract_arguments(call_node, source)

        return CallEdgeInfo(
            caller_file=file_path,
            caller_function=caller_function or '<unknown>',
            caller_line=call_line,
            callee_name=callee_name or '<unknown>',
            callee_object=callee_object,
            call_type=call_type,
            arguments=arguments,
        )

    def _extract_arguments(self, call_node: Any, source: bytes) -> List[str]:
        """提取调用参数列表"""
        arguments = []

        args_node = call_node.child_by_field_name('arguments')
        if args_node is None:
            # Java 使用 argument_list
            for child in call_node.children:
                if child.type == 'argument_list':
                    args_node = child
                    break

        if args_node is None:
            return arguments

        for child in args_node.children:
            if child.type not in ('(', ')', ',', '[', ']', '{', '}'):
                arg_text = self.get_node_text(child, source)
                # 截断过长的参数
                if len(arg_text) > 100:
                    arg_text = arg_text[:100] + '...'
                arguments.append(arg_text)

        return arguments

    def _find_containing_function(
        self,
        node: Any,
        function_map: Dict[Tuple[int, int], str]
    ) -> Optional[str]:
        """查找节点所在的函数"""
        node_start = node.start_point[0]
        node_end = node.end_point[0]

        for (start, end), name in function_map.items():
            if start <= node_start and node_end <= end:
                return name

        return None