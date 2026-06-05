#!/usr/bin/env python3
"""
批量添加规则到数据库的脚本
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


BATCH_RULE_SETS = [
    {
        "name": "批量规则集 - 第1批",
        "description": "批量生成的第1批10条规则",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "sort_order": 100,
        "rules": [
            {
                "rule_code": "BATCH-001",
                "name": "不安全的字符串拼接 - 可能导致注入",
                "description": "检测使用字符串拼接而非参数化的代码",
                "category": "security",
                "severity": "medium",
                "custom_prompt": "检查是否存在使用字符串拼接的代码，可能导致各种注入风险。应该使用参数化查询。",
                "fix_suggestion": "使用参数化查询或预编译语句",
                "enabled": True,
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
                "enabled": True,
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
                "enabled": True,
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
                "enabled": True,
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
                "enabled": True,
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
                "enabled": True,
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
                "enabled": True,
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
                "enabled": True,
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
                "enabled": True,
                "sort_order": 9,
            },
            {
                "rule_code": "BATCH-010",
                "name": "调试代码未移除 - 生产环境风险",
                "description": "检测生产环境中遗留的调试代码",
                "category": "quality",
                "severity": "medium",
                "custom_prompt": "检查是否存在生产环境中不应该存在的调试代码，如console.log、print调试信息等。",
                "fix_suggestion": "移除或禁用生产环境中的调试代码",
                "enabled": True,
                "sort_order": 10,
            },
        ],
    },
    {
        "name": "批量规则集 - 第2批",
        "description": "批量生成的第2批10条规则",
        "language": "all",
        "rule_type": "security",
        "is_default": False,
        "sort_order": 101,
        "rules": [
            {
                "rule_code": "BATCH-011",
                "name": "缺少HTTPS - 数据传输不安全",
                "description": "检测使用HTTP而非HTTPS的代码",
                "category": "security",
                "severity": "high",
                "custom_prompt": "检查是否存在使用HTTP而非HTTPS的代码，这可能导致数据传输过程中被窃取或篡改。",
                "fix_suggestion": "使用HTTPS加密数据传输",
                "enabled": True,
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
                "enabled": True,
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
                "enabled": True,
                "sort_order": 13,
            },
            {
                "rule_code": "BATCH-014",
                "name": "缺少日志记录 - 难以追踪问题",
                "description": "检测关键操作缺少日志记录的代码",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查是否存在关键操作缺少日志记录的代码，这会影响问题追踪和安全审计。",
                "fix_suggestion": "为关键操作添加适当的日志记录",
                "enabled": True,
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
                "enabled": True,
                "sort_order": 15,
            },
            {
                "rule_code": "BATCH-016",
                "name": "缺少数据验证 - 数据完整性风险",
                "description": "检测缺少数据验证的代码",
                "category": "quality",
                "severity": "medium",
                "custom_prompt": "检查是否存在缺少数据验证的代码，这可能导致数据完整性问题。",
                "fix_suggestion": "添加数据类型、范围、格式等验证",
                "enabled": True,
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
                "enabled": True,
                "sort_order": 17,
            },
            {
                "rule_code": "BATCH-018",
                "name": "缺少异常处理 - 程序稳定性风险",
                "description": "检测缺少适当异常处理的代码",
                "category": "quality",
                "severity": "medium",
                "custom_prompt": "检查是否存在缺少适当异常处理的代码，这可能导致程序崩溃或异常行为。",
                "fix_suggestion": "添加适当的try-catch或异常处理机制",
                "enabled": True,
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
                "enabled": True,
                "sort_order": 19,
            },
            {
                "rule_code": "BATCH-020",
                "name": "硬编码的IP地址 - 可维护性问题",
                "description": "检测硬编码的IP地址",
                "category": "quality",
                "severity": "low",
                "custom_prompt": "检查是否存在硬编码的IP地址，这会降低代码的可移植性和可维护性。",
                "fix_suggestion": "将IP地址移到配置文件中",
                "enabled": True,
                "sort_order": 20,
            },
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
    print("🚀 开始添加批量规则...\n")
    asyncio.run(add_batch_rules())
    print("\n✅ 完成！")
