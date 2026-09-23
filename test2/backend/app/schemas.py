from datetime import datetime, timezone
from typing import Annotated, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, TypeAdapter, field_serializer, field_validator, model_validator

CardField = Literal["title", "context", "need", "users", "data_materials", "constraints",
                    "expected_result", "success_criteria", "contact", "interaction_format"]
Text = Annotated[str, Field(max_length=10000)]
RequiredText = Annotated[str, Field(min_length=1, max_length=10000)]
Level = Literal["draft", "workable", "ready", "priority"]
Topic = Annotated[str, Field(max_length=100)]


class Schema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, from_attributes=True)


class TaskCreate(Schema):
    description: Annotated[str, Field(min_length=1, max_length=2000)]
    topic: Topic = ""


class Card(Schema):
    title: Annotated[str, Field(max_length=200)] = ""
    context: Text = ""
    need: Text = ""
    users: Text = ""
    data_materials: Text = ""
    constraints: Text = ""
    expected_result: Text = ""
    success_criteria: Text = ""
    contact: Text = ""
    interaction_format: Text = ""


class CardPatch(Card):
    topic: Topic = ""


class RatingComponent(Schema):
    key: str
    score: int
    max_score: int
    fields: List[CardField]
    missing_fields: List[CardField]


class RatingRead(Schema):
    score: int = Field(ge=0, le=100)
    level: Level
    breakdown: List[RatingComponent]
    missing_fields: List[CardField]
    recommendations: List[str]


class AIAnalysisRead(Schema):
    provider: Literal["mock", "openai", "fallback", "legacy"] = "legacy"
    fallback_reason: Optional[str] = None
    question_fields: List[CardField] = Field(default_factory=list)


class TaskRead(Card):
    id: int
    description: str
    topic: str
    ai_analysis: AIAnalysisRead
    rating: RatingRead
    answers: Dict[str, str]
    status: Literal["draft", "confirmed", "published"]
    readiness_score: int = Field(ge=0, le=100)
    readiness_level: Level
    score_breakdown: Dict[str, int]
    created_at: datetime
    updated_at: datetime
    confirmed_at: Optional[datetime]
    published_at: Optional[datetime]

    @field_serializer("created_at", "updated_at", "confirmed_at", "published_at")
    def serialize_utc(self, value):
        return value.replace(tzinfo=timezone.utc).isoformat() if value else None


class Answer(Schema):
    field: CardField
    answer: Text

    @model_validator(mode="after")
    def title_length(self):
        if self.field == "title" and len(self.answer) > 200:
            raise ValueError("Title must contain at most 200 characters")
        return self


class AnswersSubmit(Schema):
    answers: Annotated[List[Answer], Field(min_length=3, max_length=10)]

    @model_validator(mode="after")
    def unique_fields(self):
        if len({answer.field for answer in self.answers}) != len(self.answers):
            raise ValueError("Answer fields must be unique")
        return self


class Question(Schema):
    field: CardField
    question: str


class QuestionsRead(Schema):
    task_id: int
    missing_fields: List[CardField]
    questions: List[Question]
    ai_analysis: AIAnalysisRead


class ProposalCreate(Schema):
    team_name: Annotated[str, Field(min_length=1, max_length=200)]
    solution_idea: RequiredText
    plan: RequiredText
    estimated_duration: Annotated[str, Field(min_length=1, max_length=200)]
    prototype_url: Annotated[str, Field(max_length=2000)] = ""
    contact: Annotated[str, Field(max_length=500)] = ""

    @field_validator("prototype_url")
    @classmethod
    def validate_url(cls, value):
        if value:
            TypeAdapter(HttpUrl).validate_python(value)
        return value


class ProposalRead(Schema):
    # Legacy rows may lack plan/duration; read schemas must not fabricate values.
    team_name: str
    solution_idea: str
    plan: str
    estimated_duration: str
    prototype_url: str
    contact: str
    message: str  # Compatibility mirror of solution_idea.
    id: int
    task_id: int
    status: Literal["pending", "accepted", "rejected"]
    created_at: datetime
    decided_at: Optional[datetime]

    @field_serializer("created_at", "decided_at")
    def serialize_utc(self, value):
        return value.replace(tzinfo=timezone.utc).isoformat() if value else None


class ProposalDecision(Schema):
    status: Literal["accepted", "rejected"]


class HealthRead(Schema):
    status: Literal["ok"]
