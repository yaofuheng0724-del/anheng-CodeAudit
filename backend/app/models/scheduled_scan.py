import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ScheduledScan(Base):
    __tablename__ = "scheduled_scans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    scan_mode = Column(String(20), nullable=False, default="fast")
    branch_name = Column(String, nullable=True)
    interval_minutes = Column(Integer, nullable=False, default=60)
    time_window_start = Column(String(5), nullable=True)
    time_window_end = Column(String(5), nullable=True)
    timezone = Column(String(64), nullable=False, default="Asia/Shanghai")
    rule_set_id = Column(String, nullable=True)
    prompt_template_id = Column(String, nullable=True)
    exclude_patterns = Column(Text, default="[]")
    file_paths = Column(Text, default="[]")
    function_whitelist = Column(Text, default="[]")
    vulnerability_whitelist = Column(Text, default="[]")
    sanitizer_functions = Column(Text, default="[]")
    is_active = Column(Boolean, default=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project")
    creator = relationship("User", foreign_keys=[created_by])
