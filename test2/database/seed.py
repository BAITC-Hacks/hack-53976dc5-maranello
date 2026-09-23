"""Idempotent demo data loader: python -m database.seed (from project root)."""
import json
import os

from sqlalchemy import select

from backend.app.database import ROOT, make_engine, session_factory
from backend.app.models import Proposal, Task, utcnow
from backend.app.services import confirm_task, refresh_rating
from database.migrate import initialize_database


def seed(database_url=None):
    engine = make_engine(database_url or os.getenv("DATABASE_URL", "sqlite:///./database/app.db"))
    initialize_database(engine)
    data = json.loads((ROOT / "database/seed_data.json").read_text(encoding="utf-8"))
    added_tasks = added_proposals = 0
    try:
        with session_factory(engine)() as db:
            for item in data:
                # Reserved demo descriptions identify fixtures; never overwrite user edits.
                task = db.scalar(select(Task).where(Task.description == item["description"]))
                if task is None:
                    task = Task(description=item["description"], topic=item.get("topic", "").casefold(), **item["card"])
                    db.add(task)
                    db.flush()
                    refresh_rating(task)
                    if item["status"] != "draft":
                        task.answers = {field: getattr(task, field) for field in
                                        ("need", "expected_result", "success_criteria")}
                        confirm_task(task)
                        if item["status"] == "published":
                            task.status = "published"
                            task.published_at = utcnow()
                    added_tasks += 1
                for fixture in item.get("proposals", []):
                    existing = db.scalar(select(Proposal).where(
                        Proposal.task_id == task.id, Proposal.team_name == fixture["team_name"]
                    ))
                    if existing is None:
                        proposal = Proposal(task_id=task.id, message=fixture["solution_idea"], **fixture)
                        if fixture["status"] != "pending":
                            proposal.decided_at = utcnow()
                        db.add(proposal)
                        added_proposals += 1
            db.commit()
    finally:
        engine.dispose()
    return {"added_tasks": added_tasks, "added_proposals": added_proposals}


if __name__ == "__main__":
    print(json.dumps(seed(), ensure_ascii=False))
