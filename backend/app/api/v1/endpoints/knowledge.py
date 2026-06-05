from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.db.session import get_db
from app.models.knowledge_entry import KnowledgeEntry
from app.models.user import User

router = APIRouter()


class KnowledgeBase(BaseModel):
    title: str
    category: str = "security"
    language: str = "all"
    content: str
    is_active: bool = True


class KnowledgeUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None


class KnowledgeResponse(KnowledgeBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


def _serialize_entry(item: KnowledgeEntry) -> KnowledgeResponse:
    return KnowledgeResponse(
        id=item.id,
        title=item.title,
        category=item.category,
        language=item.language,
        content=item.content,
        is_active=item.is_active,
        created_by=item.created_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=List[KnowledgeResponse])
async def list_knowledge_entries(
    category: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    query = select(KnowledgeEntry).order_by(KnowledgeEntry.created_at.desc())
    if category:
        query = query.where(KnowledgeEntry.category == category)
    if language:
        query = query.where(KnowledgeEntry.language == language)
    if not current_user.is_superuser:
        query = query.where(KnowledgeEntry.is_active == True)
    result = await db.execute(query)
    entries = result.scalars().all()
    return [_serialize_entry(item) for item in entries]


@router.post("", response_model=KnowledgeResponse)
async def create_knowledge_entry(
    payload: KnowledgeBase,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    entry = KnowledgeEntry(
        title=payload.title,
        category=payload.category,
        language=payload.language,
        content=payload.content,
        is_active=payload.is_active,
        created_by=current_user.id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _serialize_entry(entry)


@router.put("/{entry_id}", response_model=KnowledgeResponse)
async def update_knowledge_entry(
    entry_id: str,
    payload: KnowledgeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    entry = await db.get(KnowledgeEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="知识条目不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return _serialize_entry(entry)


@router.delete("/{entry_id}")
async def delete_knowledge_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_superuser),
) -> Any:
    entry = await db.get(KnowledgeEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="知识条目不存在")
    await db.delete(entry)
    await db.commit()
    return {"message": "知识条目已删除"}
