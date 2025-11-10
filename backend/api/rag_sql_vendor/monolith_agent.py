import json
import logging
from django.conf import settings

from .db.django_engine import DjangoEngine
from .llm.groq_wrapper import GroqWrapper
from .prompts.text2sql_prompt import Text2SQLPrompt
from .utils import extract_sql_query

logger = logging.getLogger(__name__)


class MonolithAgent:
    def __init__(self):
        # Use Django settings for DB config if needed
        self.db_engine = DjangoEngine()

        # LLM models: read from settings if provided, else defaults
        text2sql_model = getattr(settings, 'RAG_TEXT2SQL_MODEL', 'llama-3.1-8b-instant')
        answer_model = getattr(settings, 'RAG_RESPONDER_MODEL', 'llama-3.1-8b-instant')
        api_key = getattr(settings, 'GROQ_API_KEY', None)

        self.text2sql_client = GroqWrapper(model=text2sql_model, api_key=api_key)
        self.responsor = GroqWrapper(model=answer_model, api_key=api_key)

    def generate(self, question: str) -> str:
        logger.info(f"[MonolithAgent] Received question: {question}")

        schema = self.db_engine.get_schema(table_name="api_restaurant")

        text2sql_prompt = Text2SQLPrompt.build(question=question, schema=schema)
        logger.info(f"[MonolithAgent] Text2SQL Prompt:\n{text2sql_prompt}")

        sql_result = self.text2sql_client.generate(
            prompt=text2sql_prompt,
            max_tokens=512,
            temperature=0.3,
        )

        if not sql_result or not getattr(sql_result, 'text', ''):
            logger.error("[MonolithAgent] No SQL query generated.")
            return json.dumps([], ensure_ascii=False)

        sql_text = sql_result.text.strip()
        logger.info(f"[MonolithAgent] Generated SQL Query:\n{sql_text}")

        sql = extract_sql_query(sql_text)
        if not sql:
            logger.error("[MonolithAgent] Extracted SQL is empty or invalid.")
            return json.dumps([], ensure_ascii=False)

        retrival_info = self.db_engine.execute_query(sql)

        formatted_results = []
        for row in retrival_info:
            formatted_results.append({
                "name": row.get("name", ""),
                "average_rating": float(row.get("average_rating") or 0) if row.get("average_rating") is not None else None,
                "address": row.get("address", ""),
                "price_range": row.get("price_range", ""),
            })
            # Score & rank results: prefer items matching more tokens and higher rating
            try:
                top_k = int(getattr(settings, 'RAG_TOP_K', 10))
                # Normalize query tokens
                import re

                tokens = [t.lower() for t in re.findall(r"[\wÀ-ỹ]+", question, flags=re.UNICODE) if len(t) > 1]

                # Improved scoring:
                # - exact phrase match in key fields: +6
                # - token matches in cuisine_type: +3 per token
                # - token matches in name: +2 per token
                # - token matches in address: +4 per token if token looks like a district (e.g., 'sơn trà'), else +1
                # - rating contributes as small tiebreaker
                DISTRICTS = [d.lower() for d in [
                    'hải châu', 'sơn trà', 'ngũ hành sơn', 'thanh khê', 'liên chiểu', 'cẩm lệ', 'hòa vang'
                ]]

                def score_item(item):
                    raw_name = (item.get('name') or '').lower()
                    raw_cuisine = (item.get('cuisine_type') or '') if item.get('cuisine_type') is not None else ''
                    raw_cuisine = str(raw_cuisine).lower()
                    raw_address = (item.get('address') or '').lower()
                    raw_context = item.get('_raw_text', '')

                    score = 0

                    # exact phrase match (whole query) strong boost
                    phrase = " ".join(tokens)
                    if phrase and (phrase in raw_name or phrase in raw_cuisine or phrase in raw_context or phrase in raw_address):
                        score += 6

                    # token contributions
                    for tk in tokens:
                        if tk in raw_cuisine:
                            score += 3
                        if tk in raw_name:
                            score += 2
                        if tk in raw_context:
                            score += 1
                        if tk in raw_address:
                            # if token is part of district, larger boost
                            if any(d for d in DISTRICTS if d in tk or tk in d):
                                score += 4
                            else:
                                score += 1

                    # small rating multiplier as tiebreaker
                    try:
                        rating = float(item.get('average_rating') or 0)
                    except Exception:
                        rating = 0.0
                    score += (rating / 10.0)

                    return (score, rating)

                # Compute scores and sort
                scored = []
                for it in formatted_results:
                    scored.append((score_item(it), it))

                # Minimum required matches: at least half of tokens (ceil), or 1 for single-token queries
                import math
                min_match = 1
                if tokens:
                    min_match = max(1, math.ceil(len(tokens) / 2))

                # Filter out low-relevance items
                filtered = [s for s in scored if s[0][0] >= min_match]
                if not filtered:
                    logger.info("[MonolithAgent] No items met min_match=%s (tokens=%s); returning empty results", min_match, tokens)
                    return json.dumps([], ensure_ascii=False)

                filtered.sort(key=lambda x: (x[0][0], x[0][1]), reverse=True)
                ranked = [it for _, it in filtered]
                # Trim internal keys and return top_k
                final = []
                for it in ranked[:top_k]:
                    it.pop('_raw_text', None)
                    final.append(it)

                logger.info("[MonolithAgent] Final JSON formatted output (ranked top %d): %s", top_k, json.dumps(final, ensure_ascii=False))
                return json.dumps(final, ensure_ascii=False)
            except Exception:
                logger.exception("Scoring failed, returning unscored results")
                # Cleanup raw keys
                for it in formatted_results:
                    it.pop('_raw_text', None)
                return json.dumps(formatted_results, ensure_ascii=False)

        # If Text2SQL returned no rows, perform a safe fallback keyword search
        if not formatted_results:
            try:
                q_escaped = question.replace("'", "''").strip()
                # build a simple LIKE over relevant text fields
                fallback_sql = (
                    "SELECT * FROM api_restaurant WHERE "
                    f"(name LIKE '%{q_escaped}%' OR rag_context_text LIKE '%{q_escaped}%' OR "
                    f"cuisine_type LIKE '%{q_escaped}%' OR address LIKE '%{q_escaped}%') LIMIT 50"
                )
                logger.info("[MonolithAgent] Running fallback SQL: %s", fallback_sql)
                fallback_rows = self.db_engine.execute_query(fallback_sql)
                for row in fallback_rows:
                    formatted_results.append({
                        "name": row.get("name", ""),
                        "average_rating": float(row.get("average_rating") or 0) if row.get("average_rating") is not None else None,
                        "address": row.get("address", ""),
                        "price_range": row.get("price_range", ""),
                    })
                # If phrase fallback returned nothing, try tokenized fallback (OR across tokens)
                if not formatted_results:
                    import re
                    tokens = [t for t in re.findall(r"[\wÀ-ỹ]+", question, flags=re.UNICODE) if len(t) > 1]
                    if tokens:
                        token_clauses = []
                        for tk in tokens:
                            tk_esc = tk.replace("'", "''")
                            token_clauses.append(
                                f"(name LIKE '%{tk_esc}%' OR rag_context_text LIKE '%{tk_esc}%' OR cuisine_type LIKE '%{tk_esc}%' OR address LIKE '%{tk_esc}%')"
                            )
                        token_where = " OR ".join(token_clauses)
                        token_sql = f"SELECT * FROM api_restaurant WHERE ({token_where}) LIMIT 50"
                        logger.info("[MonolithAgent] Running tokenized fallback SQL: %s", token_sql)
                        token_rows = self.db_engine.execute_query(token_sql)
                        for row in token_rows:
                            formatted_results.append({
                                "name": row.get("name", ""),
                                "average_rating": float(row.get("average_rating") or 0) if row.get("average_rating") is not None else None,
                                "address": row.get("address", ""),
                                "price_range": row.get("price_range", ""),
                            })
            except Exception as e:
                logger.exception("[MonolithAgent] Fallback search failed: %s", e)

        logger.info("[MonolithAgent] Final JSON formatted output: %s", json.dumps(formatted_results, ensure_ascii=False))
        return json.dumps(formatted_results, ensure_ascii=False)
