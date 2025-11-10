import os
import sys
import json
import logging

logger = logging.getLogger(__name__)


def _ensure_rag_sql_on_path():
    """Ensure the RAG-SQL project path is on sys.path.

    Tries a few reasonable locations relative to this file. Returns the path added or None.
    """
    # Common expected location: workspace root /RAG-SQL
    candidates = []
    this_dir = os.path.dirname(os.path.abspath(__file__))
    # d:/duancapstone1/DaNangFoodFinder/backend/api -> go up 3 to reach d:/duancapstone1
    workspace_root = os.path.abspath(os.path.join(this_dir, '..', '..', '..'))
    candidates.append(os.path.join(workspace_root, 'RAG-SQL'))
    # Also try sibling relative path
    candidates.append(os.path.abspath(os.path.join(this_dir, '..', '..', 'RAG-SQL')))
    # Also try environment variable
    env_path = os.environ.get('RAG_SQL_PATH')
    if env_path:
        candidates.insert(0, env_path)

    for p in candidates:
        if not p:
            continue
        if os.path.isdir(p) and p not in sys.path:
            sys.path.insert(0, p)
            logger.info(f"Added RAG-SQL path to sys.path: {p}")
            return p
    return None


def get_monolith_predictor():
    """Return a callable predict(question: str) -> list[dict] that uses RAG-SQL MonolithAgent.

    The RAG-SQL code returns a JSON string; we parse it into Python list.
    """
    # Prefer the embedded vendor package if present
    try:
        from .rag_sql_vendor.monolith_agent import MonolithAgent

        class HandlerWrapper:
            @staticmethod
            def predict(q):
                agent = MonolithAgent()
                return agent.generate(q)

        MonolithAgentHandler = HandlerWrapper
    except Exception:
        # Fallback to original RAG-SQL integration if vendor not available
        try:
            # Try direct import first (external RAG-SQL package)
            from integration.services.predict import MonolithAgentHandler
        except Exception:
            # Try to add path and import again
            added = _ensure_rag_sql_on_path()
            try:
                from integration.services.predict import MonolithAgentHandler
            except Exception as e:
                logger.error("Failed to import MonolithAgentHandler from RAG-SQL: %s", e, exc_info=True)
                raise ImportError(
                    "Could not import RAG-SQL MonolithAgentHandler. Ensure the RAG-SQL folder is present and \n"
                    "Python dependencies are installed. You can set RAG_SQL_PATH env var to the RAG-SQL folder."
                )

    def predict(question: str):
        # MonolithAgentHandler.predict returns a JSON string (list of results)
        raw = MonolithAgentHandler.predict(question)
        # If the handler raised a string exception (bad pattern), convert
        if isinstance(raw, Exception):
            raise raw
        try:
            parsed = json.loads(raw)
            return parsed
        except Exception:
            # If it's already a list/object
            if isinstance(raw, (list, dict)):
                return raw
            # As last resort, wrap the raw string as answer text
            return [{'name': '', 'average_rating': None, 'address': '', 'price_range': '', 'raw': str(raw)}]

    return predict
