import logging
import os
import re

from ..schemas import Card
from ..services import question_fields_for
from .providers import configured_provider
from .schemas import Extraction

logger = logging.getLogger(__name__)
LABELS = {
    "название": "title", "контекст": "context", "проблема": "need", "потребность": "need",
    "пользователи": "users", "данные": "data_materials", "материалы": "data_materials",
    "ограничения": "constraints", "результат": "expected_result",
    "критерии успеха": "success_criteria", "контакт": "contact",
    "формат взаимодействия": "interaction_format",
    **{field: field for field in Card.model_fields},
}


def description_sources(description):
    # Keep complete statements to avoid changing meaning through partial quotations.
    parts = re.split(r"(?<=[.!?])\s+|[\n;]+", description)
    sources = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        label, separator, value = part.partition(":")
        hint = LABELS.get(label.strip().casefold()) if separator else None
        sources.append({"id": f"description:{len(sources)}", "text": value.strip() if hint else part,
                        "field_hint": hint})
    return sources


def mock_card(description, current_card=None):
    if current_card is not None:
        return Card.model_validate(current_card)
    values = {}
    unlabelled = []
    for source in description_sources(description):
        if source["field_hint"]:
            field = source["field_hint"]
            # Multiple statements for one field remain intact.
            values[field] = "\n".join(filter(None, [values.get(field, ""), source["text"]]))
        else:
            unlabelled.append(source["text"])
    if "context" not in values:
        values["context"] = "\n".join(unlabelled)
    # An overlong supplied title is not silently rewritten or truncated.
    if len(values.get("title", "")) > 200:
        values["title"] = ""
    return Card.model_validate(values)


class TaskAI:
    def __init__(self, provider=None):
        self.provider = provider

    @classmethod
    def from_env(cls):
        return cls(configured_provider())

    def prepare(self, description, current_card=None):
        fallback = mock_card(description, current_card)
        reason = None
        mode = "mock"
        if self.provider is None and os.getenv("AI_PROVIDER", "mock").lower() == "openai":
            mode, reason = "fallback", "missing_api_key"
        card, preferred = fallback, []
        if self.provider is not None:
            if current_card is None:
                sources = description_sources(description)
            else:
                sources = [{"id": f"card:{field}", "text": value, "field_hint": field}
                           for field, value in current_card.items() if value]
            try:
                raw = self.provider.extract(sources, current_card)
                output = Extraction.model_validate_json(raw)
                lookup = {source["id"]: source for source in sources}
                values = {}
                for assignment in output.assignments:
                    source = lookup.get(assignment.source_id)
                    if source is None or source["field_hint"] not in (None, assignment.field):
                        raise ValueError("Ungrounded assignment")
                    values[assignment.field] = source["text"]
                card = Card.model_validate(values)
                if current_card is not None and card.model_dump() != fallback.model_dump():
                    raise ValueError("Model changed user-edited fields")
                for source in sources:
                    field = source["field_hint"]
                    if field and getattr(card, field) != getattr(fallback, field):
                        raise ValueError("Model omitted explicitly supplied information")
                preferred = output.question_fields
                mode = "openai"
            except Exception as error:
                # Provider failures never break intake; no raw payloads, secrets or contacts in logs.
                logger.warning("Task AI fallback: %s", type(error).__name__)
                card, mode, reason = fallback, "fallback", "invalid_or_unavailable_ai"
        metadata = {"provider": mode, "fallback_reason": reason,
                    "question_fields": question_fields_for(card, preferred)}
        return card, metadata
