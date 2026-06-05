"""基础提取器抽象类

定义所有提取器的公共接口和工具方法。
"""

from abc import ABC, abstractmethod
from typing import List, Any, Optional, Dict
import logging

logger = logging.getLogger(__name__)


class BaseExtractor(ABC):
    """
    基础提取器抽象类

    所有代码资产提取器都继承此类，实现统一的提取接口。
    """

    def __init__(self, parser):
        """
        初始化提取器

        Args:
            parser: TreeSitterParser 实例
        """
        self.parser = parser

    @abstractmethod
    def extract(self, tree: Any, source: bytes, file_path: str, language: str) -> List[Any]:
        """
        提取代码资产

        Args:
            tree: tree-sitter AST 树
            source: 源代码字节
            file_path: 文件路径
            language: 语言名称

        Returns:
            提取结果列表
        """
        pass

    def get_node_text(self, node: Any, source: bytes) -> str:
        """
        获取节点对应的源代码文本

        Args:
            node: tree-sitter 节点
            source: 源代码字节

        Returns:
            节点文本
        """
        return self.parser.get_node_text(node, source)

    def find_nodes_by_type(self, tree: Any, node_type: str) -> List[Any]:
        """
        按类型查找节点

        Args:
            tree: AST 树
            node_type: 节点类型

        Returns:
            匹配的节点列表
        """
        return self.parser.find_nodes_by_type(tree, node_type)

    def find_nodes_by_types(self, tree: Any, node_types: set) -> List[Any]:
        """
        按多种类型查找节点

        Args:
            tree: AST 树
            node_types: 节点类型集合

        Returns:
            匹配的节点列表
        """
        return self.parser.find_nodes_by_types(tree, node_types)

    def walk_tree(self, tree: Any, callback: callable):
        """
        遍历 AST 树

        Args:
            tree: AST 树
            callback: 回调函数
        """
        self.parser.walk_tree(tree, callback)

    def query(self, tree: Any, query_str: str, language: str) -> List[tuple]:
        """
        执行 tree-sitter 查询

        Args:
            tree: AST 树
            query_str: 查询字符串
            language: 语言名称

        Returns:
            捕获的节点列表
        """
        return self.parser.query(tree, query_str, language)

    def find_parent_function(self, node: Any) -> Optional[Any]:
        """
        查找节点所在的父函数

        Args:
            node: tree-sitter 节点

        Returns:
            父函数节点或 None
        """
        function_types = {
            'function_definition',
            'method_definition',
            'function_declaration',
            'method_declaration',
            'arrow_function',
            'lambda_expression',
        }

        current = node.parent
        while current:
            if current.type in function_types:
                return current
            current = current.parent
        return None

    def get_function_name(self, node: Any, source: bytes) -> Optional[str]:
        """
        获取函数名称

        Args:
            node: 函数节点
            source: 源代码字节

        Returns:
            函数名称或 None
        """
        # 不同语言的函数名节点类型
        name_selectors = [
            'identifier',      # 通用
            'property_identifier',  # JS/TS 方法
            'type_identifier',  # Java
        ]

        # 尝试查找名称子节点
        for child in node.children:
            if child.type in name_selectors:
                return self.get_node_text(child, source)

        # 对于 Java 方法，查找方法名
        for child in node.children:
            if child.type == 'identifier':
                return self.get_node_text(child, source)

        return None
