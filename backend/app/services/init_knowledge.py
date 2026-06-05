"""
初始化系统内置漏洞知识库。
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_entry import KnowledgeEntry
from app.services.agent.knowledge.rag_knowledge import security_knowledge_rag

logger = logging.getLogger(__name__)


def _build_entry_content(doc) -> str:
    sections = [doc.content.strip()]
    references = []

    if doc.severity:
        references.append(f"严重程度: {doc.severity}")
    if doc.cwe_ids:
        references.append(f"CWE: {', '.join(doc.cwe_ids)}")
    if doc.owasp_ids:
        references.append(f"OWASP: {', '.join(doc.owasp_ids)}")
    if doc.tags:
        references.append(f"标签: {', '.join(doc.tags)}")

    if references:
        sections.append("参考信息:\n" + "\n".join(f"- {item}" for item in references))

    return "\n\n".join(sections)


async def init_builtin_knowledge_entries(db: AsyncSession, created_by: str) -> None:
    """将 Agent 内置通用安全知识补种到系统知识库。"""
    created = 0

    for doc in security_knowledge_rag._builtin_knowledge:
        result = await db.execute(
            select(KnowledgeEntry).where(
                KnowledgeEntry.title == doc.title,
                KnowledgeEntry.category == doc.category.value,
            )
        )
        if result.scalar_one_or_none():
            continue

        db.add(
            KnowledgeEntry(
                title=doc.title,
                category=doc.category.value,
                language=doc.metadata.get("language", "all") if doc.metadata else "all",
                content=_build_entry_content(doc),
                is_active=True,
                created_by=created_by,
            )
        )
        created += 1

    if created:
        await db.commit()
        logger.info("✓ 创建系统内置知识条目: %s 条", created)
    else:
        logger.info("系统内置知识库已存在，无需补种")
