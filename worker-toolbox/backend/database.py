"""
数据库配置 — SQLAlchemy 引擎、会话工厂、依赖注入。
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base

from backend.config import config

engine = create_engine(
    config.db_url,
    connect_args={"check_same_thread": False} if "sqlite" in config.db_url else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI 依赖注入：每次请求提供独立的数据库会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
