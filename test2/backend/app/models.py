from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow():
    # SQLite stores naive datetimes; all stored values are UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'confirmed', 'published')"),
        CheckConstraint("readiness_score IS NULL OR readiness_score BETWEEN 0 AND 100"),
        CheckConstraint("readiness_level IS NULL OR readiness_level IN ('draft', 'workable', 'ready', 'priority')"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    description: Mapped[str] = mapped_column(Text)
    topic: Mapped[str] = mapped_column(String(100), default="", server_default="")
    ai_analysis: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    title: Mapped[str] = mapped_column(String(200), default="")
    context: Mapped[str] = mapped_column(Text, default="")
    need: Mapped[str] = mapped_column(Text, default="")
    users: Mapped[str] = mapped_column(Text, default="")
    data_materials: Mapped[str] = mapped_column(Text, default="")
    constraints: Mapped[str] = mapped_column(Text, default="")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    success_criteria: Mapped[str] = mapped_column(Text, default="")
    contact: Mapped[str] = mapped_column(Text, default="")
    interaction_format: Mapped[str] = mapped_column(Text, default="")
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    readiness_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    readiness_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    score_breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    @property
    def rating(self):
        from .services import rating_for
        return rating_for(self)


class Proposal(Base):
    __tablename__ = "proposals"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'accepted', 'rejected')"),
        Index("one_accepted_proposal_per_task", "task_id", unique=True,
              sqlite_where=text("status = 'accepted'")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), index=True)
    team_name: Mapped[str] = mapped_column(String(200))
    contact: Mapped[str] = mapped_column(String(500))
    message: Mapped[str] = mapped_column(Text)
    solution_idea: Mapped[str] = mapped_column(Text, default="", server_default="")
    plan: Mapped[str] = mapped_column(Text, default="", server_default="")
    estimated_duration: Mapped[str] = mapped_column(String(200), default="", server_default="")
    prototype_url: Mapped[str] = mapped_column(String(2000), default="", server_default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
