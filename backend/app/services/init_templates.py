"""
初始化系统预置的提示词模板和审计规则
"""

import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.prompt_template import PromptTemplate
from app.models.audit_rule import AuditRuleSet, AuditRule

logger = logging.getLogger(__name__)


# ==================== 规则分类函数 ====================

def classify_rule_category(name: str) -> str:
    """
    根据规则名称自动分类规则类别:
    - 规则名带有"性能"的统一归为性能规则 → 'performance'
    - 规则名带有"质量"的统一归为质量规则 → 'quality'
    - 其他均归为漏洞规则 → 'security'
    """
    if "性能" in name:
        return "performance"
    elif "质量" in name:
        return "quality"
    else:
        return "security"


def classify_rule_set_type(name: str) -> str:
    """
    根据规则集名称自动分类规则集类型:
    - 规则集名带有"性能"的归为性能规则集 → 'performance'
    - 规则集名带有"质量"的归为质量规则集 → 'quality'
    - 其他均归为漏洞规则集 → 'security'
    """
    if "性能" in name:
        return "performance"
    elif "质量" in name:
        return "quality"
    else:
        return "security"


# ==================== 系统提示词模板 ====================

SYSTEM_PROMPT_TEMPLATES = [
    {
        "name": "默认代码审计",
        "description": "全面的代码审计提示词，涵盖安全、性能、代码质量等多个维度",
        "template_type": "system",
        "is_default": True,
        "sort_order": 0,
        "variables": {"language": "编程语言", "code": "代码内容"},
        "content_zh": """你是一个专业的代码审计助手。请从以下维度全面分析代码：
- 安全漏洞（SQL注入、XSS、命令注入、路径遍历、SSRF、XXE、反序列化、硬编码密钥等）
- 潜在的 Bug 和逻辑错误
- 性能问题和优化建议
- 编码规范和代码风格
- 可维护性和可读性
- 最佳实践和设计模式

请尽可能多地找出代码中的所有问题，不要遗漏任何安全漏洞或潜在风险！""",
        "content_en": """You are a professional code auditing assistant. Please comprehensively analyze the code from the following dimensions:
- Security vulnerabilities (SQL injection, XSS, command injection, path traversal, SSRF, XXE, deserialization, hardcoded secrets, etc.)
- Potential bugs and logical errors
- Performance issues and optimization suggestions
- Coding standards and code style
- Maintainability and readability
- Best practices and design patterns

Find as many issues as possible! Do NOT miss any security vulnerabilities or potential risks!"""
    },
    {
        "name": "安全专项审计",
        "description": "专注于安全漏洞检测的提示词模板",
        "template_type": "system",
        "is_default": False,
        "sort_order": 1,
        "variables": {"language": "编程语言", "code": "代码内容"},
        "content_zh": """你是一个专业的安全审计专家。请专注于检测以下安全问题：

【注入类漏洞】
- SQL注入（包括盲注、时间盲注、联合查询注入）
- 命令注入（OS命令执行）
- LDAP注入
- XPath注入
- NoSQL注入

【跨站脚本（XSS）】
- 反射型XSS
- 存储型XSS
- DOM型XSS

【认证与授权】
- 硬编码凭证
- 弱密码策略
- 会话管理问题
- 权限绕过

【敏感数据】
- 敏感信息泄露
- 不安全的加密
- 明文传输敏感数据

【其他安全问题】
- SSRF（服务端请求伪造）
- XXE（XML外部实体注入）
- 反序列化漏洞
- 路径遍历
- 文件上传漏洞
- CSRF（跨站请求伪造）

请详细说明每个漏洞的风险等级、利用方式和修复建议。""",
        "content_en": """You are a professional security audit expert. Please focus on detecting the following security issues:

【Injection Vulnerabilities】
- SQL Injection (including blind, time-based, union-based)
- Command Injection (OS command execution)
- LDAP Injection
- XPath Injection
- NoSQL Injection

【Cross-Site Scripting (XSS)】
- Reflected XSS
- Stored XSS
- DOM-based XSS

【Authentication & Authorization】
- Hardcoded credentials
- Weak password policies
- Session management issues
- Authorization bypass

【Sensitive Data】
- Sensitive information disclosure
- Insecure cryptography
- Plaintext transmission of sensitive data

【Other Security Issues】
- SSRF (Server-Side Request Forgery)
- XXE (XML External Entity Injection)
- Deserialization vulnerabilities
- Path traversal
- File upload vulnerabilities
- CSRF (Cross-Site Request Forgery)

Please provide detailed risk level, exploitation method, and remediation suggestions for each vulnerability."""
    },
    {
        "name": "性能优化审计",
        "description": "专注于性能问题检测的提示词模板",
        "template_type": "system",
        "is_default": False,
        "sort_order": 2,
        "variables": {"language": "编程语言", "code": "代码内容"},
        "content_zh": """你是一个专业的性能优化专家。请专注于检测以下性能问题：

【数据库性能】
- N+1查询问题
- 缺少索引
- 不必要的全表扫描
- 大量数据一次性加载
- 未使用连接池

【内存问题】
- 内存泄漏
- 大对象未及时释放
- 缓存使用不当
- 循环中创建大量对象

【算法效率】
- 时间复杂度过高
- 不必要的重复计算
- 可优化的循环
- 递归深度过大

【并发问题】
- 线程安全问题
- 死锁风险
- 资源竞争
- 不必要的同步

【I/O性能】
- 同步阻塞I/O
- 未使用缓冲
- 频繁的小文件操作
- 网络请求未优化

请提供具体的优化建议和预期的性能提升。""",
        "content_en": """You are a professional performance optimization expert. Please focus on detecting the following performance issues:

【Database Performance】
- N+1 query problems
- Missing indexes
- Unnecessary full table scans
- Loading large amounts of data at once
- Not using connection pools

【Memory Issues】
- Memory leaks
- Large objects not released timely
- Improper cache usage
- Creating many objects in loops

【Algorithm Efficiency】
- High time complexity
- Unnecessary repeated calculations
- Optimizable loops
- Excessive recursion depth

【Concurrency Issues】
- Thread safety problems
- Deadlock risks
- Resource contention
- Unnecessary synchronization

【I/O Performance】
- Synchronous blocking I/O
- Not using buffers
- Frequent small file operations
- Unoptimized network requests

Please provide specific optimization suggestions and expected performance improvements."""
    },
    {
        "name": "代码质量审计",
        "description": "专注于代码质量和可维护性的提示词模板",
        "template_type": "system",
        "is_default": False,
        "sort_order": 3,
        "variables": {"language": "编程语言", "code": "代码内容"},
        "content_zh": """你是一个专业的代码质量审计专家。请专注于检测以下代码质量问题：

【代码规范】
- 命名不规范（变量、函数、类）
- 代码格式不一致
- 注释缺失或过时
- 魔法数字/字符串

【代码结构】
- 函数过长（超过50行）
- 类职责不单一
- 嵌套层级过深
- 重复代码

【可维护性】
- 高耦合低内聚
- 缺少错误处理
- 硬编码配置
- 缺少日志记录

【设计模式】
- 违反SOLID原则
- 可使用设计模式优化的场景
- 过度设计

【测试相关】
- 难以测试的代码
- 缺少边界条件处理
- 依赖注入问题

请提供具体的重构建议和代码示例。""",
        "content_en": """You are a professional code quality audit expert. Please focus on detecting the following code quality issues:

【Code Standards】
- Non-standard naming (variables, functions, classes)
- Inconsistent code formatting
- Missing or outdated comments
- Magic numbers/strings

【Code Structure】
- Functions too long (over 50 lines)
- Classes with multiple responsibilities
- Deep nesting levels
- Duplicate code

【Maintainability】
- High coupling, low cohesion
- Missing error handling
- Hardcoded configurations
- Missing logging

【Design Patterns】
- SOLID principle violations
- Scenarios that could benefit from design patterns
- Over-engineering

【Testing Related】
- Hard-to-test code
- Missing boundary condition handling
- Dependency injection issues

Please provide specific refactoring suggestions and code examples."""
    },
]


# ==================== 系统审计规则集 ====================

