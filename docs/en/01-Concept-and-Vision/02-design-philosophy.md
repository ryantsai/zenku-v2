# Design Philosophy and Trade-offs

> This document records the core architectural decisions made during the development of Zenku, as well as the trade-offs between flexibility, stability, and security.

---

## 1. UI Generation: Component Composition vs. Code Generation
**Decision: Adopt "Data-Driven Component Composition (Building Blocks)" instead of directly generating source code.**

*   **Approach**: Pre-define a set of highly abstracted UI components (e.g., `TableView`, `FormView`, `DashboardWidget`). The AI (UI Agent) selects and combines these into a JSON definition.
*   **Rationale for Trade-off**:
    *   **Stability**: Prevents the LLM from generating invalid syntax or code with security vulnerabilities (e.g., XSS).
    *   **Maintainability**: When core UI components are upgraded, all Views automatically inherit new features without needing re-generation.
    *   **Predictability**: Ensures consistency in interface style, preventing sudden UI shifts due to model randomness.

## 2. Communication Architecture: Centralized Orchestration vs. Decentralized Collaboration
**Decision: Adopt a "Centralized Orchestrator Model"; do not use an Event Bus in the early stages.**

*   **Approach**: Direct communication between Agents is prohibited; all messages must flow through the Orchestrator.
*   **Rationale for Trade-off**:
    *   **Low Complexity**: Easier to track conversation flow and debug, reducing Token waste caused by infinite loops between Agents.
    *   **Global Oversight**: The Orchestrator can access the status of all Agents at any time, making more precise intent routing possible.
    *   **Future Extensibility**: Once the system matures, this architecture can easily evolve into asynchronous collaboration based on event-driven patterns.

## 3. Security Defense: Context Isolation and Least Privilege
**Decision: Implement strict context isolation and permission control for Agents.**

*   **Approach**:
    *   **Permission Isolation**: For example, the `Query Agent` only has `SELECT` permissions; the `UI Agent` cannot access actual business data.
    *   **Context Isolation**: Each Agent only receives system metadata relevant to its task, without seeing unrelated definitions.
*   **Rationale for Trade-off**:
    *   **Security**: Prevents the AI from accidentally executing unauthorized operations (e.g., mistakenly dropping a table while querying data).
    *   **Token Efficiency**: Significantly reduces the length of context sent to the model, lowering costs and improving response speeds.

## 4. Fault Tolerance: Design Journal and Time Machine (Undo)
**Decision: Treat system changes as a "Reversible Transaction Stream."**

*   **Approach**: Every change to Schema or UI records the original requirement, reasoning, and reverse SQL/Diff.
*   **Rationale for Trade-off**:
    *   **AI Hallucination Protection**: When the AI makes a wrong decision, users can instantly revert via an "Undo" command, reducing development frustration.
    *   **Cross-Session Memory**: The Journal becomes a crucial reference for the AI to understand "why the system is the way it is now."

## 5. Data Model: Deterministic Schema vs. Flexible JSON
**Decision: Insist on using a deterministic database Schema (Schema-on-Write).**

*   **Approach**: Data tables and field types must be defined before data access, rather than cramming all data into a single JSON column.
*   **Rationale for Trade-off**:
    *   **Data Integrity**: Leverages native database type checks and relational constraints (FK).
    *   **Performance**: Ensures that indexing and aggregation queries remain efficient as data volume grows.
    *   **External Integration**: Structured data tables are easier to interface with n8n, BI tools, or other external systems.
