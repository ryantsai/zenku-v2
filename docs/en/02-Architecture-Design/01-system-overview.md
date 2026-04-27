# System Overview

> This document describes Zenku's technology stack, software architecture, and directory organization, aiming to provide developers with a comprehensive technical understanding of the system.

---

## 1. Architectural Pattern: Monorepo
Zenku utilizes a **Monorepo (based on npm workspaces)** development pattern to ensure synchronized type definitions between the frontend and backend, simplifying local development and deployment processes.

*   **Package Path**: `packages/*`
*   **Package Management**: npm v7+ / npm workspaces

---

## 2. Technology Stack

### Frontend (`@zenku/web`)
*   **Framework**: React 19 (Vite)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS + shadcn/ui + Radix UI
*   **State Management & Routing**: React Context API + React Router 7
*   **Key Components**:
    *   Table: `@tanstack/react-table`
    *   Charts: `recharts`
    *   Drag & Drop: `@dnd-kit`
    *   Editors: `tiptap` (Rich Text) / `CodeMirror` (JSON/SQL)
    *   Internationalization: `i18next`

### Backend (`@zenku/server`)
*   **Runtime**: Node.js
*   **Server Framework**: Express
*   **Database Layer**:
    *   **Abstraction Layer**: `src/db/adapter.ts`
    *   **Implementation Layer**: Supports **SQLite** (default), **PostgreSQL**, and **MSSQL**.
*   **AI Integration**: Supports multiple LLM providers:
    *   **Anthropic** (Claude 3/3.5)
    *   **OpenAI** (GPT-4o)
    *   **Google** (Gemini 1.5/2.0)

### Shared Module (`@zenku/shared`)
*   **Type Definitions**: Defines core data structures such as `FieldDef`, `ViewDefinition`, and `RuleDef`.
*   **Logic Engine**: Includes `appearance.ts` (UI condition engine) and formula parsers.

---

## 3. Directory Structure and Responsibilities

### Backend Directory (`packages/server/src/`)
| Directory/File | Responsibility Description |
| :--- | :--- |
| `agents/` | Logic implementation for specialized AI agents (Schema, UI, Logic, Query, Test). |
| `ai/` | Abstract encapsulation of LLM Providers and conversation management. |
| `db/` | Database adapters and data access logic for system tables (`_zenku_*`). |
| `engine/` | Execution engine for business rules and triggers. |
| `routes/` | REST API route definitions (Data, View, Rules, Chat, etc.). |
| `tools/` | Toolset available for AI function calling (Function Calling Definitions). |
| `orchestrator.ts` | Core system orchestration logic; the hub for LLM interaction. |

### Frontend Directory (`packages/web/src/`)
| Directory/File | Responsibility Description |
| :--- | :--- |
| `components/` | Shared UI components (shadcn) and business-specific components. |
| `views/` | Core canvas components for dynamic rendering (`TableView`, `FormView`, `KanbanView`, etc.). |
| `contexts/` | Global state management (ViewsContext, ChatContext, AuthContext). |
| `lib/` | Utility functions and API client encapsulation. |
| `AppArea.tsx` | Dynamic route dispatcher that decides rendering type based on View Definitions. |

---

## 4. Key Operating Mechanisms

1.  **Bootstrapping**: When the server starts, if the specified database does not exist or is empty, it automatically initializes system tables (`_zenku_*`) via `src/db/index.ts`.
2.  **Type Safety**: Through the Monorepo, backend DTOs (Data Transfer Objects) and frontend Props share the same definitions from the `shared` package.
3.  **Environment Variables**: AI API Keys and database connection strings are managed uniformly via a `.env` file.
