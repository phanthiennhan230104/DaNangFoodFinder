from dataclasses import dataclass
from .prompt_base import PromptBase


@dataclass
class Text2SQLPrompt(PromptBase):
    TASK_TEMPLATE = """### Task
Generate a SQL query to answer [QUESTION]{question}[/QUESTION]

### Database Schema
The query will run on a database with the following schema:
{schema}

### Answer
Given the database schema, here is the SQL query that [QUESTION]{question}[/QUESTION]
[SQL]
"""

    @classmethod
    def build(cls, question: str, schema: str) -> str:
        return cls.TASK_TEMPLATE.format(question=question, schema=schema)
