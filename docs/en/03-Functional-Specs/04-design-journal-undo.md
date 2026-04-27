# Design Journal and Undo Mechanism

> To improve the fault tolerance of AI operations, Zenku treats all structural changes and business rule modifications as "reversible transaction streams." This not only addresses the AI's memory limitations but also allows users to "undo" decisions at any time.

---

## 1. Design Journal (`_zenku_journal`)

Every change executed through AI agents (Schema, UI, Rules) is written to the journal. Each journal entry contains the following key information:

*   **Contextual Information**: Which Agent executed it, change type, description, reasoning, and the original user requirement.
*   **Data Diff**: The complete JSON state before (`before`) and after (`after`) the change.
*   **Reversibility Flag (`reversible`)**: Note that not all operations can be automatically rolled back (e.g., DDL changes after deleting large amounts of data).
*   **Reverse Operations (`reverse_operations`)**: **The Core Key**. Stores the reverse SQL or reverse API calls required to restore the action.

---

## 2. Reverse Operation Types

When a change occurs, the executing Agent pre-calculates the steps required for restoration:
*   **`sql`**: Reverse SQL statements (e.g., `CREATE TABLE` corresponds to `DROP TABLE`).
*   **`drop_column` / `drop_table`**: Specifically used for structural restoration.
*   **JSON Diff Restoration**: Used to restore JSON configurations for UI Views or Rules.

---

## 3. Undo Rollback Modes

Through the `undo_action` tool, the AI supports three rollback modes:

### A. Single-Step Rollback (`target=last`)
Reverts the "most recent" reversible operation. This is the most common mode, triggered when a user says, "No, don't add that field I just mentioned."

### B. Specified Rollback (`target=by_id`)
Reverts a specific historical operation based on a Journal ID.

### C. Batch Time Machine (`target=by_time`)
Reverts all operations after a specific point in time. Suitable when a user wants to "return to the system state as of 9:00 AM this morning."

---

## 4. Operational Workflow

1.  **Recording**: `Schema Agent` adds a column → Pre-calculates reverse SQL (`ALTER TABLE DROP COLUMN`) → Writes to `_zenku_journal`.
2.  **Triggering**: User enters "Undo".
3.  **Execution**: `Orchestrator` calls `undo_action` → Reads `reverse_operations` from the journal → Executes the restoration SQL in sequence.
4.  **Marking**: Marks the journal entry as `reversed=1` to prevent duplicate rollbacks.

---

## 5. Additional Use of Design Journal: AI Context Injection

When a new conversation session begins, the `Orchestrator` reads a summary of recent design journals. This allows the AI to quickly understand:
*   "Why was this table created?"
*   "What requirement was the last UI modification satisfying?"
This compensates for the lack of persistent memory in LLMs, providing continuity to the system's evolution.
