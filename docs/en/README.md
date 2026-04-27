# Zenku Documentation Index (EN)

> **Positioning:** This directory contains the official English technical documentation for Zenku.
> It covers conceptual explanations, architectural design, functional specifications, and development logs. All documents are based on "finalized design decisions," faithfully recording the current state of the system.

---

## Directory Structure

```
docs/en/
├── README.md                          ← This file (Index)
│
├── 01-Concept-and-Vision/
│   ├── 01-zenku-concept.md            ← Positioning, core concepts, and architecture overview
│   └── 02-design-philosophy.md        ← Key design decisions and trade-off principles
│
├── 02-Architecture-Design/
│   ├── 01-system-overview.md          ← System-wide view: Monorepo, Tech stack, directory structure
│   ├── 02-multi-agent-architecture.md ← Orchestrator + Specialist Agents collaboration
│   ├── 03-dynamic-ui-rendering.md     ← Detailed data-driven UI rendering mechanism
│   ├── 04-database-design.md          ← System tables, business table lifecycle, and mapping
│   └── 05-development-environment.md  ← Environment setup and local startup guide
│
├── 03-Functional-Specs/
│   ├── 01-view-and-field-types.md     ← Full specifications for view and field controls
│   ├── 02-actions-and-conditional-ui.md ← View actions and real-time appearance rules
│   ├── 03-business-rules-engine.md    ← Automation: Triggers and Action types
│   ├── 04-design-journal-undo.md      ← Design Journal and the Undo mechanism
│   └── 05-security-and-i18n.md        ← Security models, i18n, and system constraints
│
├── 04-AI-Agent-System/
│   ├── 01-orchestrator-and-agents.md  ← Orchestrator responsibilities and Agent architecture
│   └── 02-agent-tools.md              ← Agent Toolkit and JSON Schema specifications
│
├── 05-Integration-and-Deployment/
│   ├── 01-integration-and-deployment.md ← External REST APIs, Multi-AI Providers, and Docker
│   └── 02-n8n-integration-guide.md    ← Practical guide for connecting Zenku with n8n
│
├── 07-Development-History/
│   └── 01-current-status.md           ← Feature milestones and current system boundaries
│
└── 08-Reference/
    └── 01-shared-type-dictionary.md   ← Core type definitions from @zenku/shared
```

---

## Writing Principles

1. **Present Tense**: Documents describe "how the system works now," not "what is planned for the future."
2. **Design Decision Persistence**: Record the "Why" behind major trade-offs and decisions, not just the "What."
3. **Code Examples First**: Use actual type definitions and code snippets instead of vague text descriptions.
4. **Glossary Alignment**: Maintain consistency with the provided glossary for technical terminology.

---

*Last Updated: 2026-04-27 (Initialized by Antigravity)*
