#!/usr/bin/env python3
"""
批量添加规则到数据库的脚本 - 第3-6批 (20条/批，共80条)
"""
import sys
import os
import json
import asyncio
from pathlib import Path

# 添加项目根目录到 Python 路径
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.audit_rule import AuditRuleSet, AuditRule
from app.models.user import User
from app.db.base import async_engine
from app.db.session import async_session_factory


# 批量生成规则模板
def generate_rule(rule_code, name, description, category, severity, prompt, fix):
    return {
        "rule_code": rule_code,
        "name": name,
        "description": description,
        "category": category,
        "severity": severity,
        "custom_prompt": prompt,
        "fix_suggestion": fix,
        "enabled": True,
        "sort_order": int(rule_code.split("-")[-1]),
    }


BATCH_RULE_SETS = [
    # 第3批
    {
        "name": "批量规则集 - 第3批",
        "description": "批量生成的第3批20条规则",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "sort_order": 102,
        "rules": [
            generate_rule("BATCH-021", "缺少安全头 - XSS防护不足", "检测缺少X-Frame-Options等安全头的代码", "security", "high", "检查是否缺少X-Frame-Options、X-XSS-Protection、Content-Security-Policy等安全响应头，这可能导致各种Web攻击。", "添加必要的安全响应头"),
            generate_rule("BATCH-022", "不安全的文件上传 - 任意文件上传风险", "检测不安全的文件上传功能", "security", "critical", "检查文件上传功能是否存在安全隐患，如未验证文件类型、大小限制不足等。", "验证文件类型、限制大小、存储在非Web目录"),
            generate_rule("BATCH-023", "会话超时设置过长 - 会话劫持风险", "检测会话超时设置过长的代码", "security", "medium", "检查会话超时设置是否过长，这会增加会话劫持的风险。", "设置合理的会话超时时间"),
            generate_rule("BATCH-024", "不安全的Cookie属性 - 会话安全问题", "检测Cookie缺少HttpOnly/ Secure属性的代码", "security", "high", "检查Cookie是否设置了HttpOnly和Secure属性，缺少这些属性会增加会话劫持风险。", "为敏感Cookie添加HttpOnly和Secure属性"),
            generate_rule("BATCH-025", "开放重定向漏洞 - 钓鱼风险", "检测可能导致开放重定向的代码", "security", "high", "检查是否存在开放重定向漏洞，攻击者可利用此进行钓鱼攻击。", "验证并限制重定向URL"),
            generate_rule("BATCH-026", "缺少CSRF保护 - 跨站请求伪造", "检测缺少CSRF保护的代码", "security", "critical", "检查是否缺少CSRF保护机制，这可能导致跨站请求伪造攻击。", "添加CSRF token保护"),
            generate_rule("BATCH-027", "硬编码的凭证 - 安全风险", "检测代码中硬编码的密码或凭证", "security", "critical", "检查是否在代码中硬编码了密码、API密钥等敏感凭证信息。", "将凭证移到环境变量或密钥管理系统"),
            generate_rule("BATCH-028", "不安全的密码存储 - 明文或弱哈希", "检测不安全的密码存储方式", "security", "critical", "检查密码是否以明文或弱哈希方式存储，这会导致密码泄露风险。", "使用bcrypt/Argon2等强哈希算法"),
            generate_rule("BATCH-029", "缺少密码策略 - 弱密码风险", "检测缺少密码策略的代码", "security", "medium", "检查是否缺少密码复杂度要求策略，这会导致用户设置弱密码。", "实施密码复杂度要求"),
            generate_rule("BATCH-030", "信息泄露 - 详细错误信息", "检测泄露敏感信息的错误消息", "security", "medium", "检查是否在错误消息中泄露了堆栈跟踪、数据库结构等敏感信息。", "生产环境中隐藏详细错误信息"),
            generate_rule("BATCH-031", "不安全的依赖 - 已知漏洞", "检测使用已知漏洞版本的依赖", "security", "high", "检查项目依赖是否存在已知安全漏洞的版本。", "升级到安全的依赖版本"),
            generate_rule("BATCH-032", "缺少请求大小限制 - DoS风险", "检测缺少请求大小限制的代码", "security", "medium", "检查是否缺少请求体大小限制，这可能导致DoS攻击。", "设置合理的请求大小限制"),
            generate_rule("BATCH-033", "不安全的XML解析 - XXE风险", "检测不安全的XML解析代码", "security", "critical", "检查XML解析是否禁用了外部实体引用，防止XXE攻击。", "禁用XML外部实体引用"),
            generate_rule("BATCH-034", "目录列表暴露 - 信息泄露", "检测目录列表功能启用的代码", "security", "low", "检查是否启用了目录列表功能，这可能泄露敏感文件信息。", "禁用目录列表功能"),
            generate_rule("BATCH-035", "不安全的跳转 - 未验证目标", "检测未验证目标的跳转代码", "security", "high", "检查跳转功能是否验证目标URL，防止跳转攻击。", "使用白名单验证跳转目标"),
            generate_rule("BATCH-036", "缺少审计日志 - 安全事件追踪", "检测关键操作缺少审计日志的代码", "security", "medium", "检查关键安全操作是否缺少审计日志记录。", "为关键操作添加审计日志"),
            generate_rule("BATCH-037", "不安全的临时文件 - 竞争条件", "检测不安全的临时文件操作", "security", "medium", "检查临时文件操作是否存在竞争条件风险。", "使用安全的临时文件创建方式"),
            generate_rule("BATCH-038", "硬编码的加密密钥 - 密钥管理", "检测硬编码的加密密钥", "security", "critical", "检查是否在代码中硬编码了加密密钥。", "使用安全的密钥管理系统"),
            generate_rule("BATCH-039", "缺少访问控制 - 垂直越权", "检测缺少垂直权限控制的代码", "security", "critical", "检查是否缺少基于角色的访问控制，可能导致垂直越权。", "实现基于角色的访问控制"),
            generate_rule("BATCH-040", "不安全的缓存策略 - 敏感数据", "检测敏感数据缓存不当的代码", "security", "medium", "检查敏感数据是否被不安全地缓存。", "避免缓存敏感数据或加密缓存"),
        ],
    },
    # 第4批
    {
        "name": "批量规则集 - 第4批",
        "description": "批量生成的第4批20条规则",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "sort_order": 103,
        "rules": [
            generate_rule("BATCH-041", "不安全的字符编码 - 编码问题", "检测字符编码处理不安全的代码", "security", "medium", "检查字符编码处理是否安全，防止编码注入攻击。", "统一使用UTF-8编码，正确处理多字节字符"),
            generate_rule("BATCH-042", "缺少资源释放 - 资源泄露", "检测未正确释放资源的代码", "quality", "medium", "检查文件句柄、数据库连接等资源是否被正确释放。", "使用try-finally或with语句确保资源释放"),
            generate_rule("BATCH-043", "不安全的竞争条件 - 并发问题", "检测存在竞争条件的代码", "security", "medium", "检查并发操作是否存在竞争条件风险。", "使用适当的同步机制"),
            generate_rule("BATCH-044", "硬编码的秘密 - 配置管理", "检测硬编码在代码中的各种秘密", "security", "critical", "检查是否在代码中硬编码了任何类型的秘密信息。", "使用配置管理和密钥管理系统"),
            generate_rule("BATCH-045", "缺少速率限制 - API保护", "检测API接口缺少速率限制的代码", "security", "high", "检查API接口是否缺少速率限制，防止暴力攻击。", "为API接口添加速率限制"),
            generate_rule("BATCH-046", "不安全的版本控制 - 秘密泄露", "检测版本控制中可能泄露的秘密", "security", "high", "检查是否有敏感文件被提交到版本控制系统。", "使用.gitignore忽略敏感文件"),
            generate_rule("BATCH-047", "缺少输入验证 - 数据格式", "检测缺少输入格式验证的代码", "security", "high", "检查用户输入是否验证了数据格式和类型。", "使用白名单验证输入格式"),
            generate_rule("BATCH-048", "不安全的密码重置 - 账户接管", "检测不安全的密码重置功能", "security", "critical", "检查密码重置功能是否存在安全漏洞。", "使用安全的密码重置流程"),
            generate_rule("BATCH-049", "缺少会话固定保护 - 会话安全", "检测缺少会话固定保护的代码", "security", "high", "检查是否在登录后重新生成会话ID。", "登录后重新生成会话ID"),
            generate_rule("BATCH-050", "不安全的API认证 - 身份验证", "检测API认证实现不安全的代码", "security", "critical", "检查API认证机制是否安全实现。", "使用标准的认证方案如JWT、OAuth2"),
            generate_rule("BATCH-051", "缺少MFA支持 - 认证强化", "检测缺少多因素认证的代码", "security", "medium", "检查是否支持多因素认证来增强账户安全。", "考虑实现多因素认证支持"),
            generate_rule("BATCH-052", "不安全的会话管理 - 会话存储", "检测会话管理不安全的代码", "security", "high", "检查会话数据是否安全存储。", "将会话数据存储在服务端"),
            generate_rule("BATCH-053", "缺少数据加密 - 传输安全", "检测传输数据未加密的代码", "security", "critical", "检查敏感数据传输是否加密。", "使用TLS/SSL加密数据传输"),
            generate_rule("BATCH-054", "不安全的密钥派生 - 密码学", "检测密钥派生不安全的代码", "security", "critical", "检查密钥派生是否使用了安全的算法。", "使用PBKDF2、scrypt或Argon2"),
            generate_rule("BATCH-055", "缺少签名验证 - 数据完整性", "检测缺少数据签名验证的代码", "security", "high", "检查关键数据是否有签名验证保证完整性。", "对关键数据进行数字签名"),
            generate_rule("BATCH-056", "不安全的反射 - 代码注入", "检测不安全使用反射的代码", "security", "critical", "检查反射功能是否被安全使用。", "避免对用户输入使用反射"),
            generate_rule("BATCH-057", "缺少备份策略 - 数据安全", "检测缺少数据备份策略的代码", "quality", "medium", "检查是否有适当的数据备份策略。", "实施定期的数据备份策略"),
            generate_rule("BATCH-058", "不安全的API设计 - REST安全", "检测API设计不安全的代码", "security", "medium", "检查REST API设计是否遵循安全最佳实践。", "遵循REST安全最佳实践"),
            generate_rule("BATCH-059", "缺少异常处理 - 错误安全", "检测异常处理不当的代码", "quality", "medium", "检查异常处理是否泄露敏感信息。", "安全地处理异常，不泄露详情"),
            generate_rule("BATCH-060", "不安全的第三方集成 - 供应链安全", "检测第三方集成不安全的代码", "security", "high", "检查第三方库和服务的集成是否安全。", "审查和验证第三方依赖"),
        ],
    },
    # 第5批
    {
        "name": "批量规则集 - 第5批",
        "description": "批量生成的第5批20条规则",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "sort_order": 104,
        "rules": [
            generate_rule("BATCH-061", "不安全的本地存储 - 客户端安全", "检测浏览器本地存储使用不当的代码", "security", "medium", "检查敏感数据是否被不安全地存储在客户端。", "避免在本地存储敏感数据"),
            generate_rule("BATCH-062", "缺少内容安全策略 - CSP", "检测缺少内容安全策略的代码", "security", "high", "检查是否实现了内容安全策略(CSP)来防止XSS。", "实现内容安全策略"),
            generate_rule("BATCH-063", "不安全的Web Workers - 线程安全", "检测Web Workers使用不当的代码", "security", "low", "检查Web Workers的使用是否安全。", "验证传递给Web Workers的数据"),
            generate_rule("BATCH-064", "缺少子资源完整性 - SRI", "检测缺少子资源完整性验证的代码", "security", "medium", "检查第三方资源是否有完整性验证。", "使用SRI验证第三方资源"),
            generate_rule("BATCH-065", "不安全的WebSocket - 通信安全", "检测WebSocket使用不安全的代码", "security", "medium", "检查WebSocket连接是否安全。", "使用wss://协议，验证消息来源"),
            generate_rule("BATCH-066", "缺少权限最小化 - 权限过宽", "检测权限设置过宽的代码", "security", "medium", "检查应用权限是否遵循最小权限原则。", "遵循最小权限原则"),
            generate_rule("BATCH-067", "不安全的定时任务 - 任务安全", "检测定时任务实现不安全的代码", "security", "medium", "检查定时任务是否存在安全隐患。", "安全地实现定时任务"),
            generate_rule("BATCH-068", "缺少日志监控 - 安全监控", "检测缺少日志监控的代码", "security", "medium", "检查是否有安全日志监控机制。", "实施安全日志监控"),
            generate_rule("BATCH-069", "不安全的消息队列 - 中间件安全", "检测消息队列使用不安全的代码", "security", "medium", "检查消息队列是否安全配置和使用。", "安全配置消息队列"),
            generate_rule("BATCH-070", "缺少网络分段 - 网络安全", "检测网络架构缺少分段的代码", "security", "low", "检查系统是否考虑了网络分段。", "考虑实施网络分段"),
            generate_rule("BATCH-071", "不安全的数据库权限 - 数据库安全", "检测数据库权限设置不当的代码", "security", "critical", "检查数据库用户权限是否设置合理。", "遵循数据库最小权限原则"),
            generate_rule("BATCH-072", "缺少数据分类 - 数据治理", "检测缺少数据分类的代码", "quality", "low", "检查是否对数据进行了安全分类。", "实施数据分类策略"),
            generate_rule("BATCH-073", "不安全的配置文件 - 配置安全", "检测配置文件处理不当的代码", "security", "high", "检查配置文件是否安全存储和访问。", "安全地管理配置文件"),
            generate_rule("BATCH-074", "缺少安全编码规范 - 开发流程", "检测缺少安全编码规范的项目", "quality", "low", "检查项目是否有安全编码规范。", "建立安全编码规范"),
            generate_rule("BATCH-075", "不安全的文件权限 - 文件系统安全", "检测文件权限设置不当的代码", "security", "medium", "检查文件和目录权限是否设置安全。", "设置最小必要的文件权限"),
            generate_rule("BATCH-076", "缺少变更管理 - 变更安全", "检测缺少变更管理流程的代码", "quality", "low", "检查是否有安全的变更管理流程。", "实施变更管理流程"),
            generate_rule("BATCH-077", "不安全的Shell命令 - 命令注入", "检测Shell命令拼接的代码", "security", "critical", "检查是否存在Shell命令拼接导致的注入风险。", "避免Shell拼接，使用安全的API"),
            generate_rule("BATCH-078", "缺少威胁建模 - 设计安全", "检测缺少威胁建模的项目", "quality", "low", "检查项目是否进行了威胁建模。", "考虑进行威胁建模"),
            generate_rule("BATCH-079", "不安全的反病毒绕过 - 恶意软件", "检测可能被用于反病毒绕过的代码", "security", "medium", "检查代码是否包含可疑的反病毒绕过特征。", "避免使用可疑的技术"),
            generate_rule("BATCH-080", "缺少安全测试 - 测试覆盖", "检测缺少安全测试的项目", "quality", "medium", "检查项目是否有安全测试流程。", "实施安全测试流程"),
        ],
    },
    # 第6批
    {
        "name": "批量规则集 - 第6批",
        "description": "批量生成的第6批20条规则",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "sort_order": 105,
        "rules": [
            generate_rule("BATCH-081", "不安全的序列化 - 反序列化漏洞", "检测不安全的序列化实现", "security", "critical", "检查序列化/反序列化是否安全实现。", "避免不安全的反序列化"),
            generate_rule("BATCH-082", "缺少输入限制 - 长度检查", "检测缺少输入长度限制的代码", "security", "medium", "检查用户输入是否有长度限制。", "设置合理的输入长度限制"),
            generate_rule("BATCH-083", "不安全的随机数 - 密码学随机", "检测非加密安全随机数的使用", "security", "high", "检查安全场景下是否使用了安全的随机数生成器。", "使用加密安全的随机数生成器"),
            generate_rule("BATCH-084", "缺少补丁管理 - 系统更新", "检测缺少补丁管理的代码", "quality", "medium", "检查系统是否有补丁管理策略。", "建立补丁管理策略"),
            generate_rule("BATCH-085", "不安全的凭据存储 - 密码管理", "检测凭据存储不安全的代码", "security", "critical", "检查凭据是否安全存储。", "使用安全的凭据存储方案"),
            generate_rule("BATCH-086", "缺少密钥轮换 - 密钥管理", "检测缺少密钥轮换策略的代码", "security", "medium", "检查加密密钥是否有轮换机制。", "实施密钥轮换策略"),
            generate_rule("BATCH-087", "不安全的API限流 - 防刷机制", "检测API限流实现不安全的代码", "security", "medium", "检查API限流是否有效实现。", "安全实现API限流"),
            generate_rule("BATCH-088", "缺少数据脱敏 - 隐私保护", "检测敏感数据未脱敏的代码", "security", "medium", "检查敏感数据在日志等地方是否脱敏。", "对敏感数据进行脱敏处理"),
            generate_rule("BATCH-089", "不安全的重定向 - 开放重定向", "检测重定向目标未验证的代码", "security", "high", "检查重定向功能是否安全。", "验证重定向目标"),
            generate_rule("BATCH-090", "缺少错误处理 - 异常安全", "检测错误处理不当的代码", "quality", "medium", "检查错误处理是否安全。", "安全地处理错误"),
            generate_rule("BATCH-091", "不安全的跨站请求 - CSRF", "检测CSRF防护不足的代码", "security", "critical", "检查CSRF防护是否充分。", "实施CSRF防护"),
            generate_rule("BATCH-092", "缺少会话过期 - 会话管理", "检测会话过期设置不当的代码", "security", "medium", "检查会话过期是否合理设置。", "设置合理的会话过期时间"),
            generate_rule("BATCH-093", "不安全的文件包含 - LFI/RFI", "检测文件包含漏洞的代码", "security", "critical", "检查是否存在本地或远程文件包含漏洞。", "避免动态文件包含"),
            generate_rule("BATCH-094", "缺少权限继承 - 访问控制", "检测权限继承设计不当的代码", "security", "medium", "检查权限继承逻辑是否安全。", "安全设计权限继承"),
            generate_rule("BATCH-095", "不安全的类型转换 - 类型安全", "检测类型转换不安全的代码", "quality", "medium", "检查类型转换是否安全处理。", "安全地处理类型转换"),
            generate_rule("BATCH-096", "缺少资源限制 - 资源控制", "检测缺少资源使用限制的代码", "security", "medium", "检查是否有资源使用限制。", "设置资源使用限制"),
            generate_rule("BATCH-097", "不安全的变量覆盖 - 代码注入", "检测可能导致变量覆盖的代码", "security", "high", "检查是否存在变量覆盖漏洞。", "避免动态变量名"),
            generate_rule("BATCH-098", "缺少验证逻辑 - 业务逻辑", "检测业务逻辑验证不足的代码", "security", "medium", "检查业务逻辑验证是否充分。", "充分验证业务逻辑"),
            generate_rule("BATCH-099", "不安全的时间检查 - 竞争条件", "检测时间检查不安全的代码", "security", "medium", "检查时间相关的检查是否存在竞争条件。", "避免TOCTOU竞争条件"),
            generate_rule("BATCH-100", "缺少安全文档 - 文档完整性", "检测缺少安全文档的项目", "quality", "low", "检查项目是否有安全相关文档。", "编写安全文档"),
        ],
    },
]


