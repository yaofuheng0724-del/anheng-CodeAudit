from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    # 连接池配置：后台扫描任务会长时间持有会话，需要更大的池
    pool_size=10,          # 常驻连接数（默认5，扫描任务占满后正常请求无法获取连接）
    max_overflow=20,       # 超出 pool_size 后允许的临时连接数（默认10）
    pool_timeout=60,       # 等待连接的超时秒数（默认30，避免前端轮询时反复触发 TimeoutError）
    pool_recycle=1800,     # 每 30 分钟回收连接（避免 PostgreSQL idle session 被服务端断开）
    pool_pre_ping=True,    # 每次借出连接前先检测是否存活（防止 stale connection 导致请求失败）
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


@asynccontextmanager
async def async_session_factory():
    """Async context manager for creating database sessions"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()






