from types import SimpleNamespace
import logging

logger = logging.getLogger(__name__)


class GroqWrapper:
    def __init__(self, model: str = "llama-3.1-8b-instant", api_key: str | None = None):
        try:
            from groq import Groq
        except Exception as e:
            logger.error("groq package not available: %s", e)
            raise

        self.model = model
        self.api_key = api_key
        self.client = Groq(api_key=api_key) if api_key else Groq()

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.3, **kwargs):
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ]
        try:
            resp = self.client.chat.completions.create(
                messages=messages,
                model=self.model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            text = resp.choices[0].message.content or ""
            return SimpleNamespace(text=text)
        except Exception as e:
            logger.exception("Groq generation failed: %s", e)
            raise
