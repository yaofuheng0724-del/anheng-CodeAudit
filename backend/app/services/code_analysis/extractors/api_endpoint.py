"""API 端点提取器

提取 Web API 端点定义，支持多种框架:
- Java: Spring MVC (RequestMapping, GetMapping, etc.)
- JavaScript/TypeScript: Express, NestJS, Koa
"""

import re
import logging
from typing import List, Any, Optional, Dict, Set
from dataclasses import dataclass, field

from .base import BaseExtractor

logger = logging.getLogger(__name__)


@dataclass
class APIEndpointInfo:
    """API 端点信息"""
    file_path: str
    line_number: int
    method: str  # GET, POST, PUT, DELETE, PATCH, etc.
    path: str    # URL 路径
    handler: Optional[str] = None  # 处理函数名
    framework: Optional[str] = None  # 框架名称
    parameters: List[Dict[str, str]] = field(default_factory=list)
    annotations: List[str] = field(default_factory=list)
    source_snippet: Optional[str] = None  # 源代码片段


class APIEndpointExtractor(BaseExtractor):
    """
    API 端点提取器

    提取 Web API 端点定义，包括:
    - Java Spring: @RequestMapping, @GetMapping, @PostMapping, etc.
    - JS Express: app.get(), app.post(), router.get(), etc.
    - JS NestJS: @Get(), @Post(), @Controller(), etc.
    """

    # HTTP 方法映射
    HTTP_METHODS = {'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'}

    # Spring 注解到 HTTP 方法的映射
    SPRING_ANNOTATIONS = {
        'GetMapping': 'GET',
        'PostMapping': 'POST',
        'PutMapping': 'PUT',
        'DeleteMapping': 'DELETE',
        'PatchMapping': 'PATCH',
        'RequestMapping': None,  # 需要从属性解析
        'GetMapping': 'GET',
        'PostMapping': 'POST',
    }

    # Express HTTP 方法名
    EXPRESS_METHODS = {'get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'all'}

    def extract(self, tree: Any, source: bytes, file_path: str, language: str) -> List[APIEndpointInfo]:
        """
        提取 API 端点

        Args:
            tree: tree-sitter AST 树
            source: 源代码字节
            file_path: 文件路径
            language: 语言名称

        Returns:
            APIEndpointInfo 列表
        """
        endpoints = []

        if language == 'java':
            endpoints = self._extract_java_endpoints(tree, source, file_path)
        elif language in ('javascript', 'typescript'):
            endpoints = self._extract_js_endpoints(tree, source, file_path, language)

        return endpoints

    def _extract_java_endpoints(self, tree: Any, source: bytes, file_path: str) -> List[APIEndpointInfo]:
        """
        提取 Java Spring API 端点

        查找带有 Spring MVC 注解的方法
        """
        endpoints = []

        # 查找所有方法声明
        method_nodes = self.find_nodes_by_type(tree, 'method_declaration')

        for method_node in method_nodes:
            try:
                endpoint = self._parse_java_spring_method(method_node, source, file_path)
                if endpoint:
                    endpoints.append(endpoint)
            except Exception as e:
                logger.debug(f"Failed to parse Java method: {e}")

        return endpoints

    def _parse_java_spring_method(self, method_node: Any, source: bytes, file_path: str) -> Optional[APIEndpointInfo]:
        """
        解析 Spring MVC 注解的方法

        检查方法上的注解:
        - @GetMapping("/path")
        - @PostMapping("/path")
        - @RequestMapping(value = "/path", method = RequestMethod.GET)
        """
        # 查找类级别的 @RequestMapping 作为基础路径
        class_path = self._find_class_request_mapping(method_node, source)

        # 查找方法上的注解
        annotations_info = []
        http_method = None
        path = None

        # 遍历方法修饰符中的注解
        for child in method_node.children:
            if child.type == 'modifiers':
                for modifier in child.children:
                    if modifier.type == 'annotation':
                        anno_info = self._parse_annotation(modifier, source)
                        if anno_info:
                            annotations_info.append(anno_info)
                            anno_name = anno_info['name']

                            # 检查是否为映射注解
                            if anno_name in self.SPRING_ANNOTATIONS:
                                method = self.SPRING_ANNOTATIONS[anno_name]
                                if method:
                                    http_method = method
                                # 提取路径
                                path = self._extract_path_from_annotation(anno_info, anno_name)

                            elif anno_name == 'RequestMapping':
                                http_method = self._extract_method_from_request_mapping(anno_info)
                                path = self._extract_path_from_annotation(anno_info, anno_name)

        if http_method is None or path is None:
            return None

        # 合并类路径和方法路径
        if class_path and not path.startswith('/'):
            full_path = class_path.rstrip('/') + '/' + path.lstrip('/')
        elif class_path and path.startswith('/'):
            full_path = class_path.rstrip('/') + path
        else:
            full_path = path

        # 获取方法名
        handler = self.get_function_name(method_node, source)

        # 获取源代码片段
        source_snippet = self.get_node_text(method_node, source)
        if len(source_snippet) > 200:
            source_snippet = source_snippet[:200] + '...'

        return APIEndpointInfo(
            file_path=file_path,
            line_number=method_node.start_point[0] + 1,
            method=http_method,
            path=full_path,
            handler=handler,
            framework='spring',
            annotations=[anno['name'] for anno in annotations_info],
            source_snippet=source_snippet,
        )

    def _find_class_request_mapping(self, method_node: Any, source: bytes) -> Optional[str]:
        """查找类级别的 @RequestMapping 作为基础路径"""
        current = method_node.parent
        while current:
            if current.type == 'class_declaration':
                # 查找类上的注解
                for child in current.children:
                    if child.type == 'modifiers':
                        for modifier in child.children:
                            if modifier.type == 'annotation':
                                anno_info = self._parse_annotation(modifier, source)
                                if anno_info and anno_info['name'] == 'RequestMapping':
                                    return self._extract_path_from_annotation(anno_info, 'RequestMapping')
            current = current.parent
        return None

    def _parse_annotation(self, annotation_node: Any, source: bytes) -> Optional[Dict]:
        """
        解析注解节点

        返回: { name: str, arguments: [...] }
        """
        result = {'name': None, 'arguments': []}

        for child in annotation_node.children:
            # 注解名称
            if child.type == 'identifier':
                result['name'] = self.get_node_text(child, source)
            elif child.type == 'scoped_identifier':
                result['name'] = self.get_node_text(child, source).split('.')[-1]

            # 注解参数
            elif child.type == 'argument_list' or child.type == 'annotation_argument_list':
                for arg in child.children:
                    if arg.type in ('string_literal', 'string', 'identifier', 'assignment_expression'):
                        result['arguments'].append(self.get_node_text(arg, source))

        return result if result['name'] else None

    def _extract_path_from_annotation(self, anno_info: Dict, anno_name: str) -> Optional[str]:
        """从注解中提取路径"""
        args = anno_info.get('arguments', [])

        if not args:
            return '/'

        for arg in args:
            # 直接字符串: @GetMapping("/path")
            if arg.startswith('"') or arg.startswith("'"):
                return arg.strip('"\'')

            # value = "/path" 或 path = "/path"
            if '=' in arg:
                match = re.search(r'(?:value|path)\s*=\s*["\']([^"\']+)["\']', arg)
                if match:
                    return match.group(1)

        return '/'

    def _extract_method_from_request_mapping(self, anno_info: Dict) -> str:
        """从 @RequestMapping 注解中提取 HTTP 方法"""
        args = anno_info.get('arguments', [])

        for arg in args:
            if 'method' in arg:
                # method = RequestMethod.GET
                match = re.search(r'RequestMethod\.(\w+)', arg)
                if match:
                    return match.group(1).upper()
                # method = GET (简化写法)
                match = re.search(r'method\s*=\s*(\w+)', arg)
                if match:
                    return match.group(1).upper()

        # 默认支持所有方法
        return 'GET'

    def _extract_js_endpoints(self, tree: Any, source: bytes, file_path: str, language: str) -> List[APIEndpointInfo]:
        """
        提取 JS/TS API 端点

        支持 Express, NestJS, Koa 等框架
        """
        endpoints = []

        # 先检查是否为 NestJS (装饰器风格)
        nestjs_endpoints = self._extract_nestjs_endpoints(tree, source, file_path, language)
        endpoints.extend(nestjs_endpoints)

        # 检查 Express 风格
        express_endpoints = self._extract_express_endpoints(tree, source, file_path, language)
        endpoints.extend(express_endpoints)

        return endpoints

    def _extract_express_endpoints(self, tree: Any, source: bytes, file_path: str, language: str) -> List[APIEndpointInfo]:
        """
        提取 Express 风格的 API 端点

        示例:
        - app.get('/path', handler)
        - router.post('/path', handler)
        - app.use('/api', router)
        """
        endpoints = []

        # 查找所有调用表达式
        call_nodes = self.find_nodes_by_type(tree, 'call_expression')

        for call_node in call_nodes:
            try:
                endpoint = self._parse_express_call(call_node, source, file_path)
                if endpoint:
                    endpoints.append(endpoint)
            except Exception as e:
                logger.debug(f"Failed to parse Express call: {e}")

        return endpoints

    def _parse_express_call(self, call_node: Any, source: bytes, file_path: str) -> Optional[APIEndpointInfo]:
        """
        解析 Express 风格的调用

        检查是否为 app.get('/path', ...) 或 router.post('/path', ...)
        """
        # 获取调用函数
        func_node = call_node.child_by_field_name('function')
        if func_node is None:
            return None

        # 检查是否为成员访问 (app.get, router.post)
        if func_node.type != 'member_expression':
            return None

        # 获取对象和属性
        obj_node = func_node.child_by_field_name('object')
        prop_node = func_node.child_by_field_name('property')

        if obj_node is None or prop_node is None:
            return None

        method_name = self.get_node_text(prop_node, source)

        # 检查是否为 HTTP 方法
        if method_name not in self.EXPRESS_METHODS:
            return None

        # 检查对象名 (app, router, etc.)
        obj_name = self.get_node_text(obj_node, source)
        if not self._is_express_app_or_router(obj_name):
            return None

        # 获取参数
        args_node = call_node.child_by_field_name('arguments')
        if args_node is None or len(args_node.children) == 0:
            return None

        # 第一个参数应该是路径
        path = None
        for i, child in enumerate(args_node.children):
            if child.type in ('string', 'string_literal'):
                path = self.get_node_text(child, source).strip('\'"`')
                break
            elif child.type == 'template_string':
                path = self.get_node_text(child, source)
                # 简化处理模板字符串
                path = re.sub(r'`([^`]*)`', r'\1', path)
                break

        if path is None:
            return None

        http_method = method_name.upper()
        if http_method == 'ALL':
            http_method = '*'  # 匹配所有方法

        return APIEndpointInfo(
            file_path=file_path,
            line_number=call_node.start_point[0] + 1,
            method=http_method,
            path=path,
            handler=None,  # 可以尝试提取处理函数名
            framework='express',
            source_snippet=self.get_node_text(call_node, source)[:200],
        )

    def _is_express_app_or_router(self, name: str) -> bool:
        """判断是否为 Express app 或 router"""
        common_names = {'app', 'router', 'route', 'api', 'server', 'express'}
        return name.lower() in common_names or name in common_names

    def _extract_nestjs_endpoints(self, tree: Any, source: bytes, file_path: str, language: str) -> List[APIEndpointInfo]:
        """
        提取 NestJS 风格的 API 端点

        示例:
        @Controller('users')
        class UserController {
            @Get(':id')
            findOne(@Param('id') id: string) {}
        }
        """
        endpoints = []

        if language != 'typescript':
            return endpoints

        # 查找类声明
        class_nodes = self.find_nodes_by_type(tree, 'class_declaration')

        for class_node in class_nodes:
            # 检查是否有 @Controller 装饰器
            controller_path = self._find_nestjs_controller_path(class_node, source)
            if controller_path is None:
                continue

            # 查找类中的方法
            for child in class_node.children:
                if child.type == 'class_body':
                    for member in child.children:
                        if member.type == 'method_definition':
                            endpoint = self._parse_nestjs_method(member, source, file_path, controller_path)
                            if endpoint:
                                endpoints.append(endpoint)

        return endpoints

    def _find_nestjs_controller_path(self, class_node: Any, source: bytes) -> Optional[str]:
        """查找 NestJS @Controller 装饰器中的路径"""
        for child in class_node.children:
            if child.type == 'decorator':
                for dec_child in child.children:
                    if dec_child.type == 'call_expression':
                        func = dec_child.child_by_field_name('function')
                        if func:
                            dec_name = self.get_node_text(func, source)
                            if dec_name == 'Controller':
                                # 提取参数中的路径
                                args = dec_child.child_by_field_name('arguments')
                                if args:
                                    for arg in args.children:
                                        if arg.type in ('string', 'string_literal'):
                                            return self.get_node_text(arg, source).strip('\'"`')
                                return ''  # @Controller() 无参数
        return None

    def _parse_nestjs_method(self, method_node: Any, source: bytes, file_path: str, controller_path: str) -> Optional[APIEndpointInfo]:
        """解析 NestJS 方法"""
        http_method = None
        method_path = None

        # 查找方法上的装饰器
        for child in method_node.children:
            if child.type == 'decorator':
                for dec_child in child.children:
                    if dec_child.type == 'call_expression':
                        func = dec_child.child_by_field_name('function')
                        if func:
                            dec_name = self.get_node_text(func, source)
                            if dec_name.upper() in self.HTTP_METHODS:
                                http_method = dec_name.upper()
                                # 提取路径参数
                                args = dec_child.child_by_field_name('arguments')
                                if args:
                                    for arg in args.children:
                                        if arg.type in ('string', 'string_literal'):
                                            method_path = self.get_node_text(arg, source).strip('\'"`')
                                if method_path is None:
                                    method_path = ''
                                break
                    elif child.type == 'identifier':
                        # @Get 形式 (无括号)
                        dec_name = self.get_node_text(child, source)
                        if dec_name.upper() in self.HTTP_METHODS:
                            http_method = dec_name.upper()
                            method_path = ''

        if http_method is None:
            return None

        # 合并路径
        full_path = controller_path.rstrip('/') + '/' + method_path.lstrip('/') if method_path else controller_path
        if not full_path.startswith('/'):
            full_path = '/' + full_path

        # 获取方法名
        handler = self.get_function_name(method_node, source)

        return APIEndpointInfo(
            file_path=file_path,
            line_number=method_node.start_point[0] + 1,
            method=http_method,
            path=full_path,
            handler=handler,
            framework='nestjs',
            source_snippet=self.get_node_text(method_node, source)[:200],
        )
