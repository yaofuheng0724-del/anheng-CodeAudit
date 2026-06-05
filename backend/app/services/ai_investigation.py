"""
AI排查服务 — 对单个漏洞进行 LLM 复查，生成修复建议

使用轻量级 LLM 直接调用（非多 Agent 框架），复用 LLMService 基础设施。
单个排查约 1-2 分钟，批量排查顺序处理（间隔 2 秒避免限流）。
"""

import json
import re
import logging
import asyncio
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Callable

from app.services.llm.service import LLMService

logger = logging.getLogger(__name__)

# ============ 进度跟踪 ============

# 内存中的批量排查进度（key=batch_id）
_batch_progress: Dict[str, Dict[str, Any]] = {}
_batch_lock = asyncio.Lock()


def get_batch_progress(batch_id: str) -> Optional[Dict[str, Any]]:
    """获取批量排查进度"""
    return _batch_progress.get(batch_id)


def set_batch_progress(batch_id: str, data: Dict[str, Any]) -> None:
    """设置批量排查进度"""
    _batch_progress[batch_id] = data


def clear_batch_progress(batch_id: str) -> None:
    """清理批量排查进度"""
    _batch_progress.pop(batch_id, None)


# ============ Prompt 设计 ============

SYSTEM_PROMPT = """你是一个安全代码审计员，对已报告的漏洞进行复查验证。

输出要求：只输出一个JSON对象，不要输出任何其他内容（不要用markdown代码块包裹，不要加说明文字）。

JSON schema:
{"verdict":"confirmed|false_positive|uncertain","reasoning":"分析推理","suggestion":"修复建议","fix_code":"修复代码或空字符串","confidence":0.0到1.0,"source":"污点源描述","sink":"危险操作描述","dataflow_path":[{"step":1,"type":"source","file":"文件路径","line":行号,"code":"源代码","label":"步骤标签","operation":"input|assignment|call"},{"step":2,"type":"sink","file":"文件路径","line":行号,"code":"源代码","label":"步骤标签","operation":"call"}]}

verdict含义：confirmed=确认漏洞存在需修复，false_positive=确认误报，uncertain=无法确定。

source和sink含义：source=污点数据来源（如用户输入、外部参数），sink=危险操作目标（如SQL执行、命令执行、HTML输出）。
dataflow_path含义：从source到sink的数据传播路径步骤列表，step字段为步骤序号，type为source/propagation/sink，operation为input/assignment/call/parameter/return/sanitize。

对于注入类漏洞（SQL注入、XSS、命令注入、路径遍历、SSRF等），必须提供source、sink和dataflow_path。
对于非数据流类漏洞（硬编码密钥、弱加密等），source/sink/dataflow_path可以为空字符串或空数组。

示例输出：
{"verdict":"confirmed","reasoning":"用户输入未经过滤直接拼入SQL语句","suggestion":"使用参数化查询","fix_code":"cursor.execute('SELECT * FROM users WHERE id=?',(user_id,))","confidence":0.9,"source":"用户输入 request.GET['id']","sink":"cursor.execute() 拼接 SQL","dataflow_path":[{"step":1,"type":"source","file":"app/views.py","line":10,"code":"id = request.GET['id']","label":"用户输入","operation":"input"},{"step":2,"type":"sink","file":"app/views.py","line":15,"code":"cursor.execute(sql)","label":"SQL执行","operation":"call"}]}"""


INVESTIGATION_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {
            "type": "string",
            "enum": ["confirmed", "false_positive", "uncertain"],
        },
        "reasoning": {"type": "string"},
        "suggestion": {"type": "string"},
        "fix_code": {"type": "string"},
        "confidence": {"type": "number"},
        "source": {"type": "string"},
        "sink": {"type": "string"},
        "dataflow_path": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "step": {"type": "number"},
                    "type": {"type": "string"},
                    "file": {"type": "string"},
                    "line": {"type": "number"},
                    "code": {"type": "string"},
                    "label": {"type": "string"},
                    "operation": {"type": "string"},
                },
            },
        },
    },
    "required": ["verdict", "reasoning", "suggestion", "fix_code", "confidence"],
}


