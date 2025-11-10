import re


def extract_sql_query(model_output: str) -> str:
    """Extracts a read-only SQL SELECT query from LLM output.

    This is a simplified copy of the original utility used in RAG-SQL.
    """
    if not model_output:
        return ""

    cleaned = re.sub(r"```sql|```", "", model_output, flags=re.IGNORECASE).strip()

    sql_pattern = re.compile(r"(SELECT[\s\S]+?;)", re.IGNORECASE)
    match = sql_pattern.search(cleaned)
    if match:
        query = match.group(1).strip()
    else:
        match = re.search(r"(SELECT[\s\S]+)", cleaned, re.IGNORECASE)
        query = match.group(1).strip() if match else ""

    if not query.upper().startswith("SELECT"):
        return ""

    return query
