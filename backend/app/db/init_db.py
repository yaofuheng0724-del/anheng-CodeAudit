"""
数据库初始化模块
在应用启动时创建默认管理员账户
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.security import get_password_hash
from app.models.user import User

logger = logging.getLogger(__name__)

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "Admin@123456"
DEFAULT_ADMIN_NAME = "系统管理员"


async def create_default_admin(db: AsyncSession) -> User | None:
    """确保默认管理员账户存在。"""
    result = await db.execute(
        select(User).where(User.username == DEFAULT_ADMIN_USERNAME)
    )
    admin_user = result.scalars().first()

    if admin_user:
        logger.info("默认管理员已存在: %s", DEFAULT_ADMIN_USERNAME)
        return admin_user

    admin_user = User(
        username=DEFAULT_ADMIN_USERNAME,
        email=None,
        hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
        full_name=DEFAULT_ADMIN_NAME,
        is_active=True,
        is_superuser=True,
        role="admin",
    )
    db.add(admin_user)
    await db.flush()
    logger.info("✓ 创建默认管理员账户: %s", DEFAULT_ADMIN_USERNAME)
    return admin_user


async def init_db(db: AsyncSession) -> None:
    """初始化数据库。"""
    logger.info("开始初始化数据库...")

    admin_user = await create_default_admin(db)
    await db.commit()

    try:
        from app.services.init_templates import init_templates_and_rules

        await init_templates_and_rules(db)
    except Exception as exc:
        logger.warning("初始化模板和规则跳过: %s", exc)

    try:
        if admin_user:
            from app.services.init_knowledge import init_builtin_knowledge_entries

            await init_builtin_knowledge_entries(db, admin_user.id)
    except Exception as exc:
        logger.warning("初始化知识库跳过: %s", exc)

    logger.info("数据库初始化完成")
