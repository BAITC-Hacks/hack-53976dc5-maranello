from typing import Annotated, List

from pydantic import Field, model_validator

from ..schemas import CardField, Schema


class Assignment(Schema):
    field: CardField
    source_id: Annotated[str, Field(min_length=1, max_length=100)]


class Extraction(Schema):
    # The model selects existing sources; it cannot supply arbitrary field text.
    assignments: Annotated[List[Assignment], Field(max_length=10)]
    question_fields: Annotated[List[CardField], Field(min_length=3, max_length=10)]

    @model_validator(mode="after")
    def unique_entries(self):
        if len({entry.field for entry in self.assignments}) != len(self.assignments):
            raise ValueError("Duplicate assignment field")
        if len({entry.source_id for entry in self.assignments}) != len(self.assignments):
            raise ValueError("A source cannot fill multiple fields")
        if len(set(self.question_fields)) != len(self.question_fields):
            raise ValueError("Duplicate question field")
        return self
