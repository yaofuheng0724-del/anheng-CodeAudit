"""
AI 规则生成服务

基于用户自然语言描述，调用 LLM 生成结构化的代码审计规则。
"""

import logging
from typing import Optional
from app.services.llm.service import LLMService
from app.services.llm.factory import LLMFactory
from app.services.llm.types import LLMRequest, LLMMessage

logger = logging.getLogger(__name__)

# 系统提示词：引导 LLM 生成专业的代码审计规则
RULE_GENERATION_SYSTEM_PROMPT = """你是一位资深的代码安全审计专家，专注于静态代码分析和安全漏洞检测。你的任务是根据用户的简要描述，生成一条完整、专业的代码审计规则。

## 输出要求

请直接输出规则内容，不要包含标题、编号或多余的解释说明。规则内容应当是一段可以直接用于指导代码审计的完整检测规则描述，包含以下要素：

1. **检测目标**：明确说明要检测什么类型的代码问题
2. **检测原理**：简要解释为什么这是一个问题，可能的危害是什么
3. **检测模式**：描述具体的代码模式、API 调用、函数使用方式等特征
4. **误报排除**：说明哪些情况下不应该报告此问题
5. **修复建议**：给出修复此问题的推荐做法

## 格式规范

- 使用中文输出
- 规则内容使用 Markdown 格式，结构清晰
- 如果用户描述中涉及具体的编程语言，请针对该语言的特性给出检测要点
- 如果用户描述中涉及具体的漏洞类型，请按照该漏洞类型的标准检测方法展开

## 规则质量标准

- **精确性**：规则应该能准确识别目标问题，减少误报
- **完整性**：覆盖该类问题的常见变体和场景
- **可操作性**：检测模式应足够具体，便于实际代码扫描时匹配
- **实用性**：修复建议应具有可操作性，而非泛泛而谈

## 示例

用户输入："检测 SQL 注入"
规则输出：
---
### 检测目标
检测代码中可能存在的 SQL 注入漏洞，包括字符串拼接构造 SQL 语句、未使用参数化查询等不安全模式。

### 检测原理
SQL 注入是 Web 应用最常见的安全漏洞之一。攻击者通过在用户输入中注入恶意 SQL 片段，可以绕过身份验证、读取敏感数据、修改数据库内容甚至执行系统命令。当应用程序直接将用户输入拼接到 SQL 查询中时，就会产生 SQL 注入风险。

### 检测模式

**Python 场景：**
- 使用 f-string 或 format 拼接 SQL：`f"SELECT * FROM users WHERE id = {user_id}"`
- 使用 % 格式化构造 SQL：`"SELECT * FROM users WHERE id = %s" % user_id`
- 直接拼接字符串：`"SELECT * FROM users WHERE id = " + user_id`
- 使用 raw SQL 而非 ORM 参数化：`cursor.execute(query)` 其中 query 包含用户输入

**Java 场景：**
- 使用 StringBuilder/StringBuffer 拼接 SQL
- 使用 Statement 而非 PreparedStatement
- JPA/Hibernate 中使用字符串拼接构造 JPQL/HQL

**PHP 场景：**
- 使用变量直接插入 SQL 字符串
- 使用 mysql_* 函数（已废弃）而非 PDO 预处理
- 使用 $_GET/$_POST 直接拼接到 SQL

### 误报排除
- 使用 ORM 的参数化查询（如 SQLAlchemy 的 `session.query().filter()`）
- 使用预处理语句（PreparedStatement）且未拼接用户输入
- 使用查询构建器的参数绑定方法
- 输入经过严格白名单校验（非黑名单过滤）的场景

### 修复建议
1. **使用参数化查询/预处理语句**：这是防御 SQL 注入最有效的方法
2. **使用 ORM 框架**：如 SQLAlchemy、Hibernate 等，它们默认使用参数化查询
3. **输入验证**：对用户输入进行白名单校验，拒绝不符合预期的输入
4. **最小权限原则**：数据库连接使用最低必要权限的账户
---

请严格按照上述格式和质量标准，根据用户的描述生成规则。如果用户的描述过于简短或模糊，请根据专业经验合理补充和扩展，确保规则完整可用。"""


async def generate_audit_rule(
    description: str,
    positive_example: Optional[str] = None,
    negative_example: Optional[str] = None,
    user_config: Optional[dict] = None,
    language: str = "zh",
) -> str:
    """
    根据用户的自然语言描述，生成代码审计规则。

    Args:
        description: 用户的规则简述，如"检测 SQL 注入"、"检查硬编码密码"等
        positive_example: 正样例描述，应该被报告的情况（可选）
        negative_example: 反样例描述，不应被报告的情况（可选）
        user_config: 用户配置，包含 LLM 连接信息
        language: 输出语言，默认中文

    Returns:
        生成的规则文本
    """
    llm_service = LLMService(user_config=user_config)
    adapter = LLMFactory.create_adapter(llm_service.config)

    # 构建用户提示
    if language == "zh":
        user_prompt = f"请根据以下描述生成代码审计规则：\n\n{description}"
        if positive_example:
            user_prompt += f"\n\n【正样例】应该被报告的情况：\n{positive_example}"
        if negative_example:
            user_prompt += f"\n\n【反样例】不应被报告的情况：\n{negative_example}"
    else:
        user_prompt = f"Please generate a code audit rule based on the following description:\n\n{description}"
        if positive_example:
            user_prompt += f"\n\n【Positive Example】Cases that should be reported:\n{positive_example}"
        if negative_example:
            user_prompt += f"\n\n【Negative Example】Cases that should NOT be reported:\n{negative_example}"

    try:
        request = LLMRequest(
            messages=[
                LLMMessage(role="system", content=RULE_GENERATION_SYSTEM_PROMPT),
                LLMMessage(role="user", content=user_prompt),
            ],
            temperature=0.3,  # 规则生成需要较低随机性，保证输出稳定
            max_tokens=4096,
        )

        response = await adapter.complete(request)

        if response and response.content:
            rule_content = response.content.strip()
            logger.info(f"规则生成成功，输入: {description[:50]}..., 输出长度: {len(rule_content)}")
            return rule_content
        else:
            logger.warning(f"规则生成返回空结果，输入: {description[:50]}")
            return ""

    except Exception as e:
        logger.error(f"规则生成失败: {e}")
        raise
