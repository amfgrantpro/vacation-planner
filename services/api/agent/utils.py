MAX_HISTORY_TURNS = 5  # Keep in sync with orchestrator.py


def filter_history(history: list) -> list:
    """Strip tool messages — keep only user and plain assistant text messages."""
    return [
        m for m in history
        if m.get("role") != "tool" and not m.get("tool_calls")
    ]


def prune_history(history: list) -> list:
    """All user messages kept; assistant replies kept for last MAX_HISTORY_TURNS turns only.

    Expects history that has already passed through filter_history.
    """
    filtered = filter_history(history)
    user_indices = [i for i, m in enumerate(filtered) if m.get("role") == "user"]
    if len(user_indices) <= MAX_HISTORY_TURNS:
        return filtered
    cutoff = user_indices[-MAX_HISTORY_TURNS]
    return [m for i, m in enumerate(filtered) if m.get("role") == "user" or i >= cutoff]
