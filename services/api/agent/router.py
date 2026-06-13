from .orchestrator import AgentOrchestrator, EXPLORE_CONFIG, COMPARISON_CONFIG

explore_agent = AgentOrchestrator(EXPLORE_CONFIG)
comparison_agent = AgentOrchestrator(COMPARISON_CONFIG)


def get_agent(mode: str) -> AgentOrchestrator:
    """Route to the Explore agent or the Comparison/Decision agent based on mode."""
    return explore_agent if mode == "explore" else comparison_agent
