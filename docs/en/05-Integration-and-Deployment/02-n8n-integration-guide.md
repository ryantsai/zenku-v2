# n8n Integration Guide

> This document provides a complete tutorial on connecting Zenku with n8n automation workflows, covering two-way communication, permission configuration, and troubleshooting common issues.

---

## 1. Two-Way Communication Architecture

```
┌──────────────┐   after_insert webhook   ┌──────────┐   PATCH /api/ext/data/:table/:id
│    Zenku     │  ───────────────────────► │   n8n    │  ────────────────────────────────►  Zenku
│  (host:3001) │                           │ (docker) │                                     (Data Write-back)
└──────────────┘                           └──────────┘
```

*   **Zenku runs on the host machine** (default port `3001`).
*   **n8n runs in Docker**: When calling Zenku from n8n, you must use `http://host.docker.internal:3001`.

---

## 2. Authentication and Scopes

### API Key Format
`zk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Scope Reference Table
| Scope | Authorized Content |
| :--- | :--- |
| `read:*` | Read access to all data tables. |
| `write:*` | Write/Update access to all data tables. |
| `webhook:callback` | Access to the dedicated `/webhook/callback` write-back endpoint. |
| `mcp:*` | Allows external AI Agents to control the system via MCP. |

---

## 3. Implementation: Pushing from Zenku to n8n

1.  **Configure a Rule in Zenku**:
    *   Go to `Settings` → `Rules`.
    *   Trigger: `after_insert`.
    *   Action: `webhook`.
    *   URL: Paste your n8n Webhook URL.
2.  **n8n Webhook Node Configuration**:
    *   **HTTP Method**: `POST`.
    *   **Response Mode**: Must be set to `responseNode` (to prevent premature connection termination).
3.  **Payload Structure**:
    The JSON pushed by Zenku will contain `{ "table": "...", "action": "insert", "data": { ... } }`.

---

## 4. Implementation: Writing Back from n8n to Zenku

This is the most common scenario: writing results back to Zenku after n8n completes an AI task.

### Recommended Method: Use HTTP Request Node (PATCH)
*   **Method**: `PATCH`.
*   **URL**: `http://host.docker.internal:3001/api/ext/data/{{table}}/{{id}}`.
*   **Authentication**: Select `Predefined Credential Type` → `httpBearerAuth`.
*   **Body**: Send only the fields that need updating, e.g., `{ "status": "Completed", "result": "AI analysis content" }`.

---

## 5. Troubleshooting

| Error Message | Potential Cause | Solution |
| :--- | :--- | :--- |
| `ECONNREFUSED` | n8n is trying to connect to `localhost`. | Use `host.docker.internal` instead. |
| `401 Unauthorized` | Incorrect API Key or path. | Ensure the path starts with `/api/ext/` and check the Bearer Token. |
| `403 Forbidden` | API Key lacks `write` permissions. | Upgrade the Scopes for that key in Zenku settings. |
| Field displays `{{id}}` as text | n8n URL field Expression mode not enabled. | Click the "Tilde/Braces" icon next to the URL field to enable expressions. |
| Webhook Node Error | Webhook Trigger set to immediate response. | Change Response Mode to `On Received` or `Response to Webhook Node`. |
