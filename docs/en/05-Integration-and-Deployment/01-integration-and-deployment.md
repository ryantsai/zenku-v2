# Integration and Deployment

> Zenku is an open system. Through standardized APIs, Webhooks, and Docker support, it can be easily integrated into existing enterprise automation workflows (such as n8n).

---

## 1. External REST API (`/api/ext/`)

Dedicated interfaces for external systems (e.g., n8n, Make, Zapier). All requests must include an API Key in the Header.

*   **Base Path**: `http://localhost:3001/api/ext/data/`
*   **Common Endpoints**:
    *   `GET /:table`: Query data with pagination.
    *   `POST /:table`: Create a record, automatically triggering `after_insert` rules.
    *   `PATCH /:table/:id`: **Data Write-back**. Updates only the provided fields and automatically triggers `after_update` rules.
*   **OpenAPI Specification**: The system dynamically generates and exposes `GET /api/ext/openapi.json` based on the current database structure.

---

## 2. Webhook Integration (Zenku → n8n)

Zenku actively pushes data to external systems through its "Business Rules Engine."

### Workflow Example:
1.  **Trigger**: User creates an "Order" in Zenku.
2.  **Push**: Zenku triggers an `after_insert` Webhook, POSTing data to n8n.
3.  **Process**: n8n executes AI analysis or ERP integration.
4.  **Write-back**: After processing, n8n writes the results back to Zenku fields via a `PATCH` request.

### Docker Networking Note:
If n8n is running in Docker and Zenku is on the host machine, n8n must use `http://host.docker.internal:3001` to call Zenku.

---

## 3. Multi-AI Provider Adaptation

Zenku abstracts a unified AI Provider interface, allowing for provider switching via environment variables:

*   **Supported List**:
    *   `anthropic` (Claude 3.5 Sonnet / Haiku)
    *   `openai` (GPT-4o / GPT-4o-mini)
    *   `gemini` (Gemini 1.5 Pro / Flash)
    *   `ollama` (Local Llama 3 / DeepSeek)
    *   `openrouter` (Aggregated provider)
*   **Features**: Supports `Prompt Caching` to significantly reduce the cost and latency of repetitive generation.

---

## 4. MCP Server Access

Zenku natively supports the **Model Context Protocol (MCP)**.
*   **Endpoint**: `POST /api/mcp`
*   **Use Case**: Allows external AI Agents (e.g., Claude Desktop or custom agents) to directly "control Zenku."
*   **Security**: Subject to API Key Scopes. For example, an agent with `mcp:read` permissions can only query data and cannot modify the schema.

---

## 5. Deployment Architecture

*   **Docker Deployment**: Supports one-click `docker-compose up -d` to start the frontend, backend, and database.
*   **Persistence**:
    *   **SQLite**: Mounts the `zenku.db` file volume.
    *   **Postgres / MSSQL**: Connects to external instances via environment variables.
*   **Static Assets**: The frontend (compiled by Vite) is hosted statically by the backend Express server or through an Nginx reverse proxy.