def build_investigation_prompt(issue_data: Dict[str, Any]) -> str:
    """构造排查 Prompt — 紧凑格式，减少 token 消耗"""
    parts = []

    vuln_type = issue_data.get("vulnerability_type") or issue_data.get("issue_type") or "未知"
    severity = issue_data.get("severity") or "未知"
    file_path = issue_data.get("file_path", "")
    line_number = issue_data.get("line_number") or issue_data.get("line_start")
    title = issue_data.get("title", "")
    description = issue_data.get("description") or issue_data.get("message", "")
    suggestion = issue_data.get("suggestion", "")
    code_snippet = issue_data.get("code_snippet", "")
    code_context = issue_data.get("code_context", "")

    # 核心信息
    header = f"[{severity}] {vuln_type}"
    if title:
        header += f": {title}"
    if file_path:
        header += f" @ {file_path}"
        if line_number:
            header += f":{line_number}"
    parts.append(header)

    if description:
        parts.append(f"描述: {description}")
    if suggestion:
        parts.append(f"建议: {suggestion}")
    if code_snippet:
        parts.append(f"代码:\n{code_snippet}")
    if code_context:
        parts.append(f"上下文:\n{code_context}")

    parts.append("判断此漏洞是否真实存在，输出JSON。")
    return "\n\n".join(parts)


# ============ AI排查服务 ============

def _parse_investigation_json(text: str) -> Dict[str, Any]:
    """轻量级 JSON 解析 — 专为 AI 排查设计

    优先直接解析（response_format 模式下 LLM 输出纯 JSON），
    不再走 LLMService 的 7 种方法兜底解析，避免不必要的时间消耗。
    """
    if not text or not text.strip():
        logger.error("AI排查: LLM 响应为空")
        return {"verdict": "uncertain", "reasoning": "LLM响应为空"}

    s = text.strip()

    # 1. 直接解析（response_format 模式下通常直接成功）
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass

    # 2. 去掉 markdown 代码块包裹
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', s, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # 3. 提取第一个完整的 JSON 对象 {...}
    start = s.find('{')
    end = s.rfind('}')
    if start != -1 and end > start:
        try:
            return json.loads(s[start:end + 1])
        except json.JSONDecodeError:
            pass

    logger.error(f"AI排查: JSON 解析全部失败, 原始内容长度={len(s)}")
    return {"verdict": "uncertain", "reasoning": f"JSON解析失败，原始响应: {s[:200]}"}