SYSTEM_RULE_SETS = [
    {
        "name": "OWASP Top 10",
        "description": "基于 OWASP Top 10 2021 的安全审计规则集",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "sort_order": 1,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "A01",
                "name": "访问控制失效",
                "description": "检测权限绕过、越权访问、IDOR等访问控制问题",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在访问控制失效问题：权限检查缺失、越权访问、IDOR（不安全的直接对象引用）、CORS配置错误",
                "fix_suggestion": "实施最小权限原则，在服务端进行权限验证，使用基于角色的访问控制(RBAC)",
                "reference_url": "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
            },
            {
                "rule_code": "A02",
                "name": "加密机制失效",
                "description": "检测弱加密、明文传输、密钥管理不当等问题",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在加密问题：使用弱加密算法(MD5/SHA1/DES)、明文存储密码、硬编码密钥、不安全的随机数生成",
                "fix_suggestion": "使用强加密算法(AES-256/RSA-2048)，使用安全的密码哈希(bcrypt/Argon2)，妥善管理密钥",
                "reference_url": "https://owasp.org/Top10/A02_2021-Cryptographic_Failures/",
            },
            {
                "rule_code": "A03",
                "name": "注入攻击",
                "description": "检测SQL注入、命令注入、LDAP注入等注入漏洞",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在注入漏洞：SQL注入、命令注入、LDAP注入、XPath注入、NoSQL注入、表达式语言注入",
                "fix_suggestion": "使用参数化查询，输入验证和转义，使用ORM框架，最小权限原则",
                "reference_url": "https://owasp.org/Top10/A03_2021-Injection/",
            },
            {
                "rule_code": "A04",
                "name": "不安全设计",
                "description": "检测业务逻辑漏洞、缺少安全控制等设计问题",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否存在不安全的设计：缺少速率限制、业务逻辑漏洞、缺少输入验证、信任边界不清",
                "fix_suggestion": "采用安全设计原则，威胁建模，实施深度防御",
                "reference_url": "https://owasp.org/Top10/A04_2021-Insecure_Design/",
            },
            {
                "rule_code": "A05",
                "name": "安全配置错误",
                "description": "检测默认配置、不必要的功能、错误的权限设置",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否存在安全配置错误：默认凭证、不必要的功能启用、详细错误信息泄露、缺少安全头",
                "fix_suggestion": "最小化安装，禁用不必要功能，定期审查配置，自动化配置检查",
                "reference_url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
            },
            {
                "rule_code": "A06",
                "name": "易受攻击和过时的组件",
                "description": "检测使用已知漏洞的依赖库",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否使用了已知漏洞的组件：过时的依赖库、未修补的漏洞、不安全的第三方组件",
                "fix_suggestion": "定期更新依赖，使用依赖扫描工具，订阅安全公告",
                "reference_url": "https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/",
            },
            {
                "rule_code": "A07",
                "name": "身份认证失效",
                "description": "检测弱密码、会话管理问题、凭证泄露",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在身份认证问题：弱密码策略、会话固定、凭证明文存储、缺少多因素认证",
                "fix_suggestion": "实施强密码策略，使用MFA，安全的会话管理，防止暴力破解",
                "reference_url": "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/",
            },
            {
                "rule_code": "A08",
                "name": "软件和数据完整性失效",
                "description": "检测不安全的反序列化、CI/CD安全问题",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在完整性问题：不安全的反序列化、未验证的更新、CI/CD管道安全",
                "fix_suggestion": "验证数据完整性，使用数字签名，安全的反序列化",
                "reference_url": "https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/",
            },
            {
                "rule_code": "A09",
                "name": "安全日志和监控失效",
                "description": "检测日志记录不足、监控缺失",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "检查是否存在日志监控问题：缺少安全日志、敏感信息记录到日志、缺少告警机制",
                "fix_suggestion": "记录安全相关事件，实施监控和告警，定期审查日志",
                "reference_url": "https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/",
            },
            {
                "rule_code": "A10",
                "name": "服务端请求伪造(SSRF)",
                "description": "检测SSRF漏洞",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否存在SSRF漏洞：未验证的URL输入、内网资源访问、云元数据访问",
                "fix_suggestion": "验证和过滤URL，使用白名单，禁用不必要的协议",
                "reference_url": "https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/",
            },
        ]
    },
    {
        # ============================================================
        # 综合安全审计规则集 —— 默认规则集
        # 数据来源：CWE/SANS Top 25、OWASP ASVS 4.0、FindSecBugs、Bandit、CERT安全编码、Semgrep Registry
        # ============================================================
        "name": "综合安全审计规则集",
        "description": "基于 CWE/SANS Top 25、OWASP ASVS 4.0、FindSecBugs、Bandit、CERT 等开源安全标准整合的体系化代码审计规则集，覆盖注入、XSS、认证、授权、加密、反序列化、SSRF、路径遍历等 13 大类 68 条细粒度检测规则",
        "language": "all",
        "rule_type": "security",
        "is_default": True,
        "sort_order": 0,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            # =================== 注入攻击类 ===================
            {
                "rule_code": "SEC-INJ-001",
                "name": "SQL注入 - 参数化查询缺失",
                "description": "检测SQL语句拼接不可信输入导致的SQL注入漏洞 (CWE-89)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-89】检测SQL注入漏洞：检查是否存在将不可信输入直接拼接到SQL语句的情况。重点关注：Python的cursor.execute()使用字符串拼接或f-string；Java的Statement.execute()/createQuery()/createNativeQuery()使用+拼接；PHP的mysql_query()/mysqli_query()拼接；Go的db.Query()拼接；C/C++的mysql_query()/sqlite3_exec()拼接；所有语言中使用raw SQL而非参数化查询/ORM安全接口的模式",
                "fix_suggestion": "使用参数化查询(PreparedStatement/绑定参数)或ORM安全接口，禁止将不可信输入拼接到SQL语句",
                "reference_url": "https://cwe.mitre.org/data/definitions/89.html",
                "code_patterns": {"python": ["cursor.execute($SQL + $INPUT)", "cursor.execute(f\"...{$INPUT}...\")", "cursor.execute(\"... %s\" % $VAR)", "session.execute(text($SQL + $INPUT))", "db.engine.execute($SQL + $INPUT)"], "java": ["$STMT.execute($SQL + $INPUT)", "$STMT.executeQuery($SQL + $INPUT)", "$EM.createQuery($SQL + $INPUT)", "$EM.createNativeQuery($SQL + $INPUT)", "jdbcTemplate.queryForList($SQL + $INPUT)"], "go": ["db.Query($SQL + $VAR)", "db.Query(fmt.Sprintf(\"...%s...\", $VAR))", "db.Exec($SQL + $VAR)"], "php": ["mysqli_query($CONN, $SQL . $VAR)", "$pdo->query($SQL . $VAR)", "$DB->query($SQL . $VAR)"], "c": ["mysql_query($CONN, $SQL)", "sqlite3_exec($DB, $SQL, ...)", "PQexec($CONN, $SQL)"]},
                "sort_order": 1,
            },
            {
                "rule_code": "SEC-INJ-002",
                "name": "NoSQL注入 - MongoDB/Redis查询拼接",
                "description": "检测NoSQL数据库查询中拼接不可信输入导致的注入漏洞 (CWE-943)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-943】检测NoSQL注入漏洞：检查MongoDB的collection.find()/update()中是否使用$where拼接JS表达式或直接传入用户可控的查询条件对象；检查Redis的EVAL命令是否拼接不可信输入；检查Elasticsearch查询是否直接传入用户控制的JSON查询体",
                "fix_suggestion": "对NoSQL查询参数做类型白名单校验，禁止$where中使用JS表达式，使用ORM的安全查询接口",
                "reference_url": "https://cwe.mitre.org/data/definitions/943.html",
                "code_patterns": {"python": ["collection.find({'$where': $INPUT})", "collection.find($USER_DICT)", "collection.update($USER_DICT, ...)"], "javascript": ["collection.find($USER_OBJ)", "collection.find({ $where: $INPUT })", "db.collection.find($REQ.body)"], "java": ["$MONGO.find($USER_OBJ)", "$COLLECTION.find($BSON)", "mongoTemplate.find($QUERY, $USER_INPUT)"]},
                "sort_order": 2,
            },
            {
                "rule_code": "SEC-INJ-003",
                "name": "命令注入 - OS命令拼接",
                "description": "检测将不可信输入传入系统命令执行函数导致的命令注入 (CWE-78)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-78】检测OS命令注入漏洞：检查是否存在将不可信输入传入系统命令执行函数。重点关注：Python的os.system()/subprocess.Popen(shell=True)/os.popen()；Java的Runtime.getRuntime().exec()/ProcessBuilder使用拼接参数；PHP的system()/exec()/shell_exec()/popen()；C/C++的system()/popen()/exec*()；Go的os/exec.Command()拼接参数；Ruby的system()/exec()；所有使用shell=True或字符串拼接构造命令的模式",
                "fix_suggestion": "禁止将不可信输入传入命令执行函数；必须执行时使用参数数组(非shell模式)并做严格白名单校验",
                "reference_url": "https://cwe.mitre.org/data/definitions/78.html",
                "code_patterns": {"python": ["os.system($CMD)", "subprocess.Popen($CMD, shell=True)", "os.popen($CMD)", "subprocess.call($CMD, shell=True)", "subprocess.run($CMD, shell=True)"], "java": ["Runtime.getRuntime().exec($CMD)", "new ProcessBuilder($CMD)", "Runtime.getRuntime().exec($REQ.getParameter(...))"], "php": ["system($CMD)", "exec($CMD)", "shell_exec($CMD)", "popen($CMD, ...)"], "go": ["exec.Command($CMD, $ARGS...)", "exec.Command($SH, \"-c\", $INPUT)"], "c": ["system($VAR)", "popen($VAR, ...)", "execl($PATH, $ARG, ...)"]},
                "sort_order": 3,
            },
            {
                "rule_code": "SEC-INJ-004",
                "name": "LDAP注入 - LDAP查询拼接",
                "description": "检测LDAP查询中拼接不可信输入导致的注入漏洞 (CWE-90)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-90】检测LDAP注入漏洞：检查是否存在将不可信输入拼接到LDAP查询过滤器的代码。重点关注：Java的LdapContext.search()使用拼接过滤器字符串；Python的ldap.search()拼接filter；.NET的DirectorySearcher.Filter拼接；LDAP特殊字符(*()\\/)未做转义",
                "fix_suggestion": "对LDAP查询输入做特殊字符转义，使用参数化LDAP查询接口",
                "reference_url": "https://cwe.mitre.org/data/definitions/90.html",
                "code_patterns": {"python": ["ldap.search($BASE, $FILTER + $INPUT)", "$CONN.search_s($BASE, $SCOPE, $FILTER + $INPUT)"], "java": ["$CTX.search($NAME, $FILTER + $INPUT, ...)", "$LdapTemplate.search($FILTER + $INPUT, ...)"]},
                "sort_order": 4,
            },
            {
                "rule_code": "SEC-INJ-005",
                "name": "XPath注入 - XPath表达式拼接",
                "description": "检测XPath查询中拼接不可信输入导致的注入漏洞 (CWE-643)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-643】检测XPath注入漏洞：检查是否存在将不可信输入拼接到XPath表达式的情况。重点关注：Java的XPath.evaluate()/XPathExpression中使用字符串拼接；Python的lxml.xpath()拼接表达式；.NET的XPathNavigator.Select()拼接；XML文档解析时使用动态XPath查询",
                "fix_suggestion": "对XPath查询输入做特殊字符转义，使用参数化XPath查询接口",
                "reference_url": "https://cwe.mitre.org/data/definitions/643.html",
                "code_patterns": {"python": ["lxml.xpath($EXPR + $INPUT)", "$TREE.xpath($INPUT)", "xpath.evaluate($INPUT)"], "java": ["$XPATH.evaluate($INPUT, $DOC, ...)", "$XPATH.compile($INPUT)", "XPathExpression $XPE = $XPATH.compile($INPUT)"]},
                "sort_order": 5,
            },
            {
                "rule_code": "SEC-INJ-006",
                "name": "表达式语言注入 - EL/SpEL注入",
                "description": "检测表达式语言中拼接不可信输入导致的代码注入 (CWE-94)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-94】检测表达式语言注入漏洞：检查是否存在将不可信输入传入表达式引擎执行的情况。重点关注：Java的SpEL(Spring ExpressionLanguage)的ExpressionParser.parseExpression()拼接输入；OGNL表达式注入(Struts2漏洞核心)；MVEL表达式执行；JS的eval()/Function()构造器；Python的eval()/exec()；模板引擎中的表达式注入",
                "fix_suggestion": "禁止将不可信输入传入表达式引擎；对表达式输入做严格白名单校验，使用沙箱执行环境",
                "reference_url": "https://cwe.mitre.org/data/definitions/94.html",
                "code_patterns": {"java": ["ExpressionParser.parseExpression($INPUT)", "$PARSER.parseExpression($INPUT)", "$SPEL.getValue($INPUT)", "Ognl.getValue($INPUT)"], "python": ["eval($INPUT)", "exec($INPUT)", "compile($INPUT, ..., 'exec')"], "javascript": ["eval($INPUT)", "new Function($INPUT)", "setTimeout($INPUT)", "setInterval($INPUT)"]},
                "sort_order": 6,
            },
            {
                "rule_code": "SEC-INJ-007",
                "name": "CRLF/HTTP响应分割注入",
                "description": "检测CRLF字符注入导致的HTTP响应分割漏洞 (CWE-113)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-113】检测CRLF注入/HTTP响应分割漏洞：检查是否存在将包含\\r\\n(CRLF)的不可信输入写入HTTP响应头的情况。重点关注：Java的response.setHeader()/addHeader()使用未过滤输入；Python的HTTP响应header设置；日志写入中拼接不可信输入导致日志注入(CWE-117)；所有将用户输入写入HTTP响应头或日志的场景",
                "fix_suggestion": "对所有写入HTTP响应头或日志的输入做CRLF字符过滤/编码",
                "reference_url": "https://cwe.mitre.org/data/definitions/113.html",
                "code_patterns": {"java": ["response.setHeader($NAME, $INPUT + \"\\r\\n\")", "response.addHeader($NAME, $INPUT)", "logger.info($INPUT + \"\\r\\n\")"], "python": ["logging.info($INPUT)", "response.headers[$NAME] = $INPUT"]},
                "sort_order": 7,
            },
            {
                "rule_code": "SEC-INJ-008",
                "name": "格式化字符串漏洞",
                "description": "检测printf类函数中使用不可信输入作为格式化字符串 (CWE-134)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-134】检测格式化字符串漏洞：检查是否存在将不可信输入直接作为printf/sprintf/fprintf等函数的格式化字符串参数。重点关注：C/C++的printf/fprintf/sprintf/snprintf/vsprintf/vprintf中使用用户输入作为format参数(而非后续参数)；Python的格式化字符串中使用可控模板；所有语言中类似'%s'被外部输入替换format字符串的模式",
                "fix_suggestion": "将不可信输入作为格式化函数的值参数(而非格式字符串参数)，使用常量格式字符串",
                "reference_url": "https://cwe.mitre.org/data/definitions/134.html",
                "code_patterns": {"c": ["printf($INPUT)", "fprintf($STREAM, $INPUT)", "sprintf($BUF, $INPUT)", "snprintf($BUF, $SIZE, $INPUT)"], "python": ["$STR.format($INPUT)", "format_spec % $INPUT"]},
                "sort_order": 8,
            },
            {
                "rule_code": "SEC-INJ-009",
                "name": "模板注入 - SSTI服务端模板注入",
                "description": "检测服务端模板引擎中注入恶意表达式 (CWE-94)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-94】检测服务端模板注入(SSTI)漏洞：检查是否存在将不可信输入直接传入模板引擎作为模板内容(而非模板变量)的情况。重点关注：Python的Jinja2/Flask render_template_string()使用f-string或拼接；Django的mark_safe()；Java的Freemarker/Velocity/Thymeleaf模板中使用动态模板内容；Twig模板注入；模板引擎中{{}}表达式被用户控制",
                "fix_suggestion": "将不可信输入作为模板变量传递(而非模板内容)，禁止动态拼接模板字符串",
                "reference_url": "https://cwe.mitre.org/data/definitions/94.html",
                "code_patterns": {"python": ["render_template_string($INPUT)", "render_template_string(f\"...{$INPUT}...\")", "Environment().from_string($INPUT)", "mark_safe($INPUT)"], "java": ["$FMPL.process($INPUT)", "$VEL.merge($CTX, $WRITER)", "$TMPL.process($DATA, $WRITER)"], "javascript": ["$ENGINE.render($INPUT)", "$TMPL.compile($INPUT)", "ejs.render($INPUT)"]},
                "sort_order": 9,
            },
            {
                "rule_code": "SEC-INJ-010",
                "name": "代码注入 - eval/exec动态执行",
                "description": "检测使用eval/exec等动态代码执行函数处理不可信输入 (CWE-94)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-94】检测代码注入漏洞：检查是否存在使用eval/exec等动态执行函数处理不可信输入的情况。重点关注：Python的eval()/exec()/compile()传入动态内容；JavaScript的eval()/Function()/setTimeout(string)/setInterval(string)；Java的ScriptEngine.eval()；PHP的eval()/assert()；Ruby的eval()；所有将不可信字符串作为代码执行的模式",
                "fix_suggestion": "禁止使用eval/exec类函数处理不可信输入；使用安全的解析/映射替代方案",
                "reference_url": "https://cwe.mitre.org/data/definitions/94.html",
                "code_patterns": {"python": ["eval($INPUT)", "exec($INPUT)", "compile($INPUT, ..., 'exec')", "__import__($INPUT)"], "javascript": ["eval($INPUT)", "new Function($INPUT)", "setTimeout($INPUT)", "setInterval($INPUT)"], "java": ["ScriptEngine.eval($INPUT)", "$ENGINE.eval($INPUT)", "$ENGINE.eval(new StringReader($INPUT))"], "php": ["eval($INPUT)", "assert($INPUT)", "create_function($ARGS, $INPUT)"]},
                "sort_order": 10,
            },
            {
                "rule_code": "SEC-INJ-011",
                "name": "日志注入 - 日志中写入未过滤输入",
                "description": "检测将未过滤的不可信输入写入日志导致的注入 (CWE-117)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-117】检测日志注入漏洞：检查是否存在将包含换行符(CRLF)或其他特殊字符的不可信输入直接写入日志文件的情况。重点关注：Java的Logger.info/warn/error()使用未过滤输入；Python的logging模块使用未过滤输入；所有日志写入中未对输入做CRLF过滤和长度限制的场景；日志伪造攻击(注入假日志行)",
                "fix_suggestion": "对所有写入日志的输入做CRLF过滤、编码和长度限制",
                "reference_url": "https://cwe.mitre.org/data/definitions/117.html",
                "code_patterns": {"python": ["logging.info($INPUT)", "logging.debug($INPUT)", "logger.info($MSG + $INPUT)"], "java": ["log.info($INPUT)", "logger.info($MSG + $INPUT)", "LOGGER.log(Level.INFO, $INPUT)"]},
                "sort_order": 11,
            },
            {
                "rule_code": "SEC-INJ-012",
                "name": "盲注/二次注入",
                "description": "检测SQL盲注和二次注入场景 (CWE-89)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-89】检测SQL盲注和二次注入漏洞：盲注指SQL注入无直接回显但可通过条件响应/时间延迟推断数据；二次注入指不可信输入先存储到数据库，后续在另一处被拼接到SQL中导致注入。重点关注：SQL查询中使用IF/CASE/SLEEP/BENCHMARK等条件/延时函数；存储用户输入后在后续查询中未做参数化处理；FindSecBugs的BLIND_SQL_INJECTION模式",
                "fix_suggestion": "对所有SQL查询统一使用参数化查询(包括从数据库读取的数据)，实施输入长度和类型白名单校验",
                "reference_url": "https://cwe.mitre.org/data/definitions/89.html",
                "code_patterns": {"python": ["cursor.execute(\"... IF(...) SLEEP(...) ...\" + $INPUT)", "session.execute(\"... \" + $DB_VALUE)"], "java": ["$STMT.execute(\"... IF(...) SLEEP(...) ...\" + $INPUT)", "$EM.createNativeQuery($DB_VALUE)"]},
                "sort_order": 12,
            },
            # =================== XSS与前端安全类 ===================
            {
                "rule_code": "SEC-XSS-001",
                "name": "反射型XSS - URL参数直接输出到页面",
                "description": "检测URL请求参数未编码直接输出到HTML导致的反射型XSS (CWE-79)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-79】检测反射型XSS漏洞：检查是否存在将URL请求参数(request.getParameter/queryString/URL参数)未经HTML编码直接输出到页面HTML的情况。重点关注：Java的response.getWriter().print()/JSP的<%=request.getParameter()%>；Python的render_template_string()拼接；PHP的echo $_GET/$_POST；JS的document.write()；所有将URL参数直接输出到HTML响应的模式",
                "fix_suggestion": "对所有输出到HTML的数据做上下文相关的编码(HTML实体编码/JS编码/URL编码)，使用安全模板引擎的自动转义功能",
                "reference_url": "https://cwe.mitre.org/data/definitions/79.html",
                "code_patterns": {"java": ["response.getWriter().print($INPUT)", "response.getWriter().write($INPUT)", "$JSPWriter.print($INPUT)", "<%=request.getParameter(...) %>"], "python": ["return HttpResponse($INPUT)", "render_to_response($INPUT)", "mark_safe($INPUT)"], "php": ["echo $INPUT", "print $INPUT", "printf($INPUT)"], "javascript": ["document.write($INPUT)", "element.innerHTML = $INPUT", "location.href = $INPUT"]},
                "sort_order": 13,
            },
            {
                "rule_code": "SEC-XSS-002",
                "name": "存储型XSS - 用户输入存储后未编码输出",
                "description": "检测用户输入存储到数据库后未编码输出导致的存储型XSS (CWE-79)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-79】检测存储型XSS漏洞：检查是否存在将用户输入(评论/昵称/描述等)存储到数据库/文件后，在后续页面展示时未做HTML编码的情况。重点关注：从数据库读取数据后直接输出到HTML；用户提交的富文本内容未做HTML白名单过滤直接渲染；消息通知中展示用户可控内容未编码",
                "fix_suggestion": "存储前做HTML白名单过滤(sanitize)，展示时做HTML实体编码；使用DOMPurify等库过滤HTML",
                "reference_url": "https://cwe.mitre.org/data/definitions/79.html",
                "code_patterns": {"java": ["response.getWriter().print($DB_RESULT)", "$JSPWriter.print($STORED_DATA)"], "python": ["return HttpResponse($STORED)", "mark_safe($STORED_DATA)", "$MODEL.objects.create(content=$INPUT)"], "javascript": ["element.innerHTML = $STORED", "document.write($STORED)"]},
                "sort_order": 14,
            },
            {
                "rule_code": "SEC-XSS-003",
                "name": "DOM型XSS - 客户端DOM操作不安全",
                "description": "检测客户端JavaScript中不安全的DOM操作导致的DOM型XSS (CWE-79)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-79】检测DOM型XSS漏洞：检查是否存在客户端JavaScript中不安全的DOM操作将不可信来源(document.URL/location.hash/document.cookie/document.referrer)的数据写入DOM的情况。重点关注：element.innerHTML=可控数据；document.write(可控数据)；eval(可控数据)；所有DOM sink(source→sink数据流)的不安全模式",
                "fix_suggestion": "使用安全的DOM操作(textContent替代innerHTML)，对不可信来源数据做编码，使用DOMPurify净化HTML",
                "reference_url": "https://cwe.mitre.org/data/definitions/79.html",
                "code_patterns": {"javascript": ["document.write(location.$PROP)", "element.innerHTML = location.$PROP", "eval(location.$PROP)", "document.domain = $INPUT"]},
                "sort_order": 15,
            },
            {
                "rule_code": "SEC-XSS-004",
                "name": "模板引擎XSS - Jinja2/mark_safe/Django",
                "description": "检测服务端模板引擎中手动关闭自动转义导致的XSS (CWE-79)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-79】检测模板引擎XSS漏洞：检查是否存在在模板引擎中手动关闭自动转义或使用mark_safe等危险标记的情况。重点关注：Jinja2的{%autoescape False%}/|safe过滤器；Django的mark_safe()；Mako模板默认无自动转义；Thymeleaf的utext/unescaped；Freemarker的escape关闭；所有模板中将不可信数据标记为安全的模式",
                "fix_suggestion": "保持模板引擎自动转义开启，不使用|safe/mark_safe等标记处理不可信数据",
                "reference_url": "https://cwe.mitre.org/data/definitions/79.html",
                "code_patterns": {"python": ["$Template(..., autoescape=False)", "render_template_string($INPUT)", "|safe", "mark_safe($INPUT)"], "java": ["$Template.process($INPUT)", "$FMPL.process($DATA, $WRITER)"]},
                "sort_order": 16,
            },
            {
                "rule_code": "SEC-XSS-005",
                "name": "前端框架XSS - dangerouslySetInnerHTML/innerHTML",
                "description": "检测React/Vue等前端框架中的不安全HTML渲染 (CWE-79)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-79】检测前端框架XSS漏洞：检查是否存在在React/Vue/Angular等前端框架中使用不安全方式渲染HTML的情况。重点关注：React的dangerouslySetInnerHTML={{__html:可控数据}}；Vue的v-html指令；Angular的[innerHtml]绑定；Svelte的{@html}；jQuery的.html(可控数据)；所有前端框架中绕过框架默认转义直接渲染HTML的模式",
                "fix_suggestion": "避免使用dangerouslySetInnerHTML/v-html等不安全渲染方式；必须渲染HTML时先用DOMPurify净化",
                "reference_url": "https://cwe.mitre.org/data/definitions/79.html",
                "code_patterns": {"javascript": ["dangerouslySetInnerHTML={{__html: $INPUT}}", "element.innerHTML = $INPUT", "$VNode.vhtml = $INPUT"], "typescript": ["dangerouslySetInnerHTML={{__html: $INPUT}}", "element.innerHTML = $INPUT as $TYPE"]},
                "sort_order": 17,
            },
            {
                "rule_code": "SEC-XSS-006",
                "name": "URL重定向/开放重定向",
                "description": "检测未验证的用户可控URL重定向 (CWE-601)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-601】检测开放重定向漏洞：检查是否存在将用户可控的URL参数直接用于重定向的情况。重点关注：Java的response.sendRedirect(request.getParameter('url'))；Python的redirect(request.args.get('next'))；PHP的header('Location: '.$_GET['url'])；所有redirect/redirectToRoute使用未验证URL参数的模式",
                "fix_suggestion": "对重定向URL做白名单校验(只允许本站路径或指定域名)，使用相对路径而非绝对URL",
                "reference_url": "https://cwe.mitre.org/data/definitions/601.html",
                "code_patterns": {"python": ["redirect($INPUT)", "HttpResponseRedirect($INPUT)", "flask.redirect($INPUT)"], "java": ["response.sendRedirect($INPUT)", "$HTTPServletResponse.sendRedirect($INPUT)"], "php": ["header(\"Location: \" . $INPUT)", "redirect($INPUT)"], "go": ["http.Redirect($RESP, $REQ, $INPUT, $CODE)", "c.Redirect($CODE, $INPUT)"]},
                "sort_order": 18,
            },
            # =================== 认证安全类 ===================
            {
                "rule_code": "SEC-AUTH-001",
                "name": "弱密码策略 - 缺少密码复杂度要求",
                "description": "检测密码复杂度要求缺失或过弱 (CWE-521)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-521】检测弱密码策略：检查是否存在密码复杂度要求过弱或缺失的情况。重点关注：密码只要求最小长度无复杂度要求；允许纯数字/纯字母密码；无密码长度上限(导致DoS)；密码验证规则过于简单；注册/修改密码时未检查密码强度",
                "fix_suggestion": "实施强密码策略：最少8位+大小写+数字+特殊字符，使用zxcvbn等密码强度检查库，禁止常见弱密码",
                "reference_url": "https://cwe.mitre.org/data/definitions/521.html",
                "code_patterns": {"python": ["$VALIDATOR.accept($PASSWORD)", "len($PASSWORD) < $MIN", "$PASSWORD.match($WEAK_REGEX)"], "java": ["$PASSWORD.matches($WEAK_REGEX)", "$PASSWORD.length() < $MIN", "$VALIDATOR.validate($PASSWORD)"]},
                "sort_order": 19,
            },
            {
                "rule_code": "SEC-AUTH-002",
                "name": "会话固定攻击 - 登录后未更新会话ID",
                "description": "检测登录成功后未重新生成会话ID导致的会话固定攻击 (CWE-384)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-384】检测会话固定攻击漏洞：检查是否存在用户登录成功后未重新生成会话ID(session token)的情况。重点关注：登录认证成功后未调用session.regenerateId()/request.changeSessionId()；会话cookie在登录前后保持不变；URL中传递session ID(jsessionid/PHPSESSID)；登出后未销毁session",
                "fix_suggestion": "登录成功后必须重新生成session ID，登出时完全销毁session，禁止URL传递session ID",
                "reference_url": "https://cwe.mitre.org/data/definitions/384.html",
                "code_patterns": {"python": ["session[\"user\"] = $USER", "django_login(request, $USER)"], "java": ["$SESSION.setAttribute(\"user\", $VAL)", "$REQUEST.getSession()"], "php": ["session_id($INPUT)", "session_regenerate_id(False)", "$_SESSION[$KEY] = $VAL"]},
                "sort_order": 20,
            },
            {
                "rule_code": "SEC-AUTH-003",
                "name": "凭证硬编码 - 密码/密钥硬编码在源码中",
                "description": "检测密码/API密钥等凭证硬编码在源代码或配置文件中 (CWE-798)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-798】检测凭证硬编码漏洞：检查是否存在密码/API密钥/token/secret等敏感凭证硬编码在源代码或配置文件中的情况。重点关注：Java的setPassword(\"...\")/spring.datasource.password=明文；Python的password=\"xxx\"/api_key=\"xxx\"；JS的const SECRET=\"xxx\"；Go的const apiKey=\"xxx\"；所有password/secret/token/key=硬编码字符串的模式；.env文件/.properties文件中的明文密码",
                "fix_suggestion": "将所有敏感凭证迁移到环境变量/密钥管理系统(Vault/KMS)/加密配置，禁止在源码中硬编码",
                "reference_url": "https://cwe.mitre.org/data/definitions/798.html",
                "code_patterns": {"python": ["$PASSWORD = \"$STR\"", "$API_KEY = \"$STR\"", "$SECRET = \"$STR\"", "SECRET_KEY = \"$STR\""], "java": ["String $PASSWORD = \"$STR\"", "String $API_KEY = \"$STR\"", "SecretKeySpec($BYTES, $ALGO)"], "javascript": ["const $PASSWORD = \"$STR\"", "const $API_KEY = \"$STR\"", "const $SECRET = \"$STR\""], "go": ["$PASSWORD := \"$STR\"", "const $SECRET = \"$STR\"", "ApiKey: \"$STR\""]},
                "sort_order": 21,
            },
            {
                "rule_code": "SEC-AUTH-004",
                "name": "缺少多因素认证 - 高风险操作仅依赖单因素",
                "description": "检测高风险操作仅依赖单因素认证 (CWE-308)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-308】检测缺少多因素认证(MFA)问题：检查是否存在高风险操作(资金操作/敏感数据修改/管理员操作)仅依赖单因素(密码)认证的情况。重点关注：关键业务操作仅验证密码；管理员登录无MFA；密码重置流程仅验证邮箱(单因素)；缺少二次验证机制",
                "fix_suggestion": "对高风险操作实施多因素认证(MFA)，使用TOTP/短信/硬件密钥等二次验证",
                "reference_url": "https://cwe.mitre.org/data/definitions/308.html",
                "sort_order": 22,
            },
            {
                "rule_code": "SEC-AUTH-005",
                "name": "暴力破解防护缺失 - 缺少速率限制和账户锁定",
                "description": "检测登录等认证接口缺少速率限制和账户锁定机制 (CWE-307)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-307】检测暴力破解防护缺失：检查是否存在登录/注册等认证接口缺少速率限制(rate limiting)和账户锁定机制的情况。重点关注：登录接口无IP/账户级别的频率限制；无登录失败次数锁定；无验证码(CAPTCHA)防自动化攻击；密码重置接口无频率限制；API认证接口无速率限制",
                "fix_suggestion": "实施多维度速率限制(IP+账户)、渐进式账户锁定、验证码(CAPTCHA)防自动化",
                "reference_url": "https://cwe.mitre.org/data/definitions/307.html",
                "code_patterns": {"python": ["@app.route('/login', methods=['POST'])", "Flask(__name__)", "$CLIENT.post($URL)"], "java": ["@PostMapping(\"/login\")", "@RequestMapping(value = \"/login\")", "ServletRequest $REQ"], "javascript": ["app.post($PATH, $FUNC)", "router.post($PATH, $FUNC)", "axios.post($URL, $DATA)"]},
                "sort_order": 23,
            },
            {
                "rule_code": "SEC-AUTH-006",
                "name": "不安全的密码存储 - 明文或弱哈希存储密码",
                "description": "检测密码使用明文或弱哈希(MD5/SHA1)存储 (CWE-259)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-259】检测不安全的密码存储：检查是否存在密码使用明文存储或使用弱哈希(MD5/SHA1)加盐不足的情况。重点关注：数据库中密码字段为明文；使用MD5/SHA1/SHA256(无盐)哈希密码；密码哈希使用固定盐/短盐；未使用bcrypt/scrypt/Argon2等专用密码哈希算法；自定义密码哈希实现",
                "fix_suggestion": "使用bcrypt/Argon2id/scrypt等专用密码哈希算法，使用随机盐，工作因子≥10",
                "reference_url": "https://cwe.mitre.org/data/definitions/259.html",
                "code_patterns": {"python": ["hashlib.md5($PASSWORD)", "hashlib.sha1($PASSWORD)", "base64.b64encode($PASSWORD)"], "java": ["MD5($PASSWORD)", "SHA1($PASSWORD)", "MessageDigest.getInstance(\"MD5\")", "NoOpPasswordEncoder"], "javascript": ["crypto.createHash('md5').update($PWD)", "crypto.createHash('sha1').update($PWD)", "btoa($PASSWORD)"]},
                "sort_order": 24,
            },
            {
                "rule_code": "SEC-AUTH-007",
                "name": "JWT安全配置问题 - 算法混淆/密钥弱/无验证",
                "description": "检测JWT配置安全问题：算法混淆、密钥过弱、签名验证缺失 (CWE-327)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-327】检测JWT安全配置问题：检查是否存在JWT配置不当导致的安全风险。重点关注：JWT算法混淆攻击(alg:none/RS256→HS256切换)；JWT密钥过弱或硬编码；未验证JWT签名直接信任payload；JWT过期时间过长/无过期；敏感信息放入JWT payload(未加密)；JWT无audience/issuer验证",
                "fix_suggestion": "严格指定JWT算法(禁用none)、使用强密钥(≥256位)、始终验证签名、设置合理过期时间",
                "reference_url": "https://cwe.mitre.org/data/definitions/327.html",
                "code_patterns": {"python": ["jwt.encode($PAYLOAD, $KEY, algorithm=\"none\")", "jwt.decode($TOKEN, options={\"verify_signature\": False})", "jwt.encode($PAYLOAD, $WEAK_KEY)"], "java": ["$JWTBuilder.signWith(Algorithm.none())", "Algorithm.none()", "$JWTParser.parse($TOKEN)"], "javascript": ["jwt.verify($TOKEN, $SECRET, {algorithms: [\"none\"]})", "jwt.sign($PAYLOAD, $SECRET, {algorithm: \"none\"})", "jwt.decode($TOKEN)"]},
                "sort_order": 25,
            },
            {
                "rule_code": "SEC-AUTH-008",
                "name": "OAuth/token安全问题 - token泄露/重放",
                "description": "检测OAuth/token实现中的安全问题 (CWE-287)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-287】检测OAuth/Token安全问题：检查是否存在OAuth实现或token管理中的安全风险。重点关注：access_token通过URL参数传递(而非Authorization header)；token无过期时间或过期时间过长；refresh_token存储不安全；OAuth state参数未验证(CSRF)；implicit flow使用(token暴露在URL)；token未绑定client_id；缺少token撤销机制",
                "fix_suggestion": "使用Authorization Code Flow+PKCE、token通过header传递、实施token过期和撤销机制、验证state参数",
                "reference_url": "https://cwe.mitre.org/data/definitions/287.html",
                "code_patterns": {"python": ["$OAUTH.get_token($CODE)", "$TOKEN = $REQUEST.args.get(\"access_token\")", "$CLIENT.authorize($CODE)"], "java": ["$OAUTH.getAccessToken($CODE)", "$TOKENVALIDATOR.validate($TOKEN)", "$BEARERTOKEN = $REQUEST.getParameter(\"token\")"], "javascript": ["$OAUTH.getAccessToken($CODE)", "$TOKEN = $REQ.query.access_token", "$CONFIG.clientSecret = \"$STR\""]},
                "sort_order": 26,
            },
            # =================== 授权与访问控制类 ===================
            {
                "rule_code": "SEC-AC-001",
                "name": "IDOR - 不安全的直接对象引用",
                "description": "检测通过直接引用对象ID绕过访问控制 (CWE-639)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-639】检测IDOR(不安全的直接对象引用)漏洞：检查是否存在通过直接引用对象ID(数字ID/文件名/UUID)访问资源而未做权限验证的情况。重点关注：API接口使用userId/orderId/fileId等参数但未验证当前用户是否有权访问该资源；/api/users/123可访问任意用户数据；/api/files?name=xxx可访问任意文件；修改ID参数可遍历其他用户资源",
                "fix_suggestion": "在服务端对每个资源访问做权限验证(当前用户是否拥有该资源)，使用间接引用映射",
                "reference_url": "https://cwe.mitre.org/data/definitions/639.html",
                "code_patterns": {"python": ["User.objects.get(id=request.args.get($ID))", "$MODEL.objects.get(pk=$REQUEST.$PARAM.get($ID))", "request.json.get($ID)"], "java": ["$DAO.findById(request.getParameter($ID))", "$REPO.findById(Long.parseLong(request.getParameter($ID)))", "Integer.parseInt(request.getParameter($ID))"], "javascript": ["$MODEL.findById(req.params.$ID)", "$MODEL.findOne({ _id: req.params.$ID })", "req.params.$ID"]},
                "sort_order": 27,
            },
            {
                "rule_code": "SEC-AC-002",
                "name": "权限提升 - 水平/垂直越权",
                "description": "检测权限提升漏洞(水平越权访问同级用户/垂直越权获取高级权限) (CWE-269)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-269】检测权限提升漏洞：检查是否存在水平越权(普通用户A访问用户B的数据)或垂直越权(普通用户获取管理员权限)的情况。重点关注：角色/权限检查缺失或不完整；客户端可控的role/is_admin参数被服务端直接信任；权限校验仅在客户端执行(服务端未验证)；管理员功能缺少独立的权限校验；仅检查认证(authentication)未检查授权(authorization)",
                "fix_suggestion": "在服务端对每个操作做细粒度授权校验(功能级+数据级)，禁止信任客户端传递的权限参数",
                "reference_url": "https://cwe.mitre.org/data/definitions/269.html",
                "code_patterns": {"python": ["user.is_admin = True", "$USER.role = 'admin'", "setattr($USER, 'is_superuser', True)"], "java": ["$USER.setRole(\"ADMIN\")", "$USER.setAdmin(true)", "$PRINCIPAL.addRole(\"ROLE_ADMIN\")"], "javascript": ["user.role = 'admin'", "user.isAdmin = true", "$USER.update({ role: 'admin' })"]},
                "sort_order": 28,
            },
            {
                "rule_code": "SEC-AC-003",
                "name": "缺少功能级访问控制 - API端点未做权限校验",
                "description": "检测API端点或功能缺少权限校验 (CWE-285)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-285】检测缺少功能级访问控制：检查是否存在API端点/Controller/路由缺少权限校验的情况。重点关注：Spring的@RequestMapping未配置权限注解(@PreAuthorize等)；Django的view未使用@login_required/@permission_required；Flask路由未做权限检查；REST API未限制匿名访问；管理端点(Spring Actuator/JAX-RS)未配置访问控制",
                "fix_suggestion": "对所有API端点配置适当的权限校验注解/中间件，默认拒绝无权限的访问",
                "reference_url": "https://cwe.mitre.org/data/definitions/285.html",
                "code_patterns": {"java": ["@GetMapping($PATH)", "@PostMapping($PATH)", "@RequestMapping(value = $PATH)"], "python": ["@app.route($PATH)", "@router.get($PATH)", "@router.post($PATH)", "def $FUNC(request, ...)"]},
                "sort_order": 29,
            },
            {
                "rule_code": "SEC-AC-004",
                "name": "CORS配置错误 - 过宽松的跨域策略",
                "description": "检测CORS配置过于宽松导致跨域攻击 (CWE-942)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-942】检测CORS配置错误：检查是否存在CORS(Cross-Origin Resource Sharing)配置过于宽松的情况。重点关注：Access-Control-Allow-Origin设置为*或动态反射请求Origin；Access-Control-Allow-Credentials:true配合Allow-Origin:*；Access-Control-Allow-Methods/Headers过于宽松；CORS配置允许任意域携带凭证访问敏感API",
                "fix_suggestion": "CORS Allow-Origin只允许指定的可信域名列表，Allow-Credentials与Allow-Origin:*不能同时使用",
                "reference_url": "https://cwe.mitre.org/data/definitions/942.html",
                "code_patterns": {"python": ["CORS(app, origins=\"*\")", "@cross_origin(origins=\"*\")", "response.headers[\"Access-Control-Allow-Origin\"] = \"*\""], "java": ["@CrossOrigin(origins = \"*\")", "config.addAllowedOrigin(\"*\")", "corsConfiguration.addAllowedOrigin(\"*\")"], "javascript": ["app.use(cors({ origin: '*' }))", "res.setHeader('Access-Control-Allow-Origin', '*')", "cors({ credentials: true, origin: '*' })"]},
                "sort_order": 30,
            },
            {
                "rule_code": "SEC-AC-005",
                "name": "强制浏览/未授权API暴露",
                "description": "检测通过直接访问URL/API路径绕过权限 (CWE-425)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-425】检测强制浏览/未授权API暴露漏洞：检查是否存在通过直接访问URL路径即可访问受限功能/数据的情况。重点关注：管理页面(/admin)仅靠前端隐藏不做服务端权限校验；API端点(/api/internal/xxx)无认证即可访问；调试/测试接口未在生产环境关闭；Swagger/API文档在生产环境暴露；备份文件/配置文件可通过URL直接下载",
                "fix_suggestion": "所有受限资源在服务端做权限校验(不依赖前端隐藏)，生产环境关闭调试/测试接口",
                "reference_url": "https://cwe.mitre.org/data/definitions/425.html",
                "code_patterns": {"java": ["response.sendRedirect($URL)", "request.getRequestDispatcher($PATH).forward(request, response)", "Files.readAllBytes(Paths.get(request.getParameter($NAME)))"], "python": ["open(request.args.get($NAME))", "os.path.join($BASE, request.args.get($NAME))", "send_file(request.args.get($PATH))"]},
                "sort_order": 31,
            },
            {
                "rule_code": "SEC-AC-006",
                "name": "信任边界违规 - 未验证数据跨越信任边界",
                "description": "检测数据跨越信任边界时缺少验证 (CWE-501)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-501】检测信任边界违规：检查是否存在数据从不可信来源(外部输入)进入可信区域(内部处理)时缺少验证的情况。重点关注：外部API返回数据被直接信任使用；微服务间调用缺少认证；数据库中数据被无条件信任(二次注入场景)；第三方组件回调数据未验证；跨模块数据传递缺少输入校验",
                "fix_suggestion": "在信任边界处对数据做完整的输入验证和认证，不无条件信任任何外部数据来源",
                "reference_url": "https://cwe.mitre.org/data/definitions/501.html",
                "sort_order": 32,
            },
            # =================== 加密与数据保护类 ===================
            {
                "rule_code": "SEC-CRYP-001",
                "name": "弱哈希算法 - MD5/SHA1用于安全场景",
                "description": "检测使用MD5/SHA1等弱哈希算法用于密码/签名等安全场景 (CWE-328)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-328】检测弱哈希算法使用：检查是否存在使用MD5/SHA1等弱哈希算法用于安全相关场景的情况。重点关注：Java的MessageDigest.getInstance(\"MD5\"/\"SHA1\")；Python的hashlib.md5()/sha1()用于密码/签名；C/C++的MD5_Init/SHA1_Init；所有语言中使用MD5/SHA1用于密码存储/数据完整性验证/数字签名；MD5碰撞攻击风险",
                "fix_suggestion": "密码存储使用bcrypt/Argon2；数据完整性使用SHA-256+；数字签名使用SHA-256+RSA",
                "reference_url": "https://cwe.mitre.org/data/definitions/328.html",
                "code_patterns": {"python": ["hashlib.md5($DATA)", "hashlib.sha1($DATA)", "hashlib.new('md5', $DATA)", "hmac.new($KEY, $DATA, hashlib.md5)"], "java": ["MessageDigest.getInstance(\"MD5\")", "MessageDigest.getInstance(\"SHA-1\")", "DigestUtils.md5($DATA)", "DigestUtils.sha1($DATA)"], "c": ["MD5_Init($CTX)", "SHA1_Init($CTX)", "EVP_DigestInit_ex($CTX, EVP_md5(), $ENGINE)"]},
                "sort_order": 33,
            },
            {
                "rule_code": "SEC-CRYP-002",
                "name": "弱加密算法 - DES/RC4/ECB模式",
                "description": "检测使用DES/RC4等弱加密算法或ECB模式 (CWE-327)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-327】检测弱加密算法使用：检查是否存在使用DES/RC4/Blowfish/ECB等弱加密算法或模式的情况。重点关注：Java的Cipher.getInstance(\"DES\"/\"RC4\"/\"Blowfish\")；DESKeySpec的使用；ECB加密模式(相同明文→相同密文)；Python的Crypto.Cipher.DES/Blowfish；C/C++的DES_set_key/RC4_set_key；所有使用不安全加密算法或ECB模式的场景",
                "fix_suggestion": "使用AES-256-GCM替代DES/RC4/Blowfish，禁止ECB模式，使用CBC/GCM等带认证的模式",
                "reference_url": "https://cwe.mitre.org/data/definitions/327.html",
                "code_patterns": {"python": ["DES.new($KEY, DES.MODE_ECB)", "AES.new($KEY, AES.MODE_ECB)", "ARC4.new($KEY)", "Blowfish.new($KEY, Blowfish.MODE_ECB)"], "java": ["Cipher.getInstance(\"DES\")", "Cipher.getInstance(\"DES/ECB/PKCS5Padding\")", "Cipher.getInstance(\"Blowfish\")", "Cipher.getInstance(\"RC4\")", "Cipher.getInstance(\"AES/ECB/PKCS5Padding\")"]},
                "sort_order": 34,
            },
            {
                "rule_code": "SEC-CRYP-003",
                "name": "硬编码密钥 - 加密密钥硬编码在源码中",
                "description": "检测加密密钥硬编码在源代码或配置中 (CWE-321)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-321】检测硬编码密钥漏洞：检查是否存在加密密钥(HMAC key/AES key/RSA private key)硬编码在源代码中的情况。重点关注：Java的HARD_CODE_KEY(SecretKeySpec/setKey)；Python的key=\"xxx\"/SECRET_KEY=\"xxx\"；所有硬编码加密密钥/签名密钥的场景；密钥在.properties/.env中明文存储",
                "fix_suggestion": "密钥存储在密钥管理系统(Vault/KMS)，通过环境变量或安全配置注入，禁止硬编码",
                "reference_url": "https://cwe.mitre.org/data/definitions/321.html",
                "code_patterns": {"python": ["SECRET_KEY = \"$STR\"", "API_KEY = \"$STR\"", "password = \"$STR\"", "TOKEN = \"$STR\""], "java": ["String $PASSWORD = \"$STR\"", "SecretKeySpec($BYTES, $ALGO)", "private static final String $KEY = \"$STR\""], "javascript": ["const $PASSWORD = '$STR'", "const API_KEY = '$STR'", "const SECRET = '$STR'"], "go": ["const $SECRET = \"$STR\"", "$PASSWORD := \"$STR\"", "ApiKey: \"$STR\""]},
                "sort_order": 35,
            },
            {
                "rule_code": "SEC-CRYP-004",
                "name": "不安全的随机数 - 使用非密码学安全PRNG",
                "description": "检测安全场景使用非密码学安全随机数生成器 (CWE-330)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-330】检测不安全的随机数使用：检查是否存在在安全相关场景(生成token/密码/会话ID/挑战码)中使用非密码学安全随机数生成器的情况。重点关注：Python的random模块(非secrets模块)；Java的java.util.Random而非SecureRandom；JavaScript的Math.random()；C的rand()/ srand()；PHP的rand()/mt_rand()；所有在安全场景使用非CSPRNG的模式；Go的math/rand而非crypto/rand",
                "fix_suggestion": "安全场景必须使用密码学安全随机数生成器：Python的secrets/Java的SecureRandom/Go的crypto/rand",
                "reference_url": "https://cwe.mitre.org/data/definitions/330.html",
                "code_patterns": {"python": ["random.randint($A, $B)", "random.choice($SEQ)", "random.random()", "random.seed($VAL)"], "java": ["new java.util.Random()", "new Random()", "Math.random()", "Random.nextInt($B)"], "javascript": ["Math.random()", "Math.floor(Math.random() * $N)", "crypto.pseudoRandomBytes($N)"], "go": ["math/rand.New($SRC)", "rand.Int()", "rand.Intn($N)", "rand.Seed($VAL)"]},
                "sort_order": 36,
            },
            {
                "rule_code": "SEC-CRYP-005",
                "name": "密钥管理不当 - 密钥轮换/分发/存储问题",
                "description": "检测密钥管理流程不当(无轮换/不安全存储/分发) (CWE-320)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-320】检测密钥管理不当：检查是否存在密钥管理流程缺陷的情况。重点关注：密钥从不轮换(长期使用同一密钥)；密钥与数据存储在同一位置；密钥分发通过不安全渠道(邮件/聊天)；密钥生成强度不足；密钥撤销机制缺失；多环境(dev/prod)共用同一密钥",
                "fix_suggestion": "实施密钥轮换策略、密钥与数据分离存储、使用密钥管理系统(KMS/Vault)、独立的环境密钥",
                "reference_url": "https://cwe.mitre.org/data/definitions/320.html",
                "sort_order": 37,
            },
            {
                "rule_code": "SEC-CRYP-006",
                "name": "SSL/TLS配置错误 - 证书验证缺失/弱协议",
                "description": "检测SSL/TLS配置错误导致中间人攻击 (CWE-295)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-295】检测SSL/TLS配置错误：检查是否存在SSL/TLS证书验证被禁用或使用弱协议的情况。重点关注：Python的requests.get(url, verify=False)；Java的WEAK_TRUST_MANAGER/WEAK_HOSTNAME_VERIFIER(自定义信任管理器接受所有证书)；SSLv3/TLS1.0/TLS1.1协议使用；curl的-k/insecure选项；所有禁用证书验证或使用弱TLS协议的模式",
                "fix_suggestion": "始终启用SSL证书验证，使用TLS1.2+，禁止自定义TrustManager接受所有证书",
                "reference_url": "https://cwe.mitre.org/data/definitions/295.html",
                "code_patterns": {"python": ["ssl._create_unverified_context()", "requests.get($URL, verify=False)", "urllib.request.urlopen($URL, context=ssl._create_unverified_context())"], "java": ["TrustManager[] $TM = new TrustManager[]{new X509TrustManager(){ ... }}", "hostnameVerifier = ($HOSTNAME, $SESSION) -> true", "SSLContext.getInstance(\"SSL\")"], "javascript": ["rejectUnauthorized: false", "process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'", "new https.Agent({ rejectUnauthorized: false })"], "go": ["tls.Config{InsecureSkipVerify: true}", "InsecureSkipVerify: true", "http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}"]},
                "sort_order": 38,
            },
            {
                "rule_code": "SEC-CRYP-007",
                "name": "RSA密钥过短 - 密钥长度不足",
                "description": "检测RSA密钥长度小于2048位 (CWE-326)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-326】检测RSA密钥过短：检查是否存在使用RSA密钥长度不足(<2048位)的情况。重点关注：Java的RSA_KEY_SIZE(RSA 1024)；Python的RSA.generate(1024)；所有使用RSA 512/1024/1536位密钥的场景；DSA密钥<2048位；ECDSA曲线过弱(P-192)",
                "fix_suggestion": "RSA密钥使用2048位以上(推荐4096位)，DSA使用2048位以上，ECDSA使用P-256以上曲线",
                "reference_url": "https://cwe.mitre.org/data/definitions/326.html",
                "code_patterns": {"java": ["KeyPairGenerator.getInstance(\"RSA\").initialize(512)", "KeyPairGenerator.getInstance(\"RSA\").initialize(1024)", "RSAKeyGenParameterSpec($N, $EXP)"], "python": ["RSA.generate(512, ...)", "RSA.generate(1024, ...)", "rsa.generate_private_key(public_exponent=$E, key_size=512)"]},
                "sort_order": 39,
            },
            {
                "rule_code": "SEC-CRYP-008",
                "name": "敏感数据明文传输/存储",
                "description": "检测敏感数据(密码/PII/金融数据)明文传输或存储 (CWE-312)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-312】检测敏感数据明文传输/存储：检查是否存在敏感数据(密码/个人隐私信息/金融数据/医疗数据)在传输或存储时未加密的情况。重点关注：HTTP(非HTTPS)传输敏感数据；数据库中敏感字段明文存储；日志中记录敏感数据；API响应中返回完整敏感数据(未脱敏)；Cookie中存储敏感信息未加密；文件中敏感数据明文存储",
                "fix_suggestion": "传输使用TLS加密、存储使用字段级加密/脱敏、日志中禁止记录敏感数据、API响应做数据脱敏",
                "reference_url": "https://cwe.mitre.org/data/definitions/312.html",
                "code_patterns": {"python": ["open($PATH, 'w').write($PASSWORD)", "json.dump({'password': $PASS}, open($PATH, 'w'))", "logging.info($PASSWORD)"], "java": ["System.out.println($PASSWORD)", "FileWriter.write($SENSITIVE)", "Files.writeString($PATH, $SENSITIVE)"]},
                "sort_order": 40,
            },
            # =================== 反序列化与数据完整性类 ===================
            {
                "rule_code": "SEC-DESER-001",
                "name": "不安全的Java反序列化 - ObjectInputStream未限制",
                "description": "检测Java反序列化未做类型限制导致RCE (CWE-502)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-502】检测Java不安全反序列化漏洞：检查是否存在使用ObjectInputStream反序列化不可信数据且未做类型白名单限制的情况。重点关注：ObjectInputStream.readObject()反序列化网络/文件输入未使用ObjectInputFilter；Jackson/fastjson的autoType默认开启；XStream反序列化未限制类型；所有Java反序列化入口未做类型过滤的模式",
                "fix_suggestion": "使用ObjectInputFilter做类型白名单过滤、关闭Jackson/fastjson的autoType、避免反序列化不可信数据",
                "reference_url": "https://cwe.mitre.org/data/definitions/502.html",
                "code_patterns": {"java": ["new ObjectInputStream($STREAM)", "$OIS.readObject()", "$OIS.readUnshared()", "ObjectMapper.enableDefaultTyping()", "@JsonTypeInfo(use=Id.CLASS)", "ParserConfig.getGlobalInstance().setAutoTypeSupport(true)"]},
                "sort_order": 41,
            },
            {
                "rule_code": "SEC-DESER-002",
                "name": "不安全的Python pickle/yaml反序列化",
                "description": "检测Python中使用pickle/yaml.load反序列化不可信数据 (CWE-502)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-502】检测Python不安全反序列化漏洞：检查是否存在使用pickle.loads()/yaml.load()/marshal.loads()反序列化不可信数据的情况。重点关注：pickle.loads()/pickle.load()反序列化网络/文件数据(可执行任意代码)；yaml.load()而非yaml.safe_load()(允许任意Python对象创建)；marshal.loads()反序列化不可信数据；shelve模块的使用",
                "fix_suggestion": "禁止pickle反序列化不可信数据，使用yaml.safe_load()替代yaml.load()，使用JSON等安全序列化格式",
                "reference_url": "https://cwe.mitre.org/data/definitions/502.html",
                "code_patterns": {"python": ["pickle.loads($DATA)", "pickle.load($FILE)", "cPickle.loads($DATA)", "yaml.load($DATA)", "marshal.loads($DATA)"]},
                "sort_order": 42,
            },
            {
                "rule_code": "SEC-DESER-003",
                "name": "不安全的PHP反序列化 - unserialize魔术方法",
                "description": "检测PHP中使用unserialize()反序列化不可信数据 (CWE-502)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-502】检测PHP不安全反序列化漏洞：检查是否存在使用unserialize()反序列化不可信数据的情况。重点关注：unserialize()反序列化用户输入/cookie数据/数据库中不可信数据；类中__wakeup()/__destruct()魔术方法可被利用执行任意代码；phar反序列化漏洞(phar://伪协议)",
                "fix_suggestion": "禁止unserialize()处理不可信数据，使用JSON序列化替代，使用allowed_classes限制反序列化类型",
                "reference_url": "https://cwe.mitre.org/data/definitions/502.html",
                "code_patterns": {"php": ["unserialize($DATA)", "unserialize($_GET[$KEY])", "unserialize($_POST[$KEY])", "unserialize($_COOKIE[$KEY])", "unserialize(file_get_contents($PATH))"]},
                "sort_order": 43,
            },
            {
                "rule_code": "SEC-DESER-004",
                "name": "XML外部实体攻击(XXE) - XML解析器未禁用外部实体",
                "description": "检测XML解析器未禁用外部实体引用导致XXE攻击 (CWE-611)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-611】检测XXE(XML外部实体)攻击漏洞：检查是否存在XML解析器未禁用外部实体引用的情况。重点关注：Java的SAXParser/DocumentBuilder/XMLReader未设置disallow-doctype-decl或FEATURE_SECURE_PROCESSING；Python的lxml/defusedxml解析未禁用外部实体；所有XML解析器未禁用DOCTYPE和外部实体引用的模式；XML文件上传后直接解析；SOAP/WSDL解析未做XXE防护",
                "fix_suggestion": "所有XML解析器禁用外部实体引用和DOCTYPE，使用defusedxml等安全解析库",
                "reference_url": "https://cwe.mitre.org/data/definitions/611.html",
                "code_patterns": {"java": ["DocumentBuilderFactory.newInstance()", "SAXParserFactory.newInstance()", "XMLInputFactory.newInstance()", "TransformerFactory.newInstance()"], "python": ["xml.sax.parse($PATH, $HANDLER)", "lxml.etree.parse($PATH)", "lxml.etree.fromstring($DATA)", "xml.etree.ElementTree.parse($PATH)"]},
                "sort_order": 44,
            },
            # =================== SSRF与路径遍历类 ===================
            {
                "rule_code": "SEC-SSRF-001",
                "name": "基础SSRF - 用户可控URL发起服务端请求",
                "description": "检测服务端使用用户可控URL发起HTTP请求 (CWE-918)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-918】检测SSRF(服务端请求伪造)漏洞：检查是否存在服务端使用用户可控的URL发起HTTP请求的情况。重点关注：Java的new URL(request.getParameter())/RestTemplate.getForObject(url)/HttpClient请求动态URL；Python的requests.get(url)/urllib.request.urlopen(url)；Go的http.Get(url)；PHP的file_get_contents(url)；所有从用户输入构造URL发起服务端请求的模式",
                "fix_suggestion": "对URL做白名单校验(只允许指定域名和协议)，禁止请求内网IP/云元数据，使用URL解析验证",
                "reference_url": "https://cwe.mitre.org/data/definitions/918.html",
                "code_patterns": {"python": ["requests.get($URL)", "requests.post($URL, $DATA)", "urllib.request.urlopen($URL)", "httpx.get($URL)"], "java": ["new URL($URL).openConnection()", "RestTemplate.getForObject($URL, $CLASS)", "HttpClient.newHttpClient().send($REQ, $BODY)"], "go": ["http.Get($URL)", "http.Post($URL, $TYPE, $BODY)", "http.NewRequest($METHOD, $URL, $BODY)"], "php": ["file_get_contents($URL)", "curl_exec($CH)", "fopen($URL, $MODE)"]},
                "sort_order": 45,
            },
            {
                "rule_code": "SEC-SSRF-002",
                "name": "Blind SSRF - 服务端请求无回显",
                "description": "检测Blind SSRF(服务端发起请求但无响应回显) (CWE-918)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-918】检测Blind SSRF漏洞：检查是否存在服务端发起HTTP请求但响应不直接返回给用户(Blind SSRF)的情况。重点关注：Webhook回调URL由用户配置(服务端发起请求不返回响应)；URL预览/缩略图生成功能；邮件发送中的URL追踪链接；内部服务间调用使用用户可控URL；DNS重绑定攻击场景",
                "fix_suggestion": "对所有用户可控URL做白名单校验(包括Webhook/回调URL)，限制可请求的目标范围",
                "reference_url": "https://cwe.mitre.org/data/definitions/918.html",
                "code_patterns": {"python": ["requests.get($URL)", "urllib.request.urlopen($URL)", "socket.create_connection(($HOST, $PORT))"], "java": ["InetAddress.getByName($HOST)", "new Socket($HOST, $PORT)", "URL $U = new URL($URL)"]},
                "sort_order": 46,
            },
            {
                "rule_code": "SEC-PATH-001",
                "name": "本地路径遍历 - 文件路径拼接外部输入",
                "description": "检测文件路径拼接不可信输入导致的路径遍历 (CWE-22)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-22】检测路径遍历漏洞：检查是否存在将不可信输入拼接到文件路径导致可访问任意目录的情况。重点关注：Java的new File(base + input)/Paths.get(base, input)/FileInputStream(request.getParameter)；Python的open(base + input)/os.path.join(base, input)；C/C++的fopen(path + input)；Go的os.Open(path + input)；PHP的include($_GET['file'])；所有使用../绕过目录限制的模式",
                "fix_suggestion": "对文件路径做归一化(realpath/normalize)和目录白名单校验，禁止路径中包含..",
                "reference_url": "https://cwe.mitre.org/data/definitions/22.html",
                "code_patterns": {"python": ["open($BASE + $INPUT)", "os.path.join($BASE, $INPUT)", "os.path.abspath($PATH)"], "java": ["new File($BASEDIR, $USERINPUT)", "new FileInputStream($PATH)", "Paths.get($PATH)"], "go": ["os.Open($PATH)", "filepath.Join($BASE, $INPUT)", "os.ReadFile($PATH)"], "php": ["include($PATH)", "fopen($PATH, $MODE)", "file_get_contents($PATH)", "include($_GET[$KEY])"], "c": ["fopen($PATH, $MODE)", "open($PATH, $FLAGS)", "stat($PATH, $BUF)"]},
                "sort_order": 47,
            },
            {
                "rule_code": "SEC-PATH-002",
                "name": "Zip Slip - 解压文件路径遍历",
                "description": "检测文件解压时未校验目标路径导致的Zip Slip攻击 (CWE-22)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-22】检测Zip Slip(解压路径遍历)漏洞：检查是否存在文件解压时未校验解压目标路径是否在预期目录内的情况。重点关注：Java的ZipInputStream/ZipFile解压未验证entry.getName()是否包含../；Python的zipfile/tarfile解压未校验成员路径；所有压缩文件解压(ZIP/TAR/GZ)时直接使用压缩包内的文件名作为目标路径而不做路径校验的模式",
                "fix_suggestion": "解压时验证每个成员的目标路径在预期目录内(使用realpath比较)，拒绝包含../的成员",
                "reference_url": "https://cwe.mitre.org/data/definitions/22.html",
                "code_patterns": {"python": ["zipfile.ZipFile($FILE).extractall($DIR)", "tarfile.open($MODE).extractall($DIR)"], "java": ["new ZipInputStream($STREAM); new File($DIR, $ENTRY.getName())", "new ZipFile($PATH); $ZIP.getInputStream($ENTRY)"]},
                "sort_order": 48,
            },
            {
                "rule_code": "SEC-PATH-003",
                "name": "文件上传安全 - 未限制文件类型/路径/大小",
                "description": "检测文件上传功能缺少安全限制 (CWE-434)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-434】检测文件上传安全漏洞：检查是否存在文件上传功能缺少安全限制的情况。重点关注：未校验上传文件类型(仅检查扩展名而非内容/MIME类型)；上传路径可被用户控制导致路径遍历；上传文件大小无限制导致DoS；上传文件可直接通过URL访问(未做权限控制)；上传文件名未做安全处理；上传目录可执行(上传PHP/JSP等可执行文件)",
                "fix_suggestion": "校验文件MIME类型+扩展名白名单、重命名上传文件、存储到不可通过URL直接访问的位置、限制文件大小",
                "reference_url": "https://cwe.mitre.org/data/definitions/434.html",
                "code_patterns": {"python": ["$REQUEST.files[$KEY].save($PATH)", "shutil.copy($TMP, $DEST)", "open($UPLOAD_PATH, 'wb').write($FILE_CONTENT)"], "java": ["new FileOutputStream($DEST)", "$PART.write($DEST)", "Files.copy($INPUT, $DEST)"], "javascript": ["fs.writeFile($PATH, $DATA)", "multer({dest: $PATH})", "$REQ.file.pipe(fs.createWriteStream($PATH))"]},
                "sort_order": 49,
            },
            # =================== CSRF与竞态条件类 ===================
            {
                "rule_code": "SEC-CSRF-001",
                "name": "CSRF防护缺失 - 关键操作缺少CSRF Token",
                "description": "检测关键状态变更操作缺少CSRF防护 (CWE-352)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-352】检测CSRF(跨站请求伪造)漏洞：检查是否存在关键状态变更操作(转账/修改密码/删除数据/修改设置)缺少CSRF Token防护的情况。重点关注：Spring的CSRF保护被禁用(@EnableWebSecurity中csrf().disable())；Django的CSRF中间件被跳过(@csrf_exempt)；所有POST/PUT/DELETE请求未验证CSRF Token的模式；仅依赖Cookie认证而无CSRF Token；SameSite Cookie设置缺失",
                "fix_suggestion": "所有状态变更操作使用CSRF Token验证、设置SameSite=Strict/Lax的Cookie属性",
                "reference_url": "https://cwe.mitre.org/data/definitions/352.html",
                "code_patterns": {"python": ["@csrf_exempt", "app.post($ROUTE, $FN)", "django.middleware.csrf.CsrfViewMiddleware"], "java": ["csrf().disable()", "@PostMapping($ROUTE)", "$FORM.action = $URL"]},
                "sort_order": 50,
            },
            {
                "rule_code": "SEC-RACE-001",
                "name": "竞态条件/TOCTOU - 检查与使用时间差",
                "description": "检测检查与使用之间的时间差(Time-of-Check to Time-of-Use)漏洞 (CWE-362)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-362】检测竞态条件/TOCTOU漏洞：检查是否存在先检查条件后执行操作但中间可被其他线程/进程修改的竞态条件。重点关注：文件access()检查后open()使用(中间文件可被替换)；数据库余额检查后扣款(中间可被并发修改)；临时文件mktemp()创建后使用(中间可被抢占)；所有check-then-act操作无原子性保证的模式；缺少锁/事务保护",
                "fix_suggestion": "使用原子操作替代check-then-act模式、使用数据库事务保证一致性、使用锁保护共享资源",
                "reference_url": "https://cwe.mitre.org/data/definitions/362.html",
                "sort_order": 51,
            },
            {
                "rule_code": "SEC-RACE-002",
                "name": "时间侧信道攻击 - 操作时间依赖秘密数据",
                "description": "检测操作执行时间依赖于秘密数据导致信息泄露 (CWE-208)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-208】检测时间侧信道攻击风险：检查是否存在操作执行时间依赖于秘密数据(密码/密钥)导致可通过时间差异推断秘密的情况。重点关注：字符串比较使用==而非恒定时间函数(hmac.compare_digest)；密码校验逐字符比较导致时间差异；RSA解密时间依赖于密钥内容；排序/搜索操作泄露数据特征",
                "fix_suggestion": "使用恒定时间比较函数(如hmac.compare_digest/Crypto.Util.Counter)，避免操作时间依赖秘密数据",
                "reference_url": "https://cwe.mitre.org/data/definitions/208.html",
                "sort_order": 52,
            },
            # =================== 信息泄露与配置类 ===================
            {
                "rule_code": "SEC-INFO-001",
                "name": "敏感信息泄露到日志 - 日志中记录密码/token等",
                "description": "检测敏感信息(密码/PII/token)被写入日志 (CWE-532)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-532】检测敏感信息泄露到日志：检查是否存在将密码/token/身份证号/银行卡号等敏感信息写入日志文件的情况。重点关注：登录日志中记录密码原文；API请求日志中记录Authorization头/token；异常堆栈中暴露敏感配置；调试日志中记录完整请求体(含敏感字段)；所有将敏感数据写入日志/console的模式",
                "fix_suggestion": "日志中脱敏处理敏感字段(替换为***或哈希)、禁止记录密码/token/PII、使用专门的审计日志",
                "reference_url": "https://cwe.mitre.org/data/definitions/532.html",
                "code_patterns": {"python": ["logging.info($MSG + $SECRET)", "logger.info(f\"...{password}\")", "print($SECRET)"], "java": ["log.info($MSG + $SECRET)", "logger.info(\"...{}\", $PASSWORD)", "System.out.println($SECRET)"]},
                "sort_order": 53,
            },
            {
                "rule_code": "SEC-INFO-002",
                "name": "详细错误信息暴露 - 堆栈/SQL错误返回客户端",
                "description": "检测详细错误信息(堆栈/SQL错误)返回给客户端 (CWE-209)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-209】检测详细错误信息暴露：检查是否存在将详细错误信息(堆栈跟踪/SQL错误/内部路径)返回给客户端的情况。重点关注：Spring的server.error.include-stacktrace=always；Django的DEBUG=True在生产环境；Python的traceback直接返回HTTP响应；所有将异常堆栈/SQL错误信息/内部文件路径暴露给用户的模式；500错误页面显示完整堆栈",
                "fix_suggestion": "生产环境返回通用错误消息、堆栈跟踪只记录到日志不返回客户端、设置DEBUG=False",
                "reference_url": "https://cwe.mitre.org/data/definitions/209.html",
                "code_patterns": {"python": ["return str($EXCEPTION)", "app.config['DEBUG'] = True", "except Exception as $E: return str($E)"], "java": ["$EX.printStackTrace()", "return ResponseEntity.status($CODE).body($EX.getMessage())", "server.error.include-stacktrace=always"]},
                "sort_order": 54,
            },
            {
                "rule_code": "SEC-INFO-003",
                "name": "源代码/调试信息泄露 - 生产环境暴露源码或调试接口",
                "description": "检测生产环境中源代码或调试接口可被访问 (CWE-497)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-497】检测源代码/调试信息泄露：检查是否存在生产环境中源代码或调试接口可被外部访问的情况。重点关注：.git/.svn/.env等配置目录可通过URL访问；Swagger/API文档在生产环境公开；Spring Actuator端点未限制访问；debug模式在生产环境开启(Flask debug=True)；源映射文件(.map)可被下载；测试接口未关闭",
                "fix_suggestion": "生产环境禁止访问.git/.env等目录、关闭Swagger/Actuator/debug模式、删除.map文件",
                "reference_url": "https://cwe.mitre.org/data/definitions/497.html",
                "code_patterns": {"python": ["app.config['DEBUG'] = True", "import traceback; traceback.print_exc()"], "java": ["e.printStackTrace()", "$APP.setDebug(true)"]},
                "sort_order": 55,
            },
            {
                "rule_code": "SEC-CONF-001",
                "name": "不安全的默认配置 - 使用默认凭证/开放端口/过度权限",
                "description": "检测使用不安全的默认配置(默认凭证/开放端口/过度权限) (CWE-1188)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-1188】检测不安全的默认配置：检查是否存在使用不安全的默认配置的情况。重点关注：使用默认管理员密码(admin/admin)；数据库/Redis/MongoDB默认无认证；Spring Boot默认配置未加固；容器以root运行；不必要的端口开放；默认CORS/Security头配置；框架安全特性默认关闭",
                "fix_suggestion": "修改所有默认凭证、关闭默认开放端口、启用框架安全特性、容器以非root运行",
                "reference_url": "https://cwe.mitre.org/data/definitions/1188.html",
                "code_patterns": {"python": ["app.run(host='0.0.0.0')", "SECURITY_KEY = 'hardcoded_default_key'", "CORS(app, origins='*')"], "java": ["@PermitAll class $CLASS { ... }", "$CONFIG.setSSLEnabled(false)", "String $VAR = System.getProperty(\"http.port\", \"80\")"]},
                "sort_order": 56,
            },
            {
                "rule_code": "SEC-CONF-002",
                "name": "安全响应头缺失 - 缺少X-Frame-Options/CSP等",
                "description": "检测HTTP安全响应头(X-Frame-Options/CSP/HSTS等)缺失 (CWE-1021)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-1021】检测安全响应头缺失：检查是否存在缺少关键HTTP安全响应头的情况。重点关注：缺少X-Frame-Options(点击劫持防护)；缺少Content-Security-Policy(CSP)(XSS/注入防护)；缺少Strict-Transport-Security(HSTS)(HTTPS强制)；缺少X-Content-Type-Options(MIME嗅探防护)；缺少X-XSS-Protection",
                "fix_suggestion": "配置完整的安全响应头：X-Frame-Options=DENY、CSP白名单策略、HSTS、X-Content-Type-Options=nosniff",
                "reference_url": "https://cwe.mitre.org/data/definitions/1021.html",
                "code_patterns": {"python": ["Flask($NAME)", "@app.after_request def $FUNC($RESP): return $RESP"], "java": ["@Controller class $CLASS { @RequestMapping($PATH) ... }", "ResponseEntity.ok($BODY)"], "javascript": ["app.use(express.static($DIR))", "res.send($BODY)", "app.listen($PORT)"]},
                "sort_order": 57,
            },
            # =================== 内存安全类 ===================
            {
                "rule_code": "SEC-MEM-001",
                "name": "缓冲区溢出 - 不安全的字符串/内存操作",
                "description": "检测C/C++中使用不安全的字符串/内存操作函数导致缓冲区溢出 (CWE-119/CWE-787)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-119/CWE-787】检测缓冲区溢出漏洞：检查C/C++中使用不安全的字符串/内存操作函数导致缓冲区越界写入的情况。重点关注：strcpy()/strcat()/gets()/sprintf()/vsprintf()无边界检查；memcpy()/memmove()长度参数可被控制；数组访问未做边界检查；所有固定大小缓冲区接收可变长度输入的模式",
                "fix_suggestion": "使用安全替代函数(strncpy/snprintf/strncat)、做边界检查、使用安全字符串库",
                "reference_url": "https://cwe.mitre.org/data/definitions/119.html",
                "code_patterns": {"c": ["gets($BUF)", "strcpy($DEST, $SRC)", "sprintf($BUF, $FMT, ...)", "strcat($DEST, $SRC)", "scanf(\"%s\", $BUF)"], "cpp": ["std::memcpy($DEST, $SRC, $SIZE)", "strcpy($DEST, $SRC)", "sprintf($BUF, $FMT, ...)", "gets($BUF)"]},
                "sort_order": 58,
            },
            {
                "rule_code": "SEC-MEM-002",
                "name": "整数溢出 - 算术运算溢出导致安全问题",
                "description": "检测整数溢出/环绕导致的内存分配或逻辑错误 (CWE-190)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-190】检测整数溢出漏洞：检查是否存在整数运算溢出/环绕导致安全问题的情况。重点关注：malloc(n*sizeof(type))中n*sizeof可能溢出导致分配过小缓冲区；循环变量/索引使用有符号整数可能变负；无符号整数减法溢出；大小计算溢出后用于内存分配；所有整数运算用于安全决策(内存分配/长度计算/权限判断)但缺少溢出检查",
                "fix_suggestion": "对用于内存分配/安全决策的整数运算做溢出检查，使用足够宽的整数类型",
                "reference_url": "https://cwe.mitre.org/data/definitions/190.html",
                "code_patterns": {"c": ["malloc($EXPR1 * $EXPR2)", "$VAR = $A * $B", "size_t $N = (size_t)$INTVAL"], "cpp": ["new $TYPE[$A * $B]", "malloc($EXPR1 * $EXPR2)", "int $RESULT = $A * $B"]},
                "sort_order": 59,
            },
            {
                "rule_code": "SEC-MEM-003",
                "name": "Use After Free - 释放后使用",
                "description": "检测C/C++中内存释放后继续使用导致的Use After Free漏洞 (CWE-416)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-416】检测Use After Free漏洞：检查C/C++中是否存在内存释放后继续使用的情况。重点关注：free()/delete后继续通过指针访问该内存；realloc()返回新指针但继续使用旧指针；双重释放(double free)；释放后指针未置NULL(悬空指针)；对象析构后回调仍引用该对象",
                "fix_suggestion": "释放内存后立即将指针置NULL、使用RAII/智能指针管理内存生命周期、避免双重释放",
                "reference_url": "https://cwe.mitre.org/data/definitions/416.html",
                "code_patterns": {"c": ["free($PTR); ...; *$PTR", "free($PTR); ...; $PTR->$FIELD", "realloc($PTR, 0); ...; $PTR->$FIELD"], "cpp": ["delete $PTR; ...; $PTR->$METHOD()", "delete[] $PTR; ...; $PTR[$INDEX]", "free($PTR); ...; *$PTR"]},
                "sort_order": 60,
            },
            {
                "rule_code": "SEC-MEM-004",
                "name": "NULL指针解引用 - 未检查NULL直接使用指针",
                "description": "检测指针/引用未做NULL检查直接使用 (CWE-476)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-476】检测NULL指针解引用漏洞：检查是否存在指针/引用/对象在未做NULL/空值检查的情况下直接使用的模式。重点关注：C/C++的malloc/calloc/realloc返回值未检查NULL直接使用；Java的对象方法调用前未检查null；Python的Optional/None未检查；所有函数返回可能为NULL/None/null但调用方未检查直接使用的模式",
                "fix_suggestion": "对所有可能返回NULL/None/null的函数返回值做空值检查后再使用",
                "reference_url": "https://cwe.mitre.org/data/definitions/476.html",
                "code_patterns": {"c": ["*$PTR", "$PTR->$FIELD", "memcpy($DEST, $PTR, $SIZE)"], "cpp": ["*$PTR", "$PTR->$METHOD()", "$PTR->$FIELD"], "python": ["$OBJ.$ATTR", "$OBJ[$KEY]", "getattr($OBJ, $ATTR)"], "java": ["$OBJ.$METHOD()", "$OBJ.$FIELD", "$OBJ.toString()"]},
                "sort_order": 61,
            },
            # =================== 资源管理类 ===================
            {
                "rule_code": "SEC-RES-001",
                "name": "资源未限制 - 无上限分配或缺少速率限制",
                "description": "检测资源分配无上限或缺少速率限制导致DoS (CWE-770/CWE-400)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-770/CWE-400】检测资源未限制漏洞：检查是否存在资源分配无上限或缺少速率限制导致拒绝服务的情况。重点关注：文件上传无大小限制；API请求无速率限制；内存/连接池无上限配置；循环/递归无深度限制；正则表达式可能导致ReDoS；解压缩无大小限制(zip bomb)；所有可被恶意消耗无限资源的模式",
                "fix_suggestion": "对所有资源分配设置上限、实施速率限制、限制递归深度、使用非贪婪正则",
                "reference_url": "https://cwe.mitre.org/data/definitions/770.html",
                "code_patterns": {"python": ["requests.get($URL, timeout=None)", "subprocess.run($CMD, timeout=None)", "socket.create_connection($ADDR)"], "java": ["$CHANNEL.configureBlocking(true)", "while (true) { $LOOP_BODY }", "$EXEC.submit($TASK)"], "javascript": ["fetch($URL)", "axios.get($URL)", "setTimeout($FUNC, 0)"]},
                "sort_order": 62,
            },
            {
                "rule_code": "SEC-RES-002",
                "name": "连接/流资源泄漏 - 未关闭数据库连接/网络连接/文件流",
                "description": "检测数据库连接/网络连接/文件流等资源未正确关闭 (CWE-404)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-404】检测资源泄漏：检查是否存在数据库连接/网络连接/文件流等资源未正确关闭的情况。重点关注：Java的Connection/Statement/Socket未使用try-with-resources；Python的文件/连接未使用with语句；Go的HTTP Response Body未defer Close()；C/C++的malloc后未free/fopen后未fclose；所有资源创建但不在finally/with/defer中确保释放的模式",
                "fix_suggestion": "使用try-with-resources/with语句/defer确保资源释放、资源池化管理",
                "reference_url": "https://cwe.mitre.org/data/definitions/404.html",
                "code_patterns": {"python": ["f = open($FILE); ...", "$CONN = sqlite3.connect($DB); ...", "$HANDLE = urllib.request.urlopen($URL); ..."], "java": ["new FileInputStream($FILE); ...", "$CONN = DriverManager.getConnection($URL); ...", "new Socket($HOST, $PORT); ..."], "go": ["f, $ERR := os.Open($FILE); ...", "$CONN, $ERR := net.Dial($PROTO, $ADDR); ...", "resp, $ERR := http.Get($URL); ..."]},
                "sort_order": 63,
            },
            {
                "rule_code": "SEC-RES-003",
                "name": "拒绝服务(DoS)风险 - 可被恶意触发的资源消耗",
                "description": "检测可被恶意请求触发的资源消耗导致DoS (CWE-400)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-400】检测DoS(拒绝服务)风险：检查是否存在可被恶意请求触发大量资源消耗导致服务不可用的情况。重点关注：正则表达式回溯爆炸(ReDoS)；XML实体扩展攻击(billion laughs)；解压炸弹(zip bomb)；大文件/大请求体无限制处理；数据库慢查询可被构造；JSON解析深度无限制；所有可被外部输入触发无限或超量资源消耗的模式",
                "fix_suggestion": "限制正则复杂度、限制XML/JSON解析深度、限制解压大小、设置请求体大小上限",
                "reference_url": "https://cwe.mitre.org/data/definitions/400.html",
                "sort_order": 64,
            },
            {
                "rule_code": "SEC-RES-004",
                "name": "不安全的临时文件 - mktemp/可预测文件名",
                "description": "检测临时文件创建不安全(可预测文件名/不安全权限) (CWE-377)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-377】检测不安全的临时文件：检查是否存在临时文件创建方式不安全的情况。重点关注：Python的tempfile.mktemp()(可预测文件名+TOCTOU风险)而非mkstemp()/NamedTemporaryFile；C的mktemp()/tmpnam()；临时文件权限过于开放(0666/0777)；临时文件放在共享目录；临时文件名可被预测",
                "fix_suggestion": "使用mkstemp()/NamedTemporaryFile()创建临时文件、设置安全权限(0600)、放在专用目录",
                "reference_url": "https://cwe.mitre.org/data/definitions/377.html",
                "sort_order": 65,
            },
            # =================== 业务逻辑类 ===================
            {
                "rule_code": "SEC-BIZ-001",
                "name": "业务逻辑绕过 - 流程顺序/条件检查可被跳过",
                "description": "检测业务流程中的逻辑缺陷可被绕过 (CWE-841)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-841】检测业务逻辑绕过漏洞：检查是否存在业务流程中的逻辑缺陷可被攻击者绕过的情况。重点关注：支付流程可跳过验证步骤直接完成；优惠券/折扣可被重复使用；订单状态可被非法修改；退款流程缺少对账验证；多步骤流程的步骤顺序可被跳过；业务规则仅在客户端执行",
                "fix_suggestion": "在服务端对每个业务步骤做完整的条件验证、确保流程顺序不可跳过、服务端做对账和一致性检查",
                "reference_url": "https://cwe.mitre.org/data/definitions/841.html",
                "sort_order": 66,
            },
            {
                "rule_code": "SEC-BIZ-002",
                "name": "速率限制缺失 - 关键接口无频率控制",
                "description": "检测关键业务接口缺少速率限制 (CWE-770)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-770】检测速率限制缺失：检查是否存在关键业务接口(登录/注册/短信发送/支付/密码重置)缺少速率限制的情况。重点关注：短信/邮件发送接口无频率限制(可被刷短信费用)；支付接口无频率限制；优惠券/抽奖接口无限制(可被批量薅羊毛)；API接口全局无速率限制；Redis/数据库限流未配置",
                "fix_suggestion": "对所有关键接口实施多维度速率限制(IP+用户+接口)、使用Redis/令牌桶限流",
                "reference_url": "https://cwe.mitre.org/data/definitions/770.html",
                "code_patterns": {"python": ["@app.route($PATH) def $FUNC(...): ...", "Flask(__name__)", "$CLIENT.post($URL)"], "java": ["@PostMapping($PATH) public $RET $METHOD(...)", "@GetMapping($PATH) public $RET $Method(...)", "$RESTTEMPLATE.postForObject($URL, $REQ, $CLASS)"], "javascript": ["app.post($PATH, $FUNC)", "router.post($PATH, $FUNC)", "axios.post($URL, $DATA)"]},
                "sort_order": 67,
            },
            {
                "rule_code": "SEC-BIZ-003",
                "name": "数字精度/金额计算错误 - 浮点数精度问题",
                "description": "检测金融/金额计算中使用浮点数导致精度问题 (CWE-682)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-682】检测数字精度/金额计算错误：检查是否存在金融/金额计算中使用浮点数(float/double)导致精度丢失的情况。重点关注：金额计算使用float/double而非整数/BigDecimal/Decimal；货币转换中的精度丢失；利息/折扣计算使用浮点数导致金额偏差；所有涉及金钱/积分/库存的数值计算使用非精确类型",
                "fix_suggestion": "金额计算使用BigDecimal/Decimal/整数(以最小单位如分存储)，禁止float/double用于金融计算",
                "reference_url": "https://cwe.mitre.org/data/definitions/682.html",
                "code_patterns": {"java": ["double $VAR = $EXPR1 + $EXPR2", "float $VAR = $EXPR1 - $EXPR2", "Double.parseDouble($STR)", "new BigDecimal($VAL).doubleValue()"], "python": ["float($EXPR)", "Decimal($VAL) + $OTHER", "$RESULT = $A + $B"]},
                "sort_order": 68,
            },
        ]
    },
    {
        "name": "代码质量规则",
        "description": "通用代码质量检查规则集",
        "language": "all",
        "rule_type": "quality",
        "is_default": False,
        "sort_order": 1,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "CQ001",
                "name": "函数过长 - 代码质量问题",
                "description": "函数超过50行，建议拆分",
                "category": "quality",
                "severity": "medium",
                "custom_prompt": "检查函数是否过长（超过50行），是否应该拆分为更小的函数",
                "fix_suggestion": "将大函数拆分为多个小函数，每个函数只做一件事",
            },
            {
                "rule_code": "CQ002",
                "name": "重复代码 - 代码质量问题",
                "description": "检测重复的代码块",
                "category": "quality",
                "severity": "medium",
                "custom_prompt": "检查是否存在重复的代码块，可以提取为公共函数或类",
                "fix_suggestion": "提取重复代码为公共函数、类或模块",
            },
            {
                "rule_code": "CQ003",
                "name": "嵌套过深 - 代码质量问题",
                "description": "代码嵌套层级超过4层",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查代码嵌套是否过深（超过4层），影响可读性",
                "fix_suggestion": "使用早返回、提取函数等方式减少嵌套",
            },
            {
                "rule_code": "CQ004",
                "name": "魔法数字 - 代码质量问题",
                "description": "代码中使用未命名的常量",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查是否存在魔法数字或魔法字符串，应该定义为常量",
                "fix_suggestion": "将魔法数字定义为有意义的常量",
            },
            {
                "rule_code": "CQ005",
                "name": "缺少错误处理 - 代码质量问题",
                "description": "缺少异常捕获或错误处理",
                "category": "quality",
                "severity": "high",
                "custom_prompt": "检查是否缺少必要的错误处理，可能导致程序崩溃",
                "fix_suggestion": "添加适当的try-catch或错误检查",
            },
            {
                "rule_code": "CQ006",
                "name": "未使用的变量 - 代码质量问题",
                "description": "声明但未使用的变量",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查是否存在声明但未使用的变量",
                "fix_suggestion": "删除未使用的变量或使用它们",
            },
            {
                "rule_code": "CQ007",
                "name": "命名不规范 - 代码质量问题",
                "description": "变量、函数、类命名不符合规范",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查命名是否符合语言规范和最佳实践",
                "fix_suggestion": "使用有意义的、符合规范的命名",
            },
            {
                "rule_code": "CQ008",
                "name": "注释缺失 - 代码质量问题",
                "description": "复杂逻辑缺少必要注释",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查复杂逻辑是否缺少必要的注释说明",
                "fix_suggestion": "为复杂逻辑添加清晰的注释",
            },
        ]
    },
    {
        "name": "性能优化规则",
        "description": "性能问题检测规则集",
        "language": "all",
        "rule_type": "performance",
        "is_default": False,
        "sort_order": 2,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "PERF001",
                "name": "N+1查询 - 性能问题",
                "description": "检测数据库N+1查询问题",
                "category": "performance",
                "severity": "high",
                "custom_prompt": "检查是否存在N+1查询问题，在循环中执行数据库查询",
                "fix_suggestion": "使用JOIN查询或批量查询替代循环查询",
            },
            {
                "rule_code": "PERF002",
                "name": "内存泄漏 - 性能问题",
                "description": "检测潜在的内存泄漏",
                "category": "performance",
                "severity": "critical",
                "custom_prompt": "检查是否存在内存泄漏：未关闭的资源、循环引用、大对象未释放",
                "fix_suggestion": "使用try-finally或with语句确保资源释放",
            },
            {
                "rule_code": "PERF003",
                "name": "低效算法 - 性能问题",
                "description": "检测时间复杂度过高的算法",
                "category": "performance",
                "severity": "medium",
                "custom_prompt": "检查是否存在低效算法，如O(n²)可优化为O(n)或O(nlogn)",
                "fix_suggestion": "使用更高效的算法或数据结构",
            },
            {
                "rule_code": "PERF004",
                "name": "不必要的对象创建 - 性能问题",
                "description": "在循环中创建不必要的对象",
                "category": "performance",
                "severity": "medium",
                "custom_prompt": "检查是否在循环中创建不必要的对象，应该移到循环外",
                "fix_suggestion": "将对象创建移到循环外部，或使用对象池",
            },
            {
                "rule_code": "PERF005",
                "name": "同步阻塞 - 性能问题",
                "description": "检测同步阻塞操作",
                "category": "performance",
                "severity": "medium",
                "custom_prompt": "检查是否存在同步阻塞操作，应该使用异步方式",
                "fix_suggestion": "使用异步I/O或多线程处理",
            },
        ]
    },
    {
        # ============================================================
        # CVE 申报实战规则集 —— 来源于 DeepAudit 实际申报的 49 个 CVE 漏洞
        # 覆盖 JNDI 注入、数据库后门、可预测验证码、CSV/XLSX 注入、任意文件删除等
        # 已有规则覆盖的类型(SSRF/XSS/权限提升/SQL注入/反序列化/硬编码凭证/信息泄露)不重复添加
        # ============================================================
        "name": "CVE漏洞实战检测规则集",
        "description": "基于 DeepAudit 实际申报的 49 个 CVE 漏洞提炼的检测规则集，覆盖 JNDI 注入、数据库后门/供应链投毒、可预测验证码、CSV/XLSX 注入、任意文件删除等未被通用规则集覆盖的漏洞类型，每条规则附带真实 CVE 案例参考",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "sort_order": 3,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            # =================== JNDI 注入类 ===================
            {
                "rule_code": "CVE-JNDI-001",
                "name": "JNDI注入 - JNDI Lookup可控导致RCE",
                "description": "检测Java JNDI(Java Naming and Directory Interface)查找操作使用用户可控输入导致的远程代码执行漏洞 (CWE-94) — 真实案例：Dataease CVE-2025-64428/CVE-2025-64164/CVE-2025-58045 (CVSS 9.8)",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "【CWE-94】检测JNDI注入漏洞：检查是否存在将不可信输入传入JNDI查找操作导致远程代码执行的情况。JNDI注入是Java生态特有高危漏洞，攻击者通过控制JNDI查找名称可加载远程恶意类实现RCE。重点关注：①InitialContext.lookup()/lookupLink()使用用户可控字符串(如request.getParameter()/URL参数/配置文件外部输入)；②Spring的JndiTemplate.lookup()使用动态参数；③Log4j/Log4shell模式——日志框架通过JNDI lookup解析${jndi:ldap://xxx}表达式(Log4j 2.x ≤2.14.1)；④Fastjson/Jackson反序列化触发JNDI查找(autoType开启时@type指向JNDI引用工厂类如com.sun.rowset.JdbcRowSetImpl)；⑤RMI/LDAP/LDAPS/CORBA协议的JNDI引用均可被利用；⑥com.sun.jndi.ldap.LdapCtx/com.sun.jndi.rmi.registry.RegistryContext等危险JNDI协议实现类；误报排除：JNDI查找名称为硬编码常量(如java:comp/env/datasource)且不接受外部输入的场景不算漏洞",
                "fix_suggestion": "禁止将不可信输入传入JNDI lookup操作；升级Log4j至2.17.1+并禁用JNDI lookup(${log4j2.formatMsgNoLookups:true})；Fastjson关闭autoType(safeMode=true)；JDK升级至8u191+/11.0.1+并设置com.sun.jndi.ldap.object.trustURLCodebase=false/systemProperty；使用JNDI白名单过滤查找名称",
                "reference_url": "https://cwe.mitre.org/data/definitions/94.html",
                "code_patterns": {"java": ["new InitialContext().lookup($NAME)", "$CONTEXT.lookup($EXPR)", "JndiTemplate.lookup($NAME)", "new InitialContext().lookup($REQ.getParameter(...))"]},
                "sort_order": 69,
            },
            # =================== 供应链与后门类 ===================
            {
                "rule_code": "CVE-DBBACK-001",
                "name": "数据库后门/供应链投毒 - 恶意代码植入数据库操作",
                "description": "检测数据库操作中植入后门代码或供应链投毒导致的未授权访问 (CWE-506) — 真实案例：RockOA CVE-2025-9602 (CVSS 6.5)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-506】检测数据库后门/供应链投毒漏洞：检查是否存在数据库初始化脚本/迁移脚本/种子数据中植入恶意代码导致未授权访问的情况。数据库后门通常隐藏在初始化SQL、数据迁移、ORM seed等不易审查的位置。重点关注：①数据库初始化脚本(init.sql/migration.sql/seed.sql)中植入隐藏管理员账户(INSERT INTO users SET role='admin', password=已知值)；②默认账户/硬编码后门账户(admin/admin/admin888/默认手机号+简单密码)写入种子数据且无强制修改机制；③ORM的@PostConstruct/@EventListener在应用启动时创建后门账户；④数据库触发器(TRIGGER)中植入恶意逻辑(如密码修改时同步发送到外部服务器)；⑤存储过程中包含数据外泄逻辑；⑥migration文件中创建隐藏API端点或绕过认证的路由；⑦依赖包(第三方库/npm/pip/maven)被投毒包含数据库操作后门；误报排除：开发/测试环境的种子数据账户(仅在非生产profile激活)且文档中明确标注的不算漏洞",
                "fix_suggestion": "审查所有数据库初始化/迁移脚本中的INSERT语句；移除默认后门账户或添加首次登录强制改密机制；使用代码审计工具扫描seed/migration文件；依赖包使用锁文件(lockfile)固定版本并验证完整性校验和；CI中集成依赖安全扫描(OSV/Snyk/Dependabot)",
                "reference_url": "https://cwe.mitre.org/data/definitions/506.html",
                "code_patterns": {"python": ["cursor.execute($QUERY)", "exec($CODE)", "eval($EXPR)"], "java": ["Statement $STMT = $CONN.createStatement()", "$STMT.executeQuery($SQL)", "Runtime.getRuntime().exec($CMD)"]},
                "sort_order": 70,
            },
            # =================== 认证绕过类 ===================
            {
                "rule_code": "CVE-CAPTCHA-001",
                "name": "可预测验证码 - CAPTCHA实现可被绕过或预测",
                "description": "检测验证码(CAPTCHA)实现可被预测、绕过或暴力破解 (CWE-804) — 真实案例：Newbee-mall CVE-2025-10423 (CVSS 3.7)",
                "category": "security",
                "severity": "low",
                "custom_prompt": "【CWE-804】检测可预测/可绕过验证码漏洞：检查是否存在验证码(CAPTCHA)实现可被预测、绕过或暴力破解的情况。验证码是防自动化攻击的关键机制，实现缺陷可导致暴力破解、批量注册等攻击。重点关注：①验证码使用非密码学安全随机数生成(Math.random()/java.util.Random()/random.randint()而非secrets/SecureRandom/crypto/rand)；②验证码位数过短(4位数字仅10000种可能)或字符集过小(纯数字)；③验证码未设置过期时间或过期时间过长(>5分钟)；④验证码验证后未销毁(同一验证码可重复使用)；⑤验证码结果存储在客户端(Cookie/LocalStorage/隐藏表单字段)而非服务端Session；⑥验证码比较使用非常量时间比较(可通过计时攻击逐位推断)；⑦验证码接口无速率限制(可无限尝试)；⑧图形验证码过于简单(无干扰线/无扭曲/字体统一)可被OCR自动识别；⑨Kaptcha/Google reCAPTCHA配置不当(如kaptcha.noise.impl=NoNoise)；误报排除：使用成熟第三方验证码服务(如reCAPTCHA v3/hCaptcha/Turnstile)且配置正确的场景不算漏洞",
                "fix_suggestion": "使用密码学安全随机数生成验证码(secrets/SecureRandom)；验证码至少6位含大小写+数字+特殊字符；服务端Session存储验证码结果且验证后立即销毁；验证码有效期≤5分钟；设置验证失败次数限制(5次失败后刷新)；使用成熟第三方验证码服务(reCAPTCHA/hCaptcha)",
                "reference_url": "https://cwe.mitre.org/data/definitions/804.html",
                "code_patterns": {"python": ["random.randint($MIN, $MAX)", "random.choice($SEQ)", "hashlib.md5($DATA)"], "java": ["new Random()", "Random $R = new Random(); $R.nextInt($N)", "Math.random()"], "javascript": ["Math.random()", "parseInt(Math.random() * $MAX)", "Math.floor(Math.random() * $LIMIT)"]},
                "sort_order": 71,
            },
            # =================== 数据导出注入类 ===================
            {
                "rule_code": "CVE-CSVINJ-001",
                "name": "CSV/XLSX注入 - 导出数据含公式导致客户端代码执行",
                "description": "检测导出的CSV/XLSX文件中包含恶意公式导致客户端代码执行 (CWE-1236) — 真实案例：Eladmin CVE-2025-9241 (CVSS 7.5)",
                "category": "security",
                "severity": "high",
                "custom_prompt": "【CWE-1236】检测CSV/XLSX注入(公式注入)漏洞：检查是否存在导出的CSV/Excel文件中包含恶意公式导致在用户打开文件时执行任意命令的情况。CSV/XLSX注入是一种被低估的攻击方式，攻击者通过在用户输入中注入电子表格公式(以=+/–/@开头)，当管理员导出数据并用Excel打开时，公式会被自动执行。重点关注：①用户可控字段(姓名/地址/备注/描述/商品名)未做公式字符过滤直接写入CSV/XLSX导出；②CSV导出使用逗号分隔但未对内容中的=+–@\t\r等公式前缀字符做转义；③Excel导出(POI/EasyExcel/openpyxl/xlsxwriter)将用户输入作为单元格原始值(非纯文本格式)写入；④导出Content-Type设置为application/vnd.ms-excel但文件内容为CSV(浏览器按Excel打开触发公式执行)；⑤EasyExcel/POI导出时单元格未设置类型为STRING(默认GENERAL类型会执行公式)；⑥导出功能无文件名随机化(可被预测)；⑦所有将用户输入嵌入到电子表格文件(包括CSV/TSV/XLSX/ODS)而不转义公式前缀的模式；误报排除：导出为PDF/图片格式(非电子表格)的场景不受影响；单元格显式设置为纯文本格式(TEXT/STRING类型)且公式前缀已被转义的场景不算漏洞",
                "fix_suggestion": "对所有写入CSV/XLSX的用户输入做公式前缀转义(=+–@前添加单引号'或制表符前缀)；EasyExcel/POI设置单元格类型为STRING而非GENERAL；CSV导出对所有单元格值用双引号包裹并对内部双引号转义；设置Content-Disposition: attachment并使用随机文件名；考虑导出为PDF格式替代原生Excel",
                "reference_url": "https://cwe.mitre.org/data/definitions/1236.html",
                "code_patterns": {"python": ["csv.writer($FILE).writerow([$CMD, ...])", "pd.DataFrame($DATA).to_csv($FILE)", "$RESP.headers['Content-Disposition'] = 'attachment; filename=$NAME.csv'"], "java": ["CSVWriter $W = new CSVWriter($WRITER); $W.writeNext($ROW)", "response.setHeader(\"Content-Disposition\", \"attachment; filename=$NAME.csv\")"]},
                "sort_order": 72,
            },
            # =================== 文件操作安全类 ===================
            {
                "rule_code": "CVE-FILEDEL-001",
                "name": "任意文件删除 - 文件删除路径可控导致关键文件被删",
                "description": "检测文件删除操作中路径参数可控导致任意文件被删除 (CWE-73) — 真实案例：Litemall CVE-2025-8753 (CVSS 5.4)",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "【CWE-73】检测任意文件删除漏洞：检查是否存在文件删除操作中路径参数由用户控制导致可删除任意文件的情况。任意文件删除可导致拒绝服务(删除关键配置/日志)、权限提升(删除安全策略文件)甚至RCE(删除防篡改文件后替换为恶意文件)。重点关注：①Java的Files.delete()/File.delete()使用request.getParameter()等用户可控路径；②Python的os.remove()/os.unlink()/shutil.rmtree()使用用户输入构造路径；③PHP的unlink()使用$_GET/$_POST可控文件名；④Go的os.Remove()/os.RemoveAll()拼接用户输入；⑤文件删除API端点(/api/delete?file=xxx)接受用户指定文件名且未做路径白名单校验；⑥删除操作仅校验文件扩展名(如只允许.jpg)但未校验目录(可通过../遍历)；⑦头像/附件删除功能直接使用用户提交的文件路径而非从数据库查询关联路径；⑧删除操作未检查文件是否在允许的目录内(realpath/normalize未使用)；⑨批量删除接口未对每个文件路径做独立校验；误报排除：文件路径从数据库记录中获取(非用户直接传入)且数据库写入时已做路径校验的场景不算漏洞；临时文件清理使用固定前缀+随机后缀且限制在/tmp目录的场景不算漏洞",
                "fix_suggestion": "文件删除路径从数据库关联记录获取而非用户直接传入；对所有删除路径做realpath归一化后校验是否在允许目录白名单内；禁止路径中包含../；删除前检查文件类型和所在目录；使用间接引用(文件ID而非文件名)定位待删除文件",
                "reference_url": "https://cwe.mitre.org/data/definitions/73.html",
                "code_patterns": {"python": ["os.remove($PATH)", "shutil.rmtree($DIR)", "os.unlink($FILE)", "pathlib.Path($PATH).unlink()"], "java": ["new File($PATH).delete()", "Files.delete(Paths.get($PATH))", "Files.deleteIfExists(Paths.get($PATH))"], "go": ["os.Remove($PATH)", "os.RemoveAll($DIR)", "os.RemoveAll(filepath.Join($ROOT, $USER_INPUT))"], "php": ["unlink($PATH)", "rmdir($DIR)", "system('rm ' . $PATH)"]},
                "sort_order": 73,
            },
        ]
    },
    {
        "name": "批量规则集 - 第1批",
        "description": "批量生成的第1批10条规则",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "is_system": True,
        "sort_order": 100,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "BATCH-001",
                "name": "不安全的字符串拼接 - 可能导致注入",
                "description": "检测使用字符串拼接而非参数化的代码",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "检查是否存在使用字符串拼接的代码，可能导致各种注入风险。应该使用参数化查询。",
                "fix_suggestion": "使用参数化查询或预编译语句",
                "sort_order": 1,
            },
            {
                "rule_code": "BATCH-002",
                "name": "硬编码的API密钥 - 安全风险",
                "description": "检测代码中硬编码的API密钥",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在硬编码在代码中的API密钥、密码等敏感信息。这些应该放在环境变量或密钥管理系统中。",
                "fix_suggestion": "将敏感信息移到环境变量或密钥管理系统",
                "sort_order": 2,
            },
            {
                "rule_code": "BATCH-003",
                "name": "未使用的导入 - 代码质量问题",
                "description": "检测导入但未使用的包或模块",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查是否存在导入但未使用的包或模块，这会增加代码复杂度。",
                "fix_suggestion": "删除未使用的导入",
                "sort_order": 3,
            },
            {
                "rule_code": "BATCH-004",
                "name": "缺少输入验证 - 用户输入未验证",
                "description": "检测对用户输入缺少验证的代码",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否存在对用户输入缺少验证的代码，这可能导致各种安全问题。",
                "fix_suggestion": "对所有用户输入进行严格的验证和过滤",
                "sort_order": 4,
            },
            {
                "rule_code": "BATCH-005",
                "name": "使用不安全的加密算法 - 安全问题",
                "description": "检测使用弱加密算法的代码",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否使用了不安全的加密算法，如MD5、SHA1、DES等。应该使用更强的算法。",
                "fix_suggestion": "使用更安全的加密算法如AES-256、SHA-256等",
                "sort_order": 5,
            },
            {
                "rule_code": "BATCH-006",
                "name": "缺少速率限制 - 可能导致暴力破解",
                "description": "检测缺少速率限制的接口",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否存在缺少速率限制的接口，这可能导致暴力破解或DoS攻击。",
                "fix_suggestion": "为敏感接口添加速率限制",
                "sort_order": 6,
            },
            {
                "rule_code": "BATCH-007",
                "name": "不安全的文件操作 - 路径遍历风险",
                "description": "检测不安全的文件操作代码",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否存在不安全的文件操作，可能导致路径遍历或其他文件安全问题。",
                "fix_suggestion": "确保文件操作路径在安全目录内，使用白名单验证",
                "sort_order": 7,
            },
            {
                "rule_code": "BATCH-008",
                "name": "缺少权限检查 - 可能导致未授权访问",
                "description": "检测缺少权限检查的代码",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在缺少权限检查的代码，这可能导致未授权访问。",
                "fix_suggestion": "在关键操作前添加权限验证",
                "sort_order": 8,
            },
            {
                "rule_code": "BATCH-009",
                "name": "不安全的随机数 - 使用非密码学安全随机",
                "description": "检测使用非密码学安全随机数生成器的代码",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "检查是否使用了非密码学安全的随机数生成器，在安全场景下应该使用安全的随机数生成器。",
                "fix_suggestion": "使用密码学安全的随机数生成器",
                "sort_order": 9,
            },
            {
                "rule_code": "BATCH-010",
                "name": "调试代码未移除 - 质量问题",
                "description": "检测生产环境中遗留的调试代码",
                "category": "quality",
                "severity": "medium",
                "custom_prompt": "检查是否存在生产环境中不应该存在的调试代码，如console.log、print调试信息等。",
                "fix_suggestion": "移除或禁用生产环境中的调试代码",
                "sort_order": 10,
            },
        ]
    },
    {
        "name": "批量规则集 - 第2批",
        "description": "批量生成的第2批10条规则",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "is_system": True,
        "sort_order": 101,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "BATCH-011",
                "name": "缺少HTTPS - 数据传输不安全",
                "description": "检测使用HTTP而非HTTPS的代码",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否存在使用HTTP而非HTTPS的代码，这可能导致数据传输过程中被窃取或篡改。",
                "fix_suggestion": "使用HTTPS加密数据传输",
                "sort_order": 11,
            },
            {
                "rule_code": "BATCH-012",
                "name": "不安全的反序列化 - 可能导致RCE",
                "description": "检测不安全的反序列化操作",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在不安全的反序列化操作，这可能导致远程代码执行漏洞。",
                "fix_suggestion": "使用安全的序列化格式，或对反序列化输入进行严格验证",
                "sort_order": 12,
            },
            {
                "rule_code": "BATCH-013",
                "name": "硬编码的数据库连接信息",
                "description": "检测硬编码的数据库连接信息",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在硬编码的数据库连接字符串、用户名、密码等敏感信息。",
                "fix_suggestion": "将数据库连接信息移到环境变量或配置文件中",
                "sort_order": 13,
            },
            {
                "rule_code": "BATCH-014",
                "name": "缺少日志记录 - 质量问题",
                "description": "检测关键操作缺少日志记录的代码",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查是否存在关键操作缺少日志记录的代码，这会影响问题追踪和安全审计。",
                "fix_suggestion": "为关键操作添加适当的日志记录",
                "sort_order": 14,
            },
            {
                "rule_code": "BATCH-015",
                "name": "不安全的正则表达式 - ReDoS风险",
                "description": "检测可能导致正则表达式拒绝服务的代码",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "检查是否存在可能导致正则表达式拒绝服务(ReDoS)的复杂正则表达式。",
                "fix_suggestion": "简化正则表达式，使用非贪婪匹配，添加超时限制",
                "sort_order": 15,
            },
            {
                "rule_code": "BATCH-016",
                "name": "缺少数据验证 - 质量问题",
                "description": "检测缺少数据验证的代码",
                "category": "quality",
                "severity": "medium",
                "custom_prompt": "检查是否存在缺少数据验证的代码，这可能导致数据完整性问题。",
                "fix_suggestion": "添加数据类型、范围、格式等验证",
                "sort_order": 16,
            },
            {
                "rule_code": "BATCH-017",
                "name": "不安全的SQL查询 - 注入风险",
                "description": "检测可能导致SQL注入的代码",
                "category": "security",
                "severity": "critical",
                "custom_prompt": "检查是否存在SQL拼接或其他可能导致SQL注入的代码。",
                "fix_suggestion": "使用参数化查询或ORM框架",
                "sort_order": 17,
            },
            {
                "rule_code": "BATCH-018",
                "name": "缺少异常处理 - 质量问题",
                "description": "检测缺少适当异常处理的代码",
                "category": "quality",
                "severity": "medium",
                "custom_prompt": "检查是否存在缺少适当异常处理的代码，这可能导致程序崩溃或异常行为。",
                "fix_suggestion": "添加适当的try-catch或异常处理机制",
                "sort_order": 18,
            },
            {
                "rule_code": "BATCH-019",
                "name": "不安全的跨域资源共享 - CORS",
                "description": "检测CORS配置过于宽松的代码",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否存在CORS配置过于宽松的代码，如Access-Control-Allow-Origin设置为*。",
                "fix_suggestion": "限制允许访问的域名，避免使用通配符",
                "sort_order": 19,
            },
            {
                "rule_code": "BATCH-020",
                "name": "硬编码的IP地址 - 质量问题",
                "description": "检测硬编码的IP地址",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查是否存在硬编码的IP地址，这会降低代码的可移植性和可维护性。",
                "fix_suggestion": "将IP地址移到配置文件中",
                "sort_order": 20,
            },
        ]
    },
    # ============ IaC 规则集 ============
    {
        "name": "IaC规则-容器镜像类",
        "description": "Dockerfile 与容器镜像安全规则（root、latest 标签、远程 ADD、curl|sh）",
        "language": "all",
        "rule_type": "iac",
        "is_default": False,
        "sort_order": 100,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "IAC-CTR-001",
                "name": "镜像以 root 用户运行",
                "description": "Dockerfile 未指定非 root USER 或显式使用 USER root",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "为镜像创建非特权用户并通过 USER appuser 切换",
                "reference_url": "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user",
            },
            {
                "rule_code": "IAC-CTR-002",
                "name": "镜像使用 :latest 标签",
                "description": "FROM 指令使用 :latest 标签或省略 tag，破坏构建可复现性",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "固定到具体版本号，如 FROM ubuntu:22.04 或镜像 digest",
                "reference_url": "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#from",
            },
            {
                "rule_code": "IAC-CTR-003",
                "name": "Dockerfile 使用 ADD 远程 URL",
                "description": "ADD 抓取远程文件无校验，可能引入恶意内容",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "改用 RUN curl/wget 下载并通过 sha256sum 校验",
                "reference_url": "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#add-or-copy",
            },
            {
                "rule_code": "IAC-CTR-004",
                "name": "Dockerfile 出现 curl|sh 模式",
                "description": "通过管道执行远程脚本属于供应链高风险操作",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "下载脚本后校验完整性再执行，或使用官方包管理器",
                "reference_url": "https://owasp.org/www-project-top-ten/",
            },
        ],
    },
    {
        "name": "IaC规则-编排部署类",
        "description": "docker-compose 编排安全规则（privileged、host 网络、Docker socket 挂载）",
        "language": "all",
        "rule_type": "iac",
        "is_default": False,
        "sort_order": 101,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "IAC-ORC-001",
                "name": "容器以 privileged 模式运行",
                "description": "privileged: true 授予容器近似宿主机 root 权限",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "改用细粒度 cap_add 仅添加必要 Linux capabilities",
                "reference_url": "https://docs.docker.com/engine/reference/run/#runtime-privilege-and-linux-capabilities",
            },
            {
                "rule_code": "IAC-ORC-002",
                "name": "服务使用主机网络",
                "description": "network_mode: host 取消容器网络隔离，监听宿主机端口",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "使用默认 bridge 网络并通过 ports 映射端口",
                "reference_url": "https://docs.docker.com/network/host/",
            },
            {
                "rule_code": "IAC-ORC-003",
                "name": "容器挂载 Docker socket",
                "description": "挂载 /var/run/docker.sock 等同于授予容器宿主机 root 权限",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "使用 Docker-in-Docker 或专门的 build-server 隔离",
                "reference_url": "https://owasp.org/www-community/Docker-Security",
            },
        ],
    },
    {
        "name": "IaC规则-CI/CD类",
        "description": "GitHub Actions 工作流安全规则（pull_request_target、未固定 Action、secrets 在 run）",
        "language": "all",
        "rule_type": "iac",
        "is_default": False,
        "sort_order": 102,
        "severity_weights": {"critical": 10, "high": 5, "medium": 2, "low": 1},
        "rules": [
            {
                "rule_code": "IAC-CI-001",
                "name": "pull_request_target 触发器风险",
                "description": "pull_request_target 在仓库上下文运行 PR 代码，可被利用窃取 secrets",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "改用 pull_request 触发器；如必须用 pull_request_target，避免 checkout PR 头",
                "reference_url": "https://securitylab.github.com/research/github-actions-preventing-pwn-requests/",
            },
            {
                "rule_code": "IAC-CI-002",
                "name": "引用的 Action 未固定 commit SHA",
                "description": "使用 @v1/@main 等可变引用，存在供应链篡改风险",
                "category": "security",
                "severity": "medium",
                "fix_suggestion": "将 uses 指向具体 commit SHA（40 位），如 actions/checkout@8e5e7e5...",
                "reference_url": "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions",
            },
            {
                "rule_code": "IAC-CI-003",
                "name": "secrets 直接出现在 run 脚本中",
                "description": "在 run: 内联使用 ${{ secrets.* }} 可能被进程列表或日志泄漏",
                "category": "security",
                "severity": "high",
                "fix_suggestion": "通过 step 的 env: 注入 secrets，run 中以环境变量名引用",
                "reference_url": "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-secrets",
            },
        ],
    },
]


async def init_system_templates(db: AsyncSession) -> None:
    """初始化系统提示词模板"""
    for template_data in SYSTEM_PROMPT_TEMPLATES:
        # 检查是否已存在
        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.name == template_data["name"],
                PromptTemplate.is_system == True
            )
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            template = PromptTemplate(
                name=template_data["name"],
                description=template_data["description"],
                template_type=template_data["template_type"],
                content_zh=template_data["content_zh"],
                content_en=template_data["content_en"],
                variables=json.dumps(template_data.get("variables", {})),
                is_default=template_data.get("is_default", False),
                is_system=True,
                is_active=True,
                sort_order=template_data.get("sort_order", 0),
            )
            db.add(template)
            logger.info(f"✓ 创建系统提示词模板: {template_data['name']}")
    
    await db.flush()


async def init_system_rule_sets(db: AsyncSession) -> None:
    """初始化系统审计规则集 - 会添加新规则集，也会添加缺失的规则"""
    for rule_set_data in SYSTEM_RULE_SETS:
        # 检查是否已存在
        result = await db.execute(
            select(AuditRuleSet)
            .options(selectinload(AuditRuleSet.rules))
            .where(
                AuditRuleSet.name == rule_set_data["name"],
                AuditRuleSet.is_system == True
            )
        )
        existing = result.scalar_one_or_none()

        if not existing:
            # 规则集不存在，创建新的
            rule_set = AuditRuleSet(
                name=rule_set_data["name"],
                description=rule_set_data["description"],
                language=rule_set_data["language"],
                rule_type=rule_set_data["rule_type"],
                severity_weights=json.dumps(rule_set_data.get("severity_weights", {})),
                is_default=rule_set_data.get("is_default", False),
                is_system=True,
                is_active=True,
                sort_order=rule_set_data.get("sort_order", 0),
            )
            db.add(rule_set)
            await db.flush()

            # 创建规则
            for rule_data in rule_set_data.get("rules", []):
                rule = AuditRule(
                    rule_set_id=rule_set.id,
                    rule_code=rule_data["rule_code"],
                    name=rule_data["name"],
                    description=rule_data.get("description"),
                    category=rule_data["category"],
                    severity=rule_data.get("severity", "medium"),
                    custom_prompt=rule_data.get("custom_prompt"),
                    code_patterns=json.dumps(rule_data.get("code_patterns")) if rule_data.get("code_patterns") else None,
                    fix_suggestion=rule_data.get("fix_suggestion"),
                    reference_url=rule_data.get("reference_url"),
                    enabled=True,
                    sort_order=rule_data.get("sort_order", 0),
                )
                db.add(rule)

            logger.info(f"✓ 创建系统规则集: {rule_set_data['name']} ({len(rule_set_data.get('rules', []))} 条规则)")
        else:
            # 规则集已存在，检查是否有新规则需要添加，并同步已有规则的名称和类别
            existing_rule_codes = {r.rule_code for r in existing.rules}
            existing_rules_map = {r.rule_code: r for r in existing.rules}
            new_rules_added = 0
            rules_updated = 0

            for rule_data in rule_set_data.get("rules", []):
                if rule_data["rule_code"] not in existing_rule_codes:
                    # 添加缺失的规则
                    rule = AuditRule(
                        rule_set_id=existing.id,
                        rule_code=rule_data["rule_code"],
                        name=rule_data["name"],
                        description=rule_data.get("description"),
                        category=rule_data["category"],
                        severity=rule_data.get("severity", "medium"),
                        custom_prompt=rule_data.get("custom_prompt"),
                        code_patterns=json.dumps(rule_data.get("code_patterns")) if rule_data.get("code_patterns") else None,
                        fix_suggestion=rule_data.get("fix_suggestion"),
                        reference_url=rule_data.get("reference_url"),
                        enabled=True,
                        sort_order=rule_data.get("sort_order", 0),
                    )
                    db.add(rule)
                    new_rules_added += 1
                else:
                    # 同步已有规则的名称和类别（以代码定义为准）
                    existing_rule = existing_rules_map[rule_data["rule_code"]]
                    updated_fields = []
                    if existing_rule.name != rule_data["name"]:
                        existing_rule.name = rule_data["name"]
                        updated_fields.append("name")
                    if existing_rule.category != rule_data["category"]:
                        existing_rule.category = rule_data["category"]
                        updated_fields.append("category")
                    if updated_fields:
                        rules_updated += 1

            # 同步规则集的 rule_type（基于分类函数）
            expected_rule_type = classify_rule_set_type(rule_set_data["name"])
            if existing.rule_type != expected_rule_type:
                existing.rule_type = expected_rule_type
                rules_updated += 1

            if new_rules_added > 0 or rules_updated > 0:
                logger.info(f"✓ 更新系统规则集: {rule_set_data['name']} (新增 {new_rules_added} 条规则, 同步 {rules_updated} 条规则)")

    await db.flush()


async def init_templates_and_rules(db: AsyncSession) -> None:
    """初始化所有系统模板和规则"""
    logger.info("开始初始化系统模板和规则...")

    try:
        await init_system_templates(db)
        await init_system_rule_sets(db)
        await ensure_code_patterns(db)
        await sync_rule_categories(db)
        await db.commit()
        logger.info("✓ 系统模板和规则初始化完成")
    except Exception as e:
        logger.warning(f"初始化模板和规则时出错（可能表不存在）: {e}")
        await db.rollback()


async def ensure_code_patterns(db: AsyncSession) -> None:
    """回填已有系统规则的 code_patterns 字段（仅更新 code_patterns 为 NULL 的规则）"""
    # 收集 SYSTEM_RULE_SETS 中所有规则 code -> code_patterns 的映射
    patterns_map = {}
    for rule_set_data in SYSTEM_RULE_SETS:
        for rule_data in rule_set_data.get("rules", []):
            cp = rule_data.get("code_patterns")
            if cp:
                patterns_map[rule_data["rule_code"]] = json.dumps(cp)

    if not patterns_map:
        return

    # 查询所有 code_patterns 为 NULL 的系统规则
    result = await db.execute(
        select(AuditRule).where(AuditRule.code_patterns == None)
    )
    rules_without_patterns = result.scalars().all()

    updated = 0
    for rule in rules_without_patterns:
        if rule.rule_code in patterns_map:
            rule.code_patterns = patterns_map[rule.rule_code]
            updated += 1

    if updated > 0:
        logger.info(f"✓ 回填 {updated} 条系统规则的 code_patterns 字段")
    await db.flush()


async def sync_rule_categories(db: AsyncSession) -> None:
    """
    根据分类规则同步所有规则的 category 和规则集的 rule_type:
    - 规则名带有"性能"的统一归为性能规则 → category='performance'
    - 规则名带有"质量"的统一归为质量规则 → category='quality'
    - 其他均归为漏洞规则 → category='security'
    - 规则集 rule_type 同理
    """
    # 同步所有规则的 category
    result = await db.execute(select(AuditRule))
    all_rules = result.scalars().all()

    rules_updated = 0
    for rule in all_rules:
        expected_category = classify_rule_category(rule.name)
        if rule.category != expected_category:
            rule.category = expected_category
            rules_updated += 1

    if rules_updated > 0:
        logger.info(f"✓ 同步 {rules_updated} 条规则的 category 字段")

    # 同步所有规则集的 rule_type
    result = await db.execute(select(AuditRuleSet))
    all_rule_sets = result.scalars().all()

    rule_sets_updated = 0
    for rule_set in all_rule_sets:
        expected_type = classify_rule_set_type(rule_set.name)
        if rule_set.rule_type != expected_type:
            rule_set.rule_type = expected_type
            rule_sets_updated += 1

    if rule_sets_updated > 0:
        logger.info(f"✓ 同步 {rule_sets_updated} 个规则集的 rule_type 字段")

    await db.flush()
