"""Tree-sitter统一解析器

提供多语言 AST 解析能力，支持:
- Java, C, C++
- JavaScript, TypeScript
"""

import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# Tree-sitter 核心导入
try:
    from tree_sitter import Language, Parser
    TREE_SITTER_AVAILABLE = True
except ImportError:
    TREE_SITTER_AVAILABLE = False
    Language = None
    Parser = None
    logger.warning("tree-sitter not installed, AST parsing will be disabled")

# 尝试导入 tree_sitter_language_pack (推荐方式)
try:
    import tree_sitter_language_pack
    LANGUAGE_PACK_AVAILABLE = True
except ImportError:
    LANGUAGE_PACK_AVAILABLE = False
    logger.debug("tree_sitter_language_pack not available, trying individual packages")


class TreeSitterParser:
    """
    Tree-sitter 统一解析器

    提供统一的 AST 解析接口，支持多种编程语言。
    优先使用 tree_sitter_language_pack，回退到单独的语言包。
    """

    # 语言映射: 语言名 -> Language 对象
    LANGUAGE_MAP: Dict[str, Any] = {}

    # 解析器缓存: Language 对象 -> Parser 实例
    _parsers: Dict[Any, Any] = {}

    # 支持的语言列表
    SUPPORTED_LANGUAGES = {
        "java",
        "kotlin",
        "scala",
        "groovy",
        "c",
        "cpp",
        "objc",
        "javascript",
        "typescript",
        "tsx",
        "python",
        "go",
        "php",
        "ruby",
        "csharp",
        "rust",
        "swift",
        "lua",
    }

    # 文件扩展名映射
    EXTENSION_MAP = {
        # Java / JVM
        ".java": "java",
        ".kt": "kotlin",
        ".kts": "kotlin",
        ".scala": "scala",
        ".groovy": "groovy",
        # C / C++ / Obj-C
        ".c": "c",
        ".h": "c",
        ".cpp": "cpp",
        ".hpp": "cpp",
        ".cc": "cpp",
        ".cxx": "cpp",
        ".hh": "cpp",
        ".hxx": "cpp",
        ".m": "objc",
        ".mm": "objc",
        # JS / TS
        ".js": "javascript",
        ".jsx": "javascript",
        ".mjs": "javascript",
        ".cjs": "javascript",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".mts": "typescript",
        ".cts": "typescript",
        # Python
        ".py": "python",
        ".pyi": "python",
        ".pyw": "python",
        # Go
        ".go": "go",
        # PHP
        ".php": "php",
        ".phtml": "php",
        # Ruby
        ".rb": "ruby",
        # C#
        ".cs": "csharp",
        # Rust
        ".rs": "rust",
        # Swift
        ".swift": "swift",
        # Lua
        ".lua": "lua",
    }

    def __init__(self):
        """初始化解析器"""
        self._initialized = False
        self._init_languages()

    def _init_languages(self):
        """初始化语言支持"""
        if self._initialized:
            return

        if not TREE_SITTER_AVAILABLE:
            logger.warning("Tree-sitter not available, parser will be limited")
            self._initialized = True
            return

        # 方式1: 使用 tree_sitter_language_pack (推荐)
        if LANGUAGE_PACK_AVAILABLE:
            for lang_name in self.SUPPORTED_LANGUAGES:
                try:
                    lang = tree_sitter_language_pack.get_language(lang_name)
                    self.LANGUAGE_MAP[lang_name] = lang
                    logger.debug(f"Loaded {lang_name} from language_pack")
                except Exception as e:
                    logger.debug(f"Failed to load {lang_name} from language_pack: {e}")

        # 方式2: 回退到单独的语言包
        if not self.LANGUAGE_MAP:
            self._load_individual_packages()

        self._initialized = True
        logger.info(f"Initialized tree-sitter with languages: {list(self.LANGUAGE_MAP.keys())}")

    def _load_individual_packages(self):
        """加载单独的语言包（回退方案）"""
        language_imports = [
            ("java", "tree_sitter_java", "language"),
            ("c", "tree_sitter_c", "language"),
            ("cpp", "tree_sitter_cpp", "language"),
            ("javascript", "tree_sitter_javascript", "language"),
            ("typescript", "tree_sitter_typescript", "language_typescript"),
            ("tsx", "tree_sitter_typescript", "language_tsx"),
        ]

        for lang_name, module_name, attr_name in language_imports:
            try:
                module = __import__(module_name)
                if hasattr(module, attr_name):
                    lang_func = getattr(module, attr_name)
                    self.LANGUAGE_MAP[lang_name] = Language(lang_func())
                    logger.debug(f"Loaded {lang_name} from {module_name}")
            except Exception as e:
                logger.debug(f"Failed to load {lang_name}: {e}")

    def get_language(self, language: str) -> Optional[Any]:
        """
        获取语言对象

        Args:
            language: 语言名称

        Returns:
            Language 对象或 None
        """
        return self.LANGUAGE_MAP.get(language)

    def parse_file(self, file_path: str, language: Optional[str] = None) -> Optional[Any]:
        """
        解析单个文件，返回 AST

        Args:
            file_path: 文件路径
            language: 语言名称(可选，自动检测)

        Returns:
            tree_sitter.Tree 对象或 None
        """
        if not TREE_SITTER_AVAILABLE:
            return None

        # 自动检测语言
        if language is None:
            language = self.detect_language(file_path)

        if language is None:
            return None

        lang = self.LANGUAGE_MAP.get(language)
        if lang is None:
            logger.debug(f"Language {language} not supported")
            return None

        # 获取或创建解析器
        parser = self._parsers.get(lang)
        if parser is None:
            parser = Parser(lang)
            self._parsers[lang] = parser

        try:
            with open(file_path, "rb") as f:
                source_code = f.read()
            return parser.parse(source_code)
        except FileNotFoundError:
            logger.warning(f"File not found: {file_path}")
            return None
        except Exception as e:
            logger.error(f"Failed to parse file {file_path}: {e}")
            return None

    def parse_code(self, code: str, language: str) -> Optional[Any]:
        """
        解析代码字符串，返回 AST

        Args:
            code: 源代码字符串
            language: 语言名称

        Returns:
            tree_sitter.Tree 对象或 None
        """
        if not TREE_SITTER_AVAILABLE:
            return None

        lang = self.LANGUAGE_MAP.get(language)
        if lang is None:
            return None

        parser = self._parsers.get(lang)
        if parser is None:
            parser = Parser(lang)
            self._parsers[lang] = parser

        try:
            return parser.parse(code.encode("utf-8"))
        except Exception as e:
            logger.error(f"Failed to parse code: {e}")
            return None

    def query(self, tree: Any, query_str: str, language: str) -> List[tuple]:
        """
        执行 tree-sitter 查询

        Args:
            tree: AST 树对象
            query_str: tree-sitter 查询字符串
            language: 语言名称

        Returns:
            捕获的节点列表 [(node, capture_name), ...]
        """
        if not TREE_SITTER_AVAILABLE or tree is None:
            return []

        lang = self.LANGUAGE_MAP.get(language)
        if lang is None:
            return []

        try:
            query = lang.query(query_str)
            captures = query.captures(tree.root_node)
            return list(captures)
        except Exception as e:
            logger.error(f"Query failed: {e}")
            return []

    def detect_language(self, file_path: str) -> Optional[str]:
        """
        检测文件语言

        Args:
            file_path: 文件路径

        Returns:
            语言名称或 None
        """
        from pathlib import Path
        ext = Path(file_path).suffix.lower()
        return self.EXTENSION_MAP.get(ext)

    def get_node_text(self, node: Any, source_code: bytes) -> str:
        """
        获取节点对应的源代码文本

        Args:
            node: tree-sitter 节点
            source_code: 源代码字节

        Returns:
            节点文本
        """
        return source_code[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

    def walk_tree(self, tree: Any, callback: callable):
        """
        遍历 AST 树

        Args:
            tree: AST 树对象
            callback: 回调函数 (node) -> bool (True 继续遍历, False 停止)
        """
        if tree is None:
            return

        def _walk(node):
            if not callback(node):
                return
            for child in node.children:
                _walk(child)

        _walk(tree.root_node)

    def find_nodes_by_type(self, tree: Any, node_type: str) -> List[Any]:
        """
        按类型查找节点

        Args:
            tree: AST 树对象
            node_type: 节点类型名称

        Returns:
            匹配的节点列表
        """
        nodes = []

        def callback(node):
            if node.type == node_type:
                nodes.append(node)
            return True

        self.walk_tree(tree, callback)
        return nodes

    def find_nodes_by_types(self, tree: Any, node_types: set) -> List[Any]:
        """
        按多种类型查找节点

        Args:
            tree: AST 树对象
            node_types: 节点类型名称集合

        Returns:
            匹配的节点列表
        """
        nodes = []

        def callback(node):
            if node.type in node_types:
                nodes.append(node)
            return True

        self.walk_tree(tree, callback)
        return nodes