class AIInvestigationService:
    """AI排查服务"""

    def __init__(self, user_config: Optional[Dict[str, Any]] = None):
        self.llm_service = LLMService(user_config=user_config)

    async def investigate_issue(self, issue_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        对单个漏洞进行 AI 排查

        Args:
            issue_data: 漏洞信息字典（包含 file_path, severity, description, code_snippet 等）

        Returns:
            排查结果字典：verdict, reasoning, suggestion, fix_code, confidence, analyzed_at
        """
        prompt = build_investigation_prompt(issue_data)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        try:
            t0 = time.monotonic()

            # 使用 response_format 强制 JSON 输出（支持的模型会直接输出纯 JSON）
            result = await self.llm_service.chat_completion(
                messages=messages,
                temperature=0.1,
                max_tokens=1024,
                response_format={"type": "json_object"},
            )
            elapsed = time.monotonic() - t0
            logger.info(f"AI排查 LLM 调用耗时: {elapsed:.2f}s")

            content = result.get("content", "")
            parsed = _parse_investigation_json(content)

            # 提取结构化字段
            verdict = parsed.get("verdict", "uncertain")
            if verdict not in ("confirmed", "false_positive", "uncertain"):
                verdict = "uncertain"

            return {
                "verdict": verdict,
                "reasoning": parsed.get("reasoning", ""),
                "suggestion": parsed.get("suggestion", ""),
                "fix_code": parsed.get("fix_code", ""),
                "confidence": float(parsed.get("confidence", 0.5)),
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            logger.error(f"AI排查失败: {e}", exc_info=True)
            return {
                "verdict": "error",
                "reasoning": f"AI排查调用失败: {str(e)}",
                "suggestion": "",
                "fix_code": "",
                "confidence": 0.0,
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
            }


async def execute_single_investigation(
    issue_id: str,
    issue_type: str,  # "audit" or "agent"
    user_config: Optional[Dict[str, Any]],
) -> None:
    """
    后台执行单个漏洞的 AI 排查

    使用 async_session_factory 创建数据库会话，
    读取漏洞信息、调用 AI、更新 ai_suggestion 字段。
    """
    from app.db.session import async_session_factory
    from app.models.audit import AuditIssue
    from app.models.agent_task import AgentFinding
    from sqlalchemy import select

    service = AIInvestigationService(user_config=user_config)

    async with async_session_factory() as db:
        try:
            if issue_type == "audit":
                result = await db.execute(
                    select(AuditIssue).where(AuditIssue.id == issue_id)
                )
                issue = result.scalars().first()
                if not issue:
                    logger.warning(f"AI排查: AuditIssue {issue_id} 不存在")
                    return

                issue_data = {
                    "issue_type": issue.issue_type,
                    "severity": issue.severity,
                    "file_path": issue.file_path,
                    "line_number": issue.line_number,
                    "title": issue.title,
                    "description": issue.description or issue.message,
                    "suggestion": issue.suggestion,
                    "code_snippet": issue.code_snippet,
                }

                ai_result = await service.investigate_issue(issue_data)
                issue.ai_suggestion = json.dumps(ai_result, ensure_ascii=False)

                # 更新数据流路径字段（AI排查可补充/覆盖原有数据流）
                if ai_result.get("source"):
                    issue.source = ai_result["source"]
                if ai_result.get("sink"):
                    issue.sink = ai_result["sink"]
                if ai_result.get("dataflow_path"):
                    issue.dataflow_path = json.dumps(ai_result["dataflow_path"], ensure_ascii=False)

            elif issue_type == "agent":
                result = await db.execute(
                    select(AgentFinding).where(AgentFinding.id == issue_id)
                )
                finding = result.scalars().first()
                if not finding:
                    logger.warning(f"AI排查: AgentFinding {issue_id} 不存在")
                    return

                issue_data = {
                    "vulnerability_type": finding.vulnerability_type,
                    "severity": finding.severity,
                    "file_path": finding.file_path,
                    "line_start": finding.line_start,
                    "title": finding.title,
                    "description": finding.description,
                    "suggestion": finding.suggestion,
                    "code_snippet": finding.code_snippet,
                    "code_context": finding.code_context,
                }

                ai_result = await service.investigate_issue(issue_data)
                finding.ai_suggestion = json.dumps(ai_result, ensure_ascii=False)

                # 更新数据流路径字段（AI排查可补充/覆盖原有数据流）
                if ai_result.get("source") and not finding.source:
                    finding.source = ai_result["source"]
                if ai_result.get("sink") and not finding.sink:
                    finding.sink = ai_result["sink"]
                if ai_result.get("dataflow_path") and not finding.dataflow_path:
                    finding.dataflow_path = json.dumps(ai_result["dataflow_path"], ensure_ascii=False)

            await db.commit()
            logger.info(f"AI排查完成: {issue_type}/{issue_id} → verdict={ai_result.get('verdict')}")

        except Exception as e:
            logger.error(f"AI排查后台执行失败: {e}", exc_info=True)
            # 即使失败也记录错误状态
            try:
                if issue_type == "audit":
                    result = await db.execute(
                        select(AuditIssue).where(AuditIssue.id == issue_id)
                    )
                    issue = result.scalars().first()
                    if issue:
                        issue.ai_suggestion = json.dumps({
                            "verdict": "error",
                            "reasoning": f"AI排查失败: {str(e)}",
                            "analyzed_at": datetime.now(timezone.utc).isoformat(),
                        }, ensure_ascii=False)
                        await db.commit()
                elif issue_type == "agent":
                    result = await db.execute(
                        select(AgentFinding).where(AgentFinding.id == issue_id)
                    )
                    finding = result.scalars().first()
                    if finding:
                        finding.ai_suggestion = json.dumps({
                            "verdict": "error",
                            "reasoning": f"AI排查失败: {str(e)}",
                            "analyzed_at": datetime.now(timezone.utc).isoformat(),
                        }, ensure_ascii=False)
                        await db.commit()
            except Exception as e2:
                logger.error(f"AI排查错误状态记录失败: {e2}")


async def execute_batch_investigation(
    batch_id: str,
    issue_ids: List[str],
    issue_types: List[str],  # "audit" or "agent" for each
    user_config: Optional[Dict[str, Any]],
) -> None:
    """
    后台执行批量 AI 排查

    顺序处理每个漏洞，间隔 2 秒避免限流，
    进度通过 _batch_progress 内存 dict 跟踪。
    """
    service = AIInvestigationService(user_config=user_config)
    total = len(issue_ids)
    completed = 0

    await set_batch_progress(batch_id, {
        "total": total,
        "completed": 0,
        "current_issue": "",
        "status": "running",
    })

    for i, (issue_id, issue_type) in enumerate(zip(issue_ids, issue_types)):
        # 更新进度
        current_title = f"正在排查 {issue_type}/{issue_id}"
        await _batch_lock.acquire()
        try:
            _batch_progress[batch_id] = {
                "total": total,
                "completed": completed,
                "current_issue": current_title,
                "status": "running",
            }
        finally:
            _batch_lock.release()

        # 执行排查
        await execute_single_investigation(issue_id, issue_type, user_config)
        completed += 1

        # 间隔 2 秒
        if i < total - 1:
            await asyncio.sleep(2)

    # 完成标记
    await _batch_lock.acquire()
    try:
        _batch_progress[batch_id] = {
            "total": total,
            "completed": completed,
            "current_issue": "",
            "status": "completed",
        }
    finally:
        _batch_lock.release()

    logger.info(f"批量AI排查完成: batch_id={batch_id}, completed={completed}/{total}")