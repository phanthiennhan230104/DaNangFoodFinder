from typing import List, Dict, Any
from django.db import connection
import logging

logger = logging.getLogger(__name__)


class DjangoEngine:
    def __init__(self, database: str = None):
        self.database = database

    def get_schema(self, table_name: str) -> str:
        # Use DESCRIBE to get table schema from the current DB
        try:
            with connection.cursor() as cursor:
                cursor.execute(f"DESCRIBE {table_name};")
                rows = cursor.fetchall()
                # rows are tuples; create a readable schema string
                schema_lines = []
                for r in rows:
                    schema_lines.append(" ".join(str(x) for x in r))
                return f"{table_name}\n" + "\n".join(schema_lines)
        except Exception as e:
            logger.exception("Failed to get schema for %s: %s", table_name, e)
            return table_name

    def execute_query(self, query: str, limit: int = 500) -> List[Dict[str, Any]]:
        if not query or not query.strip().lower().startswith("select"):
            return []
        if "limit" not in query.lower():
            query = f"{query.strip()} LIMIT {limit}"

        with connection.cursor() as cursor:
            cursor.execute(query)
            columns = [col[0] for col in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            result = []
            for row in rows:
                obj = {columns[i]: row[i] for i in range(len(columns))}
                result.append(obj)
            logger.info("DjangoEngine returned %d rows", len(result))
            return result
