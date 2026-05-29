# Agentic Travel Planner: Reference Implementation

An exploration of modern **Agentic AI Products**. 
This project serves as a practical study in how companies (like those building travel agents, support bots, or complex assistants) design and structure their agentic applications in 2026.

## **Project Mission**
To build a functional Travel Decision Assistant by simulating a **Real-World Product Engineering** environment. 
- **Beyond Chat**: Moving from "text-in/text-out" to "state-machine-driven workflows".
- **Beyond Tutorials**: Making architectural choices that scale (Typed Interfaces, Client-Server separation, Tool Abstractions).
- **Real Products**: We learn by building what real products have built - not by inventing new things and trying to find a new niche.

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
Ensure you have a `.env` file in the root directory with your API keys:
- `GROQ_API_KEY`: Required for primary (`llama-3.3-70b-versatile`) and fallback (`qwen/qwen3-32b`) reasoning loops.
- `UNSPLASH_ACCESS_KEY`: Optional but highly recommended for dynamic destination photo queries (without it, the server gracefully falls back to high-quality placeholders).

### **2. Running Locally**

To run the full application, you need to start both the backend and frontend.

#### **Backend (API) - Shared**
```bash
cd services/api
uvicorn main:app --reload --port 8000
```

The backend serves both Sprint 4 (`/chat`) and Sprint 3 Prototype (`/chat/prototype`) endpoints.

#### **Web Frontend (Since Sprint 4 build)**
```bash
cd apps/web
npm install  # First time only
npm run dev
```
The Sprint 4 app will be available at [http://localhost:5173](http://localhost:5173).

#### **Prototype Frontend (Up to Build 3)**
```bash
cd apps/prototype-web
npm install  # First time only
npm run dev
```
The Sprint 3 prototype will be available at [http://localhost:5174](http://localhost:5174).

**Note**: The prototype is a locked version of Sprint 3 used to preserve the working demo. All new development happens in `apps/web/`.

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