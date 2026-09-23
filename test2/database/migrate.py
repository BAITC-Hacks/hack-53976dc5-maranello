"""Small, transactional v1→v2 SQLite upgrade. Never drops existing tables/data."""
import os

from sqlalchemy import inspect, select, update
from sqlalchemy.orm import Session

from backend.app.database import Base, make_engine
from backend.app.models import Task
from backend.app.services import calculate_readiness

ADDITIONS = {
    "tasks": {"topic": "VARCHAR(100) NOT NULL DEFAULT ''",
              "ai_analysis": "JSON NOT NULL DEFAULT '{}'"},
    "proposals": {"solution_idea": "TEXT NOT NULL DEFAULT ''", "plan": "TEXT NOT NULL DEFAULT ''",
                  "estimated_duration": "VARCHAR(200) NOT NULL DEFAULT ''",
                  "prototype_url": "VARCHAR(2000) NOT NULL DEFAULT ''"},
}


def initialize_database(engine):
    with engine.connect() as connection:
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        try:
            version = connection.exec_driver_sql("PRAGMA user_version").scalar()
            if version > 2:
                raise RuntimeError("Database schema is newer than this application")
            Base.metadata.create_all(connection)
            if version < 2:
                for table, additions in ADDITIONS.items():
                    columns = {column["name"] for column in inspect(connection).get_columns(table)}
                    for name, definition in additions.items():
                        if name not in columns:
                            connection.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")
                connection.exec_driver_sql("UPDATE proposals SET solution_idea = message WHERE solution_idea = ''")
                with Session(bind=connection) as session:
                    for task in session.scalars(select(Task)).all():
                        score, level, breakdown = calculate_readiness(task)
                        connection.execute(update(Task).where(Task.id == task.id).values(
                            readiness_score=score, readiness_level=level, score_breakdown=breakdown,
                            updated_at=task.updated_at,
                        ))
                connection.exec_driver_sql("PRAGMA user_version=2")
            connection.commit()
        except Exception:
            connection.rollback()
            raise


if __name__ == "__main__":
    engine = make_engine(os.getenv("DATABASE_URL", "sqlite:///./database/app.db"))
    try:
        initialize_database(engine)
        print("SQLite schema v2 ready")
    finally:
        engine.dispose()
