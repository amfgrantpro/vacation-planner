# Agentic Travel Planner: Reference Implementation

A "vibey" but architecturally robust exploration of modern **Agentic AI Products**. 
This project serves as a practical study in how companies (like those building travel agents, support bots, or complex assistants) structure their applications in 2026.

## **Project Mission**
To build a functional Travel Decision Assistant by simulating a **Real-World Product Engineering** environment. 
- **Beyond Chat**: Moving from "text-in/text-out" to "state-machine-driven workflows".
- **Beyond Tutorials**: Making architectural choices that scale (Typed Interfaces, Client-Server separation, Tool Abstractions).

## **Architecture (Sprint 1)**
- **Frontend**: React (Vite) + Tailwind CSS.
- **Backend**: Python (FastAPI).
- **Agent Logic**: Stateless "loop" managing a strict Pydantic State Object.
- **Infrastructure**: Localhost (simulating cloud microservices).

## **Quick Start**

### **1. Environment Setup**

**Python**
```bash
# Using uv (recommended)
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt

# OR using pip
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Environment Variables**
Copy `.env.example` to `.env` (or use the provided `.env`) and ensure you have valid API keys for `GROQ_API_KEY` (Primary) or `OPENAI_API_KEY`.

### **2. Explore the Logic**
- See `learning-notebooks/3_agent_loop.ipynb` for a breakdown of the "State Machine" pattern vs the "Basic Chatbot" pattern.

## **Documentation**
- [Project Brief](docs/planning/1_Project-brief-agentic-tool.md)
- [Project Plan](docs/planning/2_Project-plan-agentic-travel-planner.md)
- [MVP Roadmap](docs/planning/3_MVP-plan-agentic-travel-planner.md)
- [Sprint 1 Spec](docs/planning/4_Build-spec-agentic-travel-planner.md)
- [Agent Guidelines](agents.md) - *Read this to understand our Engineering Standards.*

---