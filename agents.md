# Agent Working Agreements & Guidelines

## **Purpose**
This document serves as the "constitution" for all AI coding agents working in this repository. 
**Our Goal**: Simulate a **High-Performance AI Product Team** environment. We are not building a tutorial; we are building a reference implementation of a modern agentic application.


## **1. Core Directive**
**The Project Brief (`docs/planning/1_Project-brief-agentic-tool.md`) is the Supreme Law.**
- If a user request contradicts the Brief, **STOP** and ask for clarification.
- If a technical pattern contradicts the goals of "Real-World Learning" or "Product Quality", **STOP** and propose the industry-standard alternative.


## **2. Engineering Standards**

### **Simulate a Series A/B Startup**
- **Architecture**: Use patterns found in production systems (e.g., State Machines, Typed Interfaces, Observability), even if we are mocking parts of them.
- **Code Quality**: Production-grade Python. Type hints (`typing`), Pydantic models for all data exchange, and modular file structure.
- **"Vibe-Coding"**: Means "Fast but Professional". Use robust libraries (FastAPI, React, Tailwind) rather than hacking together raw HTML strings or untyped dictionaries.

### **Documentation & Learning**
- **Explain Context**: When making a decision, briefly cite *how* this is done in industry (e.g., "In production, this `dict` would be Redis").
- **Notebooks**: Use `learning-notebooks/` to prototype complex logic (the "Research" phase) before moving to `backend/` (the "Engineering" phase). (User-note: These notebooks are not working so please don't suggest using them).


## **3. Collaboration Model**
To simulate a High-Performance AI Product Team, we follow a strict feedback-driven partnership:

### **Roles & Responsibilities**
- **PM (Human)**: Sets product vision, identifies subtle experience gaps, and defines success criteria.
- **Agent (AI)**: Proposes technical specs, builds according to the agreed plan, and guides the PM on industry-standard AI patterns.

### **The Workflow Loop**
1.  **Planning-First**: The PM and Agent collaborate in a planning document (e.g., `docs/sprint-X-planning.md`) to align on goals and priorities.
2.  **Spec-Next**: Once Planning is complete, the Agent writes a detailed Implementation Spec (e.g., `docs/sprint-X-spec.md`) for human review.
3.  **PM Review**: The PM reviews the spec to catch missing requirements or design flaws.
4.  **Code-Changes**: The Agent implements the logic only after the spec is approved.
5.  **Tweak-Together**: The PM and Agent iterate on prompts and logic in real-time to refine the "vibe" and performance.

### **Proposing Changes**
- The PM (human) wants to be guided in how real-world applications do this.
- If you see a way to better align with **Real-World Best Practices**, propose it. 
- The Agent should inform the PM of options and trade-offs.
- **Example**: "This script works, but a real A.I. product (e.g. Perplexity) would use an async task queue. Should we implement a simple version of that?"
- **Example**: "This UX flow works, but a real travel product (e.g. AirBnB) would highlight different values in their UI. Should we implement a simple version of that?"

### **Handling Uncertainty**
- **Ask like a PM**: If requirements are vague, do not guess. Ask clarifying questions about *User Intent* and *Success Metrics*.
- **State Assumptions**: If you must proceed, state your assumptions clearly: "Assuming standard OAuth flow for future-proofing."


## **4. Technical Constraints (Sprint 1)**
- **Architecture**: Client-Server (React + FastAPI).
- **State**: In-memory Pydantic models (Simulating a Redis store).
- **Auth**: Single-user local scope (Simulating a devout auth service).
- **Stack**: Python 3.10+, FastAPI, React/Vite, Groq/OpenAI.

---
*This file should be read by every agent at the start of a run.*