async def add_batch_rules():
    """添加批量规则到数据库"""
    async with async_session_factory() as db:
        # 查找第一个用户作为创建者
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()

        if not user:
            print("❌ 数据库中没有用户，先创建一个用户或等待初始化完成")
            return

        print(f"👤 使用用户: {user.username} (id: {user.id})")

        added_count = 0

        for rule_set_data in BATCH_RULE_SETS:
            # 检查规则集是否已存在
            result = await db.execute(
                select(AuditRuleSet)
                .where(
                    AuditRuleSet.name == rule_set_data["name"],
                    AuditRuleSet.created_by == user.id
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"⏭️  规则集已存在，跳过: {rule_set_data['name']}")
                continue

            # 创建规则集
            rule_set = AuditRuleSet(
                name=rule_set_data["name"],
                description=rule_set_data["description"],
                language=rule_set_data["language"],
                rule_type=rule_set_data["rule_type"],
                severity_weights=json.dumps({"critical": 10, "high": 5, "medium": 2, "low": 1}),
                is_default=rule_set_data.get("is_default", False),
                is_system=False,
                is_active=True,
                sort_order=rule_set_data.get("sort_order", 0),
                created_by=user.id,
            )

            db.add(rule_set)
            await db.flush()

            # 创建规则
            rules_added = 0
            for rule_data in rule_set_data["rules"]:
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
                    enabled=rule_data.get("enabled", True),
                    sort_order=rule_data.get("sort_order", 0),
                )
                db.add(rule)
                rules_added += 1

            await db.commit()
            print(f"✅ 成功添加规则集: {rule_set_data['name']} ({rules_added} 条规则)")
            added_count += rules_added

        print(f"\n🎉 总共添加了 {added_count} 条规则！")


if __name__ == "__main__":
    print("🚀 开始添加批量规则 (第3-6批)...\n")
    asyncio.run(add_batch_rules())
    print("\n✅ 完成！")
