from groq import Groq
from .config import settings

_clients: dict[str, Groq] = {}


def get_groq_client(api_key: str = None) -> Groq:
    """Return a cached Groq client for the given API key.

    Each agent passes its own key (its own Groq account), so each gets an
    independent client and rate-limit pool. Defaults to GROQ_API_KEY for
    callers that don't specify one (prototype_orchestrator.py).
    """
    key = api_key or settings.GROQ_API_KEY
    if key not in _clients:
        _clients[key] = Groq(api_key=key)
    return _clients[key]
