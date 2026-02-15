# Agentic Travel Planner: Reference Implementation

A "vibey" but architecturally robust exploration of modern **Agentic AI Products**. 
This project serves as a practical study in how companies (like those building travel agents, support bots, or complex assistants) structure their applications in 2026.

## **Project Mission**
To build a functional Travel Decision Assistant by simulating a **Real-World Product Engineering** environment. 
- **Beyond Chat**: Moving from "text-in/text-out" to "state-machine-driven workflows".
- **Beyond Tutorials**: Making architectural choices that scale (Typed Interfaces, Client-Server separation, Tool Abstractions).

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

### **2. Running Locally**

To run the full application, you need to start both the backend and frontend.

#### **Backend (API)**
```bash
cd services/api
uvicorn main:app --reload --port 8000
```

#### **Frontend (Web)**
```bash
cd apps/web
npm install  # First time only
npm run dev
```
The app will be available at [http://localhost:5173](http://localhost:5173).

## **Core Architecture**
- **Frontend**: React (Vite) + Tailwind CSS.
- **Backend**: Python (FastAPI).
- **Agent Logic**: Stateless "loop" managing a structured Pydantic State Object.
- **Infrastructure**: Client-Server separation simulating production AI services.

## **Documentation & Learning**
- [Project Brief](docs/project-brief/1_Project-brief-agentic-tool.md)
- [Agent Guidelines](agents.md)
- [Learning Notebooks](learning-notebooks/) - *Explore the agent loop logic and evals.*

---