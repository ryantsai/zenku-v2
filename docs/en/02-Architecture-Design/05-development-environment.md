# Development Environment Configuration

> This document guides developers on how to configure the Zenku development environment from scratch and start the project locally.

---

## 1. System Requirements
*   **Node.js**: v18 or higher.
*   **npm**: v7 or higher (must support Workspaces).
*   **Operating System**: Windows / macOS / Linux.

---

## 2. Quick Start Process

### Step 1: Install Dependencies
Run the following in the project root directory:
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in the root directory and configure at least one AI provider API Key:
```bash
cp .env.example .env
```
Edit `.env`:
```ini
ANTHROPIC_API_KEY=your_key_here
DEFAULT_AI_PROVIDER=claude
DB_TYPE=sqlite
```

### Step 3: Start Development Servers
```bash
npm run dev
```
This command starts both:
*   **Backend**: `http://localhost:3001`
*   **Frontend**: `http://localhost:5173`

---

## 3. Essential Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts development mode (including backend tsx watch and frontend Vite). |
| `npm run build` | Compiles frontend and backend projects for official release. |
| `npm run dev -w packages/server` | Starts only the backend development mode. |
| `npm run dev -w packages/web` | Starts only the frontend development mode. |

---

## 4. Database Initialization
*   **SQLite (Default)**: The system automatically creates a `zenku.db` file in the root directory and initializes all system tables.
*   **Postgres / MSSQL**: If switching databases, ensure `DB_URL` is correct. The system will also automatically initialize the structure upon the first start.

---

## 5. Troubleshooting
*   **Port Conflicts**: If ports 3001 or 5173 are occupied, `npm run dev` will attempt to call `kill-port` to release the resources.
*   **AI Response Failure**: Please check if the `DEFAULT_AI_PROVIDER` and model names in `.env` match correctly.
*   **Type Errors**: If you modify contents in `packages/shared`, it is recommended to run `npm run build` to ensure type caches are updated.
