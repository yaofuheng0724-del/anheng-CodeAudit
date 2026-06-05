"""
AI 规则生成 API 端点

用户输入自然语言描述，调用 LLM 生成结构化的代码审计规则。
"""

import json
import time
import traceback
import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.api import deps
from app.db.session import get_db
from app.models.user_config import UserConfig
from app.models.user import User
from app.core.encryption import decrypt_sensitive_data
from app.services.rule_generator import generate_audit_rule

logger = logging.getLogger(__name__)

router = APIRouter()

# 需要加密的敏感字段列表
SENSITIVE_LLM_FIELDS = [
    'llmApiKey', 'geminiApiKey', 'openaiApiKey', 'claudeApiKey',
    'qwenApiKey', 'deepseekApiKey', 'zhipuApiKey', 'moonshotApiKey',
    'baiduApiKey', 'minimaxApiKey', 'doubaoApiKey'
]


class RuleGenerateRequest(BaseModel):
    """规则生成请求"""
    description: str
    positive_example: Optional[str] = None  # 正样例描述（可选）
    negative_example: Optional[str] = None  # 反样例描述（可选）
    language: Optional[str] = "zh"  # 输出语言，默认中文


class RuleGenerateResponse(BaseModel):
    """规则生成响应"""
    success: bool
    rule: Optional[str] = None
    content: Optional[str] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None


@router.post("/generate", response_model=RuleGenerateResponse)
async def generate_rule(
    request: RuleGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    根据用户描述，调用 LLM 生成代码审计规则。

    用户输入自然语言简述（如"检测 SQL 注入"、"检查硬编码密码"等），
    LLM 会生成完整的、结构化的审计规则文本。
    """
    if not request.description or not request.description.strip():
        raise HTTPException(status_code=400, detail="规则描述不能为空")

    start_time = time.time()

    try:
        # 获取用户 LLM 配置
        result_config = await db.execute(
            select(UserConfig).where(UserConfig.user_id == current_user.id)
        )
        config = result_config.scalar_one_or_none()

        user_config = {}
        if config:
            llm_config = json.loads(config.llm_config) if config.llm_config else {}
            for field in SENSITIVE_LLM_FIELDS:
                if field in llm_config and llm_config[field]:
                    llm_config[field] = decrypt_sensitive_data(llm_config[field])
            user_config = {'llmConfig': llm_config}

        # 调用规则生成服务
        rule_content = await generate_audit_rule(
            description=request.description.strip(),
            positive_example=request.positive_example.strip() if request.positive_example else None,
            negative_example=request.negative_example.strip() if request.negative_example else None,
            user_config=user_config,
            language=request.language or "zh",
        )

        execution_time = time.time() - start_time

        if rule_content:
            logger.info(f"规则生成成功: 用户={current_user.id}, 描述={request.description[:30]}..., 耗时={execution_time:.2f}s")
            return RuleGenerateResponse(
                success=True,
                rule=rule_content,
                content=rule_content,
                execution_time=round(execution_time, 2),
            )
        else:
            logger.warning(f"规则生成返回空结果: 用户={current_user.id}, 描述={request.description[:30]}")
            return RuleGenerateResponse(
                success=False,
                error="LLM 返回空结果，请稍后重试",
                execution_time=round(execution_time, 2),
            )

    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"规则生成失败: {e}\n{traceback.format_exc()}")
        return RuleGenerateResponse(
            success=False,
            error=str(e),
            execution_time=round(execution_time, 2),
        )