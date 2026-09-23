import os
from contextlib import asynccontextmanager
from typing import List, Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.migrate import initialize_database

from .ai import TaskAI
from .database import make_engine, session_factory
from .models import Proposal, Task, TeamProfile, utcnow
from .schemas import (AnswersSubmit, Card, CardPatch, HealthRead, Level, ProposalCreate, ProposalDecision,
                      ProposalRead, QuestionsRead, RatingRead, TaskCreate, TaskRead, TeamProfileRead)
from .services import confirm_task, questions_for, refresh_rating, reset_confirmation


def get_db(request: Request):
    with request.app.state.session_factory() as session:
        yield session


def get_task(db, task_id):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    return task


def require_editable(task):
    if task.status == "published":
        raise HTTPException(409, "Published tasks cannot be edited in this MVP")


def save(db, obj):
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Database constraint conflict; only one proposal can be accepted per task")
    db.refresh(obj)
    return obj


def create_app(database_url=None, ai_service=None):
    @asynccontextmanager
    async def lifespan(app):
        engine = make_engine(database_url or os.getenv("DATABASE_URL", "sqlite:///./database/app.db"))
        try:
            initialize_database(engine)
            app.state.session_factory = session_factory(engine)
            app.state.ai = ai_service if ai_service is not None else TaskAI.from_env()
            yield
        finally:
            engine.dispose()

    application = FastAPI(title="Business × Students MVP", version="0.2.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",") if origin.strip()],
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type"],
    )

    @application.get("/health", response_model=HealthRead)
    def health(db: Session = Depends(get_db)):
        db.execute(text("SELECT 1"))
        return {"status": "ok"}

    @application.get("/api/teams", response_model=List[TeamProfileRead])
    def list_teams(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                   db: Session = Depends(get_db)):
        return db.scalars(select(TeamProfile).order_by(TeamProfile.id).offset(offset).limit(limit)).all()

    @application.post("/api/tasks", response_model=TaskRead, status_code=201)
    def create_task(payload: TaskCreate, request: Request, db: Session = Depends(get_db)):
        card, analysis = request.app.state.ai.prepare(payload.description)
        task = Task(description=payload.description, topic=payload.topic.casefold(),
                    ai_analysis=analysis, **card.model_dump())
        refresh_rating(task)
        return save(db, task)

    @application.get("/api/tasks", response_model=List[TaskRead])
    def catalog(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                sort: Literal["rating_desc", "rating_asc", "newest"] = "rating_desc",
                topic: Optional[str] = Query(None, min_length=1, max_length=100),
                level: Optional[Level] = None,
                db: Session = Depends(get_db)):
        statement = select(Task).where(Task.status == "published")
        if topic is not None:
            statement = statement.where(Task.topic == topic.strip().casefold())
        if level is not None:
            statement = statement.where(Task.readiness_level == level)
        ordering = {"rating_desc": Task.readiness_score.desc(),
                    "rating_asc": Task.readiness_score.asc(), "newest": Task.published_at.desc()}
        return db.scalars(statement.order_by(ordering[sort], Task.id.desc())
                          .offset(offset).limit(limit)).all()

    @application.get("/api/tasks/{task_id}", response_model=TaskRead)
    def read_task(task_id: int, db: Session = Depends(get_db)):
        return get_task(db, task_id)

    @application.get("/api/tasks/{task_id}/rating", response_model=RatingRead)
    def read_rating(task_id: int, db: Session = Depends(get_db)):
        return get_task(db, task_id).rating

    @application.get("/api/tasks/{task_id}/questions", response_model=QuestionsRead)
    def read_questions(task_id: int, db: Session = Depends(get_db)):
        return questions_for(get_task(db, task_id))

    @application.post("/api/tasks/{task_id}/answers", response_model=TaskRead)
    def submit_answers(task_id: int, payload: AnswersSubmit, request: Request, db: Session = Depends(get_db)):
        task = get_task(db, task_id)
        require_editable(task)
        answers = dict(task.answers)
        for answer in payload.answers:
            answers[answer.field] = answer.answer
            setattr(task, answer.field, answer.answer)
        task.answers = answers
        card, analysis = request.app.state.ai.prepare(
            task.description, Card.model_validate(task).model_dump()
        )
        for field, value in card.model_dump().items():
            setattr(task, field, value)
        task.ai_analysis = analysis
        reset_confirmation(task)
        return save(db, task)

    @application.patch("/api/tasks/{task_id}", response_model=TaskRead)
    def edit_card(task_id: int, payload: CardPatch, db: Session = Depends(get_db)):
        task = get_task(db, task_id)
        require_editable(task)
        changes = payload.model_dump(exclude_unset=True)
        if not changes:
            raise HTTPException(422, "Provide at least one card field")
        for field, value in changes.items():
            setattr(task, field, value.casefold() if field == "topic" else value)
        reset_confirmation(task)
        return save(db, task)

    @application.post("/api/tasks/{task_id}/confirm", response_model=TaskRead)
    def confirm(task_id: int, db: Session = Depends(get_db)):
        task = get_task(db, task_id)
        if task.status in ("confirmed", "published"):
            return task
        if len(task.answers) < 3:
            raise HTTPException(409, "Submit at least three distinct clarification answers first")
        confirm_task(task)
        return save(db, task)

    @application.post("/api/tasks/{task_id}/publish", response_model=TaskRead)
    def publish(task_id: int, db: Session = Depends(get_db)):
        task = get_task(db, task_id)
        if task.status == "published":
            return task
        if task.status != "confirmed":
            raise HTTPException(409, "Confirm the card before publishing")
        task.status = "published"
        task.published_at = utcnow()
        return save(db, task)

    @application.post("/api/tasks/{task_id}/proposals", response_model=ProposalRead, status_code=201)
    def submit_proposal(task_id: int, payload: ProposalCreate, db: Session = Depends(get_db)):
        task = get_task(db, task_id)
        if task.status != "published":
            raise HTTPException(409, "Proposals are only available for published tasks")
        return save(db, Proposal(task_id=task_id, message=payload.solution_idea, **payload.model_dump()))

    @application.get("/api/tasks/{task_id}/proposals", response_model=List[ProposalRead])
    def list_proposals(task_id: int, limit: int = Query(50, ge=1, le=100),
                       offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
        get_task(db, task_id)
        return db.scalars(select(Proposal).where(Proposal.task_id == task_id)
                          .order_by(Proposal.id).offset(offset).limit(limit)).all()

    @application.patch("/api/proposals/{proposal_id}", response_model=ProposalRead)
    def decide_proposal(proposal_id: int, payload: ProposalDecision, db: Session = Depends(get_db)):
        proposal = db.get(Proposal, proposal_id)
        if proposal is None:
            raise HTTPException(404, "Proposal not found")
        if proposal.status == payload.status:
            return proposal
        if proposal.status != "pending":
            raise HTTPException(409, "The proposal decision is final in this MVP")
        try:
            changed = db.execute(update(Proposal).where(
                Proposal.id == proposal_id, Proposal.status == "pending"
            ).values(status=payload.status, decided_at=utcnow()),
                execution_options={"synchronize_session": False})
            if changed.rowcount != 1:
                db.rollback()
                db.refresh(proposal)
                if proposal.status == payload.status:
                    return proposal
                raise HTTPException(409, "The proposal decision is final in this MVP")
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Only one proposal can be accepted per task")
        db.refresh(proposal)
        return proposal

    return application


app = create_app()
