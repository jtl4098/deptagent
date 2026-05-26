# DeptAgent - Technical Documentation

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture](#4-architecture)
5. [Database Layer](#5-database-layer)
6. [Core Engine](#6-core-engine)
7. [Tool System](#7-tool-system)
8. [API Reference](#8-api-reference)
9. [Admin Dashboard](#9-admin-dashboard)
10. [Employee Chat Interface](#10-employee-chat-interface)
11. [Data Flow Diagrams](#11-data-flow-diagrams)
12. [Configuration & Environment](#12-configuration--environment)

---

## 1. Overview

DeptAgent is a **multi-agent HR chatbot platform** with an admin dashboard. It allows organizations to deploy specialized AI agents (Policy, Benefits, Recruiting, Onboarding, Leave) that automatically route employee questions to the most appropriate agent.

### What It Does

- **Employee-facing**: A chat interface where employees ask HR questions. The system automatically routes each message to the right specialist agent.
- **Admin-facing**: A dashboard where HR admins manage agents, approve PD budget requests, handle escalations, publish announcements, and manage knowledge base documents.
- **AI-powered approval workflow**: The Benefits agent can submit PD budget requests on behalf of employees. Admins can use AI-assisted policy analysis to review and approve/reject requests.

### Key Differentiators

| Feature | Description |
|---------|-------------|
| **LLM-based routing** | An orchestrator LLM reads all agent descriptions and routes messages to the best match |
| **Dynamic agent management** | Agents are fully CRUD-managed via admin UI -- no code changes needed |
| **Pluggable tool system** | Built-in tools are registered in a registry and assigned to agents via DB junction table |
| **Knowledge injection** | All markdown files in `/src/knowledge/` are injected into every agent's system prompt |
| **Escalation detection** | Keyword-based detection automatically escalates to human when employees request it |
| **AI policy analysis** | LLM analyzes approval requests against company policies before admin decision |

---

## 2. Tech Stack

### Runtime & Framework

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.1.7 | Full-stack React framework (App Router) |
| **React** | 19.2.3 | UI library |
| **TypeScript** | 5.x | Type safety |
| **Node.js** | 20+ | Server runtime |

### AI / LLM

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Vercel AI SDK** (`ai`) | 6.0.116 | Tool definition, LLM execution loop (`generateText`), `ToolSet` type system |
| **@ai-sdk/groq** | 3.0.29 | Groq LLM provider adapter |
| **Groq Cloud** | -- | LLM inference host (runs `llama-3.3-70b-versatile`) |
| **Zod** | 4.3.6 | Schema validation for tool inputs |

### Database

| Technology | Version | Purpose |
|-----------|---------|---------|
| **better-sqlite3** | 12.8.0 | Embedded SQLite database, synchronous API |

### UI

| Technology | Purpose |
|-----------|---------|
| **Tailwind CSS 4** | Utility-first CSS |
| **shadcn/ui** | Prebuilt component primitives (Button, Card, Badge, etc.) |
| **Lucide React** | Icon library |

### Package Manager

| Tool | Purpose |
|------|---------|
| **pnpm** | Package management |

---

## 3. Project Structure

```
deptagent-poc/
├── src/
│   ├── agents/                    # Agent configuration & resolution
│   │   ├── index.ts               # Agent loading, tool binding (DB-based)
│   │   └── types.ts               # AgentConfig, AgentConfigRow types
│   │
│   ├── app/                       # Next.js App Router
│   │   ├── page.tsx               # Employee chat interface (/)
│   │   ├── layout.tsx             # Root layout
│   │   ├── admin/                 # Admin dashboard (/admin)
│   │   │   ├── page.tsx           # Admin page state management & routing
│   │   │   ├── layout.tsx         # Admin layout
│   │   │   └── components/        # Admin UI components
│   │   │       ├── shared.tsx           # Types, constants, helpers
│   │   │       ├── sidebar.tsx          # Navigation sidebar
│   │   │       ├── dashboard-view.tsx   # Dashboard with summary + approvals
│   │   │       ├── summary-cards.tsx    # Stats cards
│   │   │       ├── approvals-view.tsx   # Approvals list + resolution
│   │   │       ├── agent-detail-view.tsx # Agent edit form + tool assignment
│   │   │       ├── new-agent-view.tsx   # Agent creation form
│   │   │       ├── tools-view.tsx       # Tools management (builtin + MCP)
│   │   │       ├── request-types-view.tsx # Request type CRUD
│   │   │       ├── escalations-view.tsx # Escalation list
│   │   │       ├── escalation-detail-view.tsx # Escalation conversation
│   │   │       ├── knowledge-view.tsx   # Knowledge base editor
│   │   │       └── announcements-view.tsx # Announcement management
│   │   │
│   │   └── api/                   # REST API routes
│   │       ├── chat/route.ts            # POST /api/chat
│   │       ├── stats/route.ts           # GET /api/stats
│   │       ├── agents/                  # Agent CRUD
│   │       │   ├── route.ts             # GET/POST /api/agents
│   │       │   └── [id]/
│   │       │       ├── route.ts         # GET/PUT/DELETE /api/agents/:id
│   │       │       └── tools/route.ts   # GET/PUT /api/agents/:id/tools
│   │       ├── tools/                   # Tool CRUD
│   │       │   ├── route.ts             # GET/POST /api/tools
│   │       │   └── [id]/route.ts        # GET/PUT/DELETE /api/tools/:id
│   │       ├── approvals/               # Approval management
│   │       │   ├── route.ts             # GET /api/approvals
│   │       │   └── [id]/
│   │       │       ├── resolve/route.ts # POST /api/approvals/:id/resolve
│   │       │       └── analyze/route.ts # POST /api/approvals/:id/analyze
│   │       ├── request-types/           # Request type CRUD
│   │       ├── escalations/             # Escalation management
│   │       ├── announcements/           # Announcement CRUD
│   │       ├── conversations/[id]/      # Conversation messages
│   │       └── knowledge/               # Knowledge base file management
│   │
│   ├── core/                      # Core orchestration engine
│   │   ├── orchestrator.ts        # LLM-based message routing
│   │   ├── agent-runner.ts        # Agent execution with tools
│   │   ├── escalation-detector.ts # Keyword-based escalation
│   │   └── knowledge-loader.ts    # Markdown knowledge base loader
│   │
│   ├── db/
│   │   └── index.ts               # SQLite schema, CRUD functions, seeding
│   │
│   ├── tools/                     # Agent tool implementations
│   │   ├── create-approval-request.ts  # PD budget approval tool
│   │   └── registry.ts            # builtin_key -> factory mapping
│   │
│   ├── knowledge/                 # Knowledge base markdown files
│   │   ├── pd-policy.md
│   │   ├── pto-vacation-policy.md
│   │   ├── recruiting-policy.md
│   │   └── onboarding-guide.md
│   │
│   ├── components/ui/             # shadcn/ui primitives
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   ├── tabs.tsx
│   │   └── textarea.tsx
│   │
│   └── lib/
│       └── utils.ts               # cn() utility for Tailwind class merging
│
├── deptagent.db                   # SQLite database file (auto-created)
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 4. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APP ROUTER                       │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────────────────────────┐  │
│  │ Employee Chat │    │          Admin Dashboard              │  │
│  │   (page.tsx)  │    │           (admin/page.tsx)            │  │
│  │              │    │                                        │  │
│  │  - Message UI │    │  - Agent CRUD    - Approvals          │  │
│  │  - Polling    │    │  - Tool Mgmt     - Escalations        │  │
│  │  - Approvals  │    │  - Knowledge     - Announcements      │  │
│  │  - Escalation │    │  - Request Types - AI Analysis        │  │
│  └──────┬───────┘    └────────────┬─────────────────────────┘  │
│         │                         │                             │
│  ═══════╪═════════════════════════╪═══════════════════════════  │
│         │         REST API LAYER  │                             │
│  ┌──────▼───────────────────────────────────────────────────┐  │
│  │                    API Routes (/api/*)                     │  │
│  │  /chat  /agents  /tools  /approvals  /escalations  ...    │  │
│  └──────┬────────────────────┬──────────────────────────────┘  │
│         │                    │                                  │
│  ═══════╪════════════════════╪══════════════════════════════   │
│         │    CORE ENGINE     │                                  │
│  ┌──────▼──────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ Orchestrator │  │ Agent Runner  │  │  Escalation   │  │   │
│  │  │  (router)    │  │ (executor)    │  │  Detector     │  │   │
│  │  └──────┬──────┘  └──────┬───────┘  └───────────────┘  │   │
│  │         │                │                               │   │
│  │  ┌──────▼──────────────────────────────────────────┐    │   │
│  │  │           Vercel AI SDK (generateText)           │    │   │
│  │  │  - LLM calls via Groq                           │    │   │
│  │  │  - Tool execution loop (maxSteps)               │    │   │
│  │  │  - Zod schema validation for tool inputs        │    │   │
│  │  └──────┬──────────────────────────────────────────┘    │   │
│  │         │                                                │   │
│  │  ┌──────▼──────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ Tool System  │  │  Knowledge   │  │    Agents     │  │   │
│  │  │ (registry +  │  │  Loader      │  │  (DB configs  │  │   │
│  │  │  factories)  │  │  (.md files) │  │   + tools)    │  │   │
│  │  └─────────────┘  └──────────────┘  └───────────────┘  │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                   │
│  ═══════════════════════════╪═══════════════════════════════   │
│                   DATA LAYER│                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │                   SQLite (better-sqlite3)                │   │
│  │                                                          │   │
│  │  conversations | messages | approvals | agent_configs    │   │
│  │  request_types | escalations | announcements            │   │
│  │  tools | agent_tools                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                     ┌────────▼────────┐
                     │   Groq Cloud    │
                     │ llama-3.3-70b   │
                     └─────────────────┘
```

### Design Principles

1. **Single-process architecture**: Next.js server handles both frontend and API. SQLite runs in-process with synchronous API. No external services needed except Groq.
2. **DB-driven configuration**: Agents, tools, request types, announcements are all managed through the database. No code changes needed for configuration.
3. **Registry pattern for tools**: Built-in tools are registered in `src/tools/registry.ts` with a `builtin_key` -> `factory` mapping. The DB stores which tools are assigned to which agents.
4. **Knowledge injection**: All `.md` files in `/src/knowledge/` are loaded and injected into every agent's system prompt at runtime.
5. **Polling-based real-time**: Both the admin dashboard (5s interval) and employee chat (3s for pending items) use polling for updates.

---

## 5. Database Layer

### File: `src/db/index.ts`

The database is a single SQLite file (`deptagent.db`) auto-created in the project root. All operations are synchronous via `better-sqlite3`. Tables are created on module import. Seed data is also inserted on module import via `INSERT OR IGNORE`.

### Entity-Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ conversations │───1:N─│   messages    │       │  approvals   │
│──────────────│       │──────────────│       │──────────────│
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ created_at   │       │ conversation_│       │ conversation_│
│              │       │   id (FK)    │       │   id (FK)    │
│              │       │ role         │       │ employee_name│
│              │       │ content      │       │ request_type │
│              │       │ agent_id     │       │ details      │
│              │       │ is_admin_reply│      │ status       │
│              │       │ created_at   │       │ admin_note   │
│              │       └──────────────┘       │ created_at   │
│              │                               │ resolved_at  │
│              │──1:N──────────────────────────┘              │
│              │                                               │
│              │       ┌──────────────┐                       │
│              │───1:N─│ escalations  │                       │
│              │       │──────────────│                       │
│              │       │ id (PK)      │                       │
│              │       │ conversation_│                       │
│              │       │   id (FK)    │                       │
│              │       │ reason       │                       │
└──────────────┘       │ status       │                       │
                       │ created_at   │                       │
                       │ resolved_at  │                       │
                       └──────────────┘                       │
                                                               │
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ agent_configs │──M:N─│ agent_tools  │───M:N─│    tools     │
│──────────────│       │──────────────│       │──────────────│
│ id (PK)      │       │ agent_id(PK,FK)     │ id (PK)      │
│ name         │       │ tool_id (PK,FK)     │ name         │
│ emoji        │       └──────────────┘       │ description  │
│ description  │                               │ tool_type    │
│ system_prompt│                               │ builtin_key  │
│ type         │       ┌──────────────┐       │ mcp_config   │
│ enabled      │       │request_types │       │ enabled      │
│ created_at   │       │──────────────│       │ created_at   │
│ updated_at   │       │ id (PK)      │       │ updated_at   │
└──────────────┘       │ name         │       └──────────────┘
                       │ description  │
                       │ required_    │       ┌──────────────┐
                       │   fields     │       │announcements │
                       │ enabled      │       │──────────────│
                       │ created_at   │       │ id (PK)      │
                       │ updated_at   │       │ title        │
                       └──────────────┘       │ content      │
                                               │ priority     │
                                               │ active       │
                                               │ created_at   │
                                               │ expires_at   │
                                               └──────────────┘
```

### Table Details

#### `conversations`
Tracks chat sessions. Each session gets a UUID.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| created_at | INTEGER | Unix timestamp |

#### `messages`
Individual messages within a conversation.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| conversation_id | TEXT FK | References conversations |
| role | TEXT | `'user'` or `'assistant'` |
| content | TEXT | Message text |
| agent_id | TEXT | Which agent generated this response (null for user) |
| is_admin_reply | INTEGER | 1 if this is an admin reply to an escalated conversation |
| created_at | INTEGER | Unix timestamp |

#### `approvals`
PD budget approval requests created by the Benefits agent tool.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| conversation_id | TEXT FK | Conversation where request was made |
| employee_name | TEXT | Name provided by employee |
| request_type | TEXT | Category (book, course, certification, etc.) |
| details | TEXT | JSON string: `{itemName, description, costUsd}` |
| status | TEXT | `'pending'`, `'approved'`, or `'rejected'` |
| admin_note | TEXT | Optional note from admin when resolving |
| created_at | INTEGER | Unix timestamp |
| resolved_at | INTEGER | When admin resolved (null if pending) |

#### `agent_configs`
Agent definitions. Managed entirely via admin UI.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Slug identifier (e.g., `benefits_agent`) |
| name | TEXT | Display name |
| emoji | TEXT | Display emoji |
| description | TEXT | Used by orchestrator for routing decisions |
| system_prompt | TEXT | Full system prompt sent to LLM |
| type | TEXT | `'general'` or `'benefits'` (legacy, kept for compatibility) |
| enabled | INTEGER | 1 = active, 0 = disabled |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

#### `tools`
Tool definitions. Built-in tools map to actual code; MCP tools are placeholders.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Identifier (e.g., `create_approval_request`) |
| name | TEXT | Display name |
| description | TEXT | What the tool does |
| tool_type | TEXT | `'builtin'` (functional) or `'mcp'` (placeholder) |
| builtin_key | TEXT | Maps to `BUILTIN_TOOLS` registry key |
| mcp_config | TEXT | JSON metadata for MCP connectors (future use) |
| enabled | INTEGER | 1 = available for assignment |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

#### `agent_tools`
Junction table connecting agents to tools (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| agent_id | TEXT PK,FK | References agent_configs.id |
| tool_id | TEXT PK,FK | References tools.id |

Both foreign keys have `ON DELETE CASCADE`.

#### `request_types`
Categories of PD budget requests. Used to build the tool's Zod enum schema.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Slug (e.g., `book`, `course`) |
| name | TEXT | Display name |
| description | TEXT | Category description |
| required_fields | TEXT | JSON array of `{key, label, type, required}` |
| enabled | INTEGER | 1 = active |

#### `escalations`
Tracks conversations escalated to human admins.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| conversation_id | TEXT FK | The escalated conversation |
| reason | TEXT | Why it was escalated |
| status | TEXT | `'open'` or `'closed'` |
| created_at | INTEGER | Unix timestamp |
| resolved_at | INTEGER | When closed |

#### `announcements`
Admin-published announcements shown in employee chat.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| title | TEXT | Headline |
| content | TEXT | Body text |
| priority | TEXT | `'low'`, `'normal'`, `'high'`, `'urgent'` |
| active | INTEGER | 1 = visible |
| created_at | INTEGER | Unix timestamp |
| expires_at | INTEGER | Auto-hide after this time (null = no expiry) |

### Seed Data

On first run, the following data is auto-inserted:

**Agents (5):**
- `policy_agent` - General HR policy questions
- `benefits_agent` - PD budget requests and benefits (has `create_approval_request` tool assigned)
- `recruiting_agent` - Hiring process and referral programs
- `onboarding_agent` - New hire onboarding
- `leave_agent` - PTO and leave policies

**Tools (5):**
- `create_approval_request` (builtin, enabled) - Functional approval tool
- `mcp_slack` (mcp, disabled) - Placeholder
- `mcp_google_calendar` (mcp, disabled) - Placeholder
- `mcp_jira` (mcp, disabled) - Placeholder
- `mcp_github` (mcp, disabled) - Placeholder

**Agent-Tool assignments:**
- `benefits_agent` -> `create_approval_request`

**Request Types (6):**
- Book, Course, Certification, Conference, Workshop, Tool

---

## 6. Core Engine

The core engine is the brain of the system. It handles message routing, agent execution, escalation detection, and knowledge loading.

### 6.1 Orchestrator (`src/core/orchestrator.ts`)

**Purpose**: Routes incoming employee messages to the most appropriate agent using LLM classification.

**How it works:**

```
Employee message
      │
      ▼
┌─────────────────────────┐
│   Build routing prompt   │
│   with all enabled       │
│   agent descriptions     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  LLM call (Groq)        │
│  "Classify this message  │
│   and route to correct   │
│   agent"                 │
│                          │
│  Response format:        │
│  {"agent": "xxx",        │
│   "reasoning": "..."}    │
└────────────┬────────────┘
             │
             ▼
       Agent ID returned
```

**Key details:**
- Model: `llama-3.3-70b-versatile` via Groq
- `maxOutputTokens: 100` (just needs a JSON response)
- Fallback: First enabled agent if routing fails or returns invalid JSON
- The prompt dynamically includes all enabled agents' descriptions from the DB

**Routing prompt structure:**
```
You are an HR request router. Classify the employee's message...

Available agents:
- policy_agent: Answers questions about general HR policies...
- benefits_agent: Handles benefit requests, PD budget submissions...
- recruiting_agent: Answers questions about hiring process...
...

Respond with ONLY valid JSON: {"agent": "...", "reasoning": "..."}
```

### 6.2 Agent Runner (`src/core/agent-runner.ts`)

**Purpose**: Executes a specific agent with its tools, knowledge base, and announcements.

**Execution flow:**

```
┌───────────────────────────────────────────────────┐
│  1. Load knowledge base (all .md files)            │
│  2. Build system prompt:                           │
│     agent.systemPrompt                             │
│     + "## Company Knowledge Base\n" + knowledge    │
│     + "## Active Announcements\n" + announcements  │
│  3. Get agent's tools via getTools(conversationId) │
└───────────────────┬───────────────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  Has tools?         │
         └──┬──────────────┬───┘
          Yes              No
            │                │
            ▼                ▼
   ┌────────────────┐  ┌──────────────┐
   │ generateText   │  │ generateText  │
   │  with tools    │  │  (no tools)   │
   │  maxSteps: 3   │  │               │
   │  onStepFinish  │  │               │
   │  captures      │  │               │
   │  approvalId    │  │               │
   └────────┬───────┘  └──────┬───────┘
            │                  │
            ▼                  ▼
      RunResult { response, agentId, approvalId? }
```

**Vercel AI SDK `generateText` with tools:**
1. Sends system prompt + user message + tool definitions to LLM
2. If LLM decides to call a tool, SDK automatically executes the tool's `execute()` function
3. Tool result is sent back to LLM for the next step
4. Repeats until LLM produces a text response or `stepCountIs(3)` is reached
5. `onStepFinish` callback captures any `approvalId` from tool results

**This is the equivalent of LangChain's `AgentExecutor` or LangGraph's tool-calling node, but implemented in ~30 lines of code.**

### 6.3 Escalation Detector (`src/core/escalation-detector.ts`)

**Purpose**: Detects when an employee wants to talk to a human.

**Mechanism**: Simple keyword matching against a list of 13 phrases:
- "talk to a human", "escalate", "real person", "manager", etc.

**Returns**: `{ escalate: boolean, reason: string }`

This runs **before** the orchestrator, so escalation requests never reach an agent.

### 6.4 Knowledge Loader (`src/core/knowledge-loader.ts`)

**Purpose**: Loads all `.md` files from `src/knowledge/` and concatenates them.

**Mechanism**:
- Reads all `.md` files from the knowledge directory
- Formats each as `--- filename.md ---\n{content}`
- Caches in memory (cleared via `clearKnowledgeCache()` when files are edited through admin UI)
- Injected into every agent's system prompt

**Current knowledge files:**
- `pd-policy.md` - Personal Development budget ($1,500/year, eligible expenses, approval process)
- `pto-vacation-policy.md` - PTO and vacation rules
- `recruiting-policy.md` - Hiring process and referral program
- `onboarding-guide.md` - New hire checklists

---

## 7. Tool System

The tool system allows agents to take actions beyond text generation. It uses a **registry pattern** to map database entries to actual executable code.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Admin UI                               │
│  - Manage tools (enable/disable, edit)                   │
│  - Assign tools to agents via checkboxes                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Database                               │
│  tools table: id, name, tool_type, builtin_key, enabled  │
│  agent_tools junction: agent_id <-> tool_id              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Agent Loading (src/agents/index.ts)         │
│                                                          │
│  rowToAgentConfig(row) {                                 │
│    getTools: (convId) => {                               │
│      toolRows = getToolsForAgent(row.id)  // DB query    │
│      for each toolRow:                                   │
│        if builtin && registry has key:                   │
│          toolSet[key] = registry[key].factory(convId)    │
│      return toolSet                                      │
│    }                                                     │
│  }                                                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│           Tool Registry (src/tools/registry.ts)          │
│                                                          │
│  BUILTIN_TOOLS = {                                       │
│    "create_approval_request": {                          │
│      factory: (convId, requestTypes) =>                  │
│        makeCreateApprovalRequestTool(convId, requestTypes)│
│    }                                                     │
│  }                                                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│     Tool Implementation (src/tools/create-approval-...)  │
│                                                          │
│  Uses Vercel AI SDK's tool() function:                   │
│  - description: tells LLM when/how to use this tool      │
│  - inputSchema: Zod schema (LLM extracts these params)   │
│  - execute: actual logic (creates DB record)              │
└─────────────────────────────────────────────────────────┘
```

### `create_approval_request` Tool (the only built-in tool)

**File**: `src/tools/create-approval-request.ts`

**Input schema** (Zod, validated by AI SDK):
```typescript
{
  employeeName: string    // "Full name of the employee"
  requestType: enum       // Built from enabled request_types (book, course, etc.)
  itemName: string        // "Name of the book, course, certification, or event"
  description: string     // "Brief description and relevance"
  costUsd: number         // "Cost in USD as a number"
}
```

**Execution logic:**
1. Generates a UUID for the approval
2. Serializes `{itemName, description, costUsd}` as JSON
3. Inserts into `approvals` table with status `'pending'`
4. Returns `{approvalId, message}` to the LLM

**How the LLM decides to use the tool:**
The Benefits agent's system prompt instructs it:
> "When an employee wants to REQUEST or APPLY for PD budget, use the create_approval_request tool. Before submitting, make sure you have ALL required information."

The LLM reads this instruction + the tool's description and decides autonomously when to call it.

### Adding a New Built-in Tool

1. Create tool factory in `src/tools/my-tool.ts` using `tool()` from `ai`
2. Register in `src/tools/registry.ts`:
   ```typescript
   BUILTIN_TOOLS["my_tool_key"] = { factory: (...) => makeMyTool(...) };
   ```
3. Add seed data in `src/db/index.ts` (or create via admin UI)
4. Assign to agents via admin UI checkboxes

### MCP Tools (Future)

The database supports `tool_type: 'mcp'` with a `mcp_config` JSON field for future Model Context Protocol integration. Currently, MCP tools are displayed as disabled placeholders in the admin UI (Slack, Google Calendar, Jira, GitHub).

---

## 8. API Reference

All routes are under `/api/`. All request/response bodies are JSON.

### Chat

#### `POST /api/chat`

The main endpoint for employee conversations. Handles the full pipeline: escalation check -> routing -> agent execution -> response.

**Request:**
```json
{
  "message": "I'd like to request PD budget for a React course",
  "conversationId": "uuid-or-null"
}
```

**Response:**
```json
{
  "response": "I'd be happy to help you submit that request...",
  "conversationId": "abc-123",
  "agentUsed": {
    "id": "benefits_agent",
    "name": "Benefits Agent",
    "emoji": "..."
  },
  "approval": {
    "id": "xyz-456",
    "status": "pending",
    "adminNote": null
  },
  "escalated": false
}
```

**Internal flow:**
1. Validate message
2. Create conversation if new
3. Save user message to DB
4. Check if conversation already has open escalation -> return escalation message
5. Check for escalation keywords -> create escalation, return
6. Route via orchestrator LLM -> get agentId
7. Load agent with tools -> run agent
8. Save assistant message to DB
9. Return response with agent info and approval status

### Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create agent. Body: `{id, name, emoji?, description?, systemPrompt?, type?}` |
| GET | `/api/agents/:id` | Get single agent |
| PUT | `/api/agents/:id` | Update agent (partial). Body: any subset of fields |
| DELETE | `/api/agents/:id` | Delete agent |
| GET | `/api/agents/:id/tools` | Get assigned tool IDs: `{toolIds: string[]}` |
| PUT | `/api/agents/:id/tools` | Replace assigned tools. Body: `{toolIds: string[]}` |

### Tools

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tools` | List all tools |
| POST | `/api/tools` | Create builtin tool. Body: `{id, name, description?, builtin_key?}` |
| GET | `/api/tools/:id` | Get single tool |
| PUT | `/api/tools/:id` | Update tool (name, description, enabled) |
| DELETE | `/api/tools/:id` | Delete tool |

### Approvals

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/approvals` | List all approvals (query: `?status=pending`) |
| POST | `/api/approvals/:id/resolve` | Approve/reject. Body: `{action: "approve"|"reject", note?}` |
| POST | `/api/approvals/:id/analyze` | AI policy analysis. Returns `{analysis: PolicyAnalysis}` |

### Request Types

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/request-types` | List all request types |
| POST | `/api/request-types` | Create. Body: `{id, name, description, requiredFields}` |
| PUT | `/api/request-types/:id` | Update |
| DELETE | `/api/request-types/:id` | Delete |

### Escalations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/escalations` | List all escalations |
| PUT | `/api/escalations/:id` | Close escalation / send admin reply |

### Conversations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/conversations/:id` | Get messages + escalation status for a conversation |

### Announcements

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/announcements` | List all (query: `?active=true` for active only) |
| POST | `/api/announcements` | Create. Body: `{title, content, priority, expiresAt?}` |
| PUT | `/api/announcements/:id` | Update |
| DELETE | `/api/announcements/:id` | Delete |

### Knowledge

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/knowledge` | List knowledge files with content |
| PUT | `/api/knowledge/:filename` | Update file content. Body: `{content}` |

### Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Dashboard statistics |

**Response:**
```json
{
  "agentsEnabled": 5,
  "agentsTotal": 5,
  "pendingApprovals": 2,
  "totalRequests": 10,
  "totalConversations": 25,
  "openEscalations": 1,
  "activeAnnouncements": 3
}
```

---

## 9. Admin Dashboard

### File: `src/app/admin/page.tsx`

The admin dashboard is a single-page application within Next.js. All views share a sidebar and are toggled via a `ViewState` discriminated union.

### State Management

The admin page uses React `useState` + `useCallback` with polling:

```typescript
type ViewState =
  | { type: "dashboard" }
  | { type: "approvals" }
  | { type: "agent-detail"; agentId: string }
  | { type: "agent-new" }
  | { type: "request-types" }
  | { type: "tools" }
  | { type: "escalations" }
  | { type: "escalation-detail"; conversationId: string }
  | { type: "knowledge" }
  | { type: "knowledge-edit"; filename: string }
  | { type: "announcements" };
```

**Polling** (every 5 seconds):
- `GET /api/approvals` -> approval list
- `GET /api/agents` -> agent list
- `GET /api/stats` -> dashboard statistics

### Views

#### Dashboard (`dashboard-view.tsx`)
- Summary stat cards (agents, approvals, conversations, escalations, announcements)
- Recent activity feed (resolved approvals)
- Pending approvals with inline resolve (approve/reject with note)
- "Analyze with AI" button per pending approval

#### Approvals (`approvals-view.tsx`)
- Full approval list with filtering
- Inline resolution with admin notes
- AI policy analysis integration

#### Agent Detail (`agent-detail-view.tsx`)
- Edit agent: name, emoji, description, system prompt
- **Tools section**: Checkboxes to assign/unassign built-in tools
- Toggle enabled/disabled
- Delete with confirmation

#### New Agent (`new-agent-view.tsx`)
- Create form with all agent fields
- Tool selection checkboxes
- Creates agent then assigns tools via separate API call

#### Tools (`tools-view.tsx`)
- **Built-in Tools section**: Card list with toggle, edit, delete
- **External Connectors (MCP) section**: Placeholder cards (Slack, Calendar, Jira, GitHub) with "Coming Soon" badge, disabled controls, reduced opacity

#### Request Types (`request-types-view.tsx`)
- CRUD for PD request categories
- Dynamic field editor (key, label, type, required)

#### Escalations (`escalations-view.tsx` + `escalation-detail-view.tsx`)
- List of open/closed escalations
- Conversation view with admin reply capability

#### Knowledge Base (`knowledge-view.tsx`)
- List of markdown files
- Inline editor with save/cancel

#### Announcements (`announcements-view.tsx`)
- CRUD for announcements
- Priority levels, active toggle, expiry date

### Sidebar (`sidebar.tsx`)

Navigation structure:
```
DeptAgent Admin Console
├── Dashboard
├── Approvals (badge: pending count)
├── ─────────
├── Escalations (badge: open count)
├── Announcements
├── Knowledge Base
├── Request Types
├── Tools
├── ─────────
├── Agents (scrollable list)
│   ├── Policy Agent (green/gray dot)
│   ├── Benefits Agent
│   ├── Recruiting Agent
│   ├── Onboarding Agent
│   └── Leave & Time-Off Agent
├── + Add Agent
├── ─────────
└── Employee Chat (link to /)
```

---

## 10. Employee Chat Interface

### File: `src/app/page.tsx`

A simple chat UI at the root path (`/`).

### Features

- **Message bubbles**: User (right, blue) / Assistant (left, gray)
- **Agent badge**: Shows which agent responded (e.g., "Benefits Agent")
- **Approval cards**: Inline status cards for PD requests (pending/approved/rejected)
- **Announcement banners**: Top-of-chat banners for active announcements (dismissible)
- **Escalation UI**: Purple banner when conversation is escalated
- **Admin reply display**: Purple-styled messages from admin
- **Polling**:
  - Approval status: 3s interval when pending approvals exist
  - Escalation replies: 3s interval when conversation is escalated
  - Announcements: 30s interval

### Message Flow (User Perspective)

```
User types: "I want to apply for a React course, $500"
     │
     ▼
POST /api/chat { message, conversationId }
     │
     ▼
Response:
  - Agent badge: "Benefits Agent"
  - Message: "I'll submit that for you. Can you confirm your full name?"
     │
User: "John Smith"
     │
     ▼
Response:
  - Agent badge: "Benefits Agent"
  - Message: "Your PD request has been submitted..."
  - Approval card: { id: "xxx", status: "pending" }
     │
     ▼  (polling every 3s)
Admin approves in dashboard
     │
     ▼
Approval card updates: { status: "approved", adminNote: "Looks good!" }
```

---

## 11. Data Flow Diagrams

### Complete Chat Message Flow

```
┌──────────┐     POST /api/chat      ┌──────────────────┐
│ Employee  │ ─────────────────────── │   Chat Route      │
│   Chat    │                         │ (src/app/api/     │
│   UI      │                         │  chat/route.ts)   │
└──────────┘                         └────────┬─────────┘
                                              │
                                    ┌─────────▼──────────┐
                                    │ Save user message   │
                                    │ to DB               │
                                    └─────────┬──────────┘
                                              │
                                    ┌─────────▼──────────┐
                                    │ Check existing      │
                                    │ escalation          │──── Yes ──> Return escalation msg
                                    └─────────┬──────────┘
                                              │ No
                                    ┌─────────▼──────────┐
                                    │ Escalation keyword  │
                                    │ detection           │──── Yes ──> Create escalation,
                                    └─────────┬──────────┘             return message
                                              │ No
                                    ┌─────────▼──────────┐
                                    │ Orchestrator        │
                                    │ LLM routes to       │
                                    │ best agent          │
                                    └─────────┬──────────┘
                                              │ agentId
                                    ┌─────────▼──────────┐
                                    │ Load AgentConfig    │
                                    │ from DB + tools     │
                                    │ from agent_tools    │
                                    └─────────┬──────────┘
                                              │
                                    ┌─────────▼──────────┐
                                    │ Agent Runner        │
                                    │ - Inject knowledge  │
                                    │ - Inject announce.  │
                                    │ - generateText      │
                                    │   with tools        │
                                    │   (max 3 steps)     │
                                    └─────────┬──────────┘
                                              │
                                    ┌─────────▼──────────┐
                                    │ If tool called:     │
                                    │ create_approval_req │
                                    │ -> Insert approval  │
                                    │    into DB          │
                                    └─────────┬──────────┘
                                              │
                                    ┌─────────▼──────────┐
                                    │ Save assistant msg  │
                                    │ Return response +   │
                                    │ agent info +        │
                                    │ approval status     │
                                    └────────────────────┘
```

### AI-Assisted Approval Analysis Flow

```
Admin clicks "Analyze with AI"
         │
         ▼
POST /api/approvals/:id/analyze
         │
         ▼
┌────────────────────────────────────┐
│ Load approval details from DB       │
│ Load full knowledge base            │
│                                     │
│ System prompt:                      │
│   "You are an HR Policy Analyst..." │
│   + all company policy documents    │
│                                     │
│ User message:                       │
│   "Analyze this request:            │
│    Employee: John Smith             │
│    Type: course                     │
│    Item: React Advanced             │
│    Cost: $500"                      │
│                                     │
│ LLM returns JSON:                   │
│ {                                   │
│   recommendation: "approve",        │
│   confidence: "high",               │
│   reasoning: "Within $1500 limit..",│
│   references: ["pd-policy.md"],     │
│   flags: [],                        │
│   summary: "Standard PD request"    │
│ }                                   │
└──────────┬─────────────────────────┘
           │
           ▼
Admin sees analysis card with
recommendation, confidence, reasoning,
policy references, and flags
```

---

## 12. Configuration & Environment

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq Cloud API key for LLM inference |

### Scripts

```bash
pnpm dev      # Start development server (hot reload)
pnpm build    # Production build
pnpm start    # Start production server
```

### Database

- Auto-created as `deptagent.db` in the project root
- Delete this file to reset all data (tables and seeds are recreated on startup)
- No migrations needed -- schema is defined via `CREATE TABLE IF NOT EXISTS`

### LLM Configuration

- **Provider**: Groq Cloud
- **Model**: `llama-3.3-70b-versatile`
- **Used in 3 places**:
  1. `orchestrator.ts` - Message routing (maxOutputTokens: 100)
  2. `agent-runner.ts` - Agent response generation (maxSteps: 3)
  3. `analyze/route.ts` - Approval policy analysis

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **SQLite (not Postgres)** | Single-file embedded DB, zero setup, perfect for PoC. Synchronous API simplifies code. |
| **Vercel AI SDK (not LangChain)** | Lighter weight, native TypeScript, built-in tool execution loop. 30 lines vs hundreds. |
| **Groq (not OpenAI)** | Fast inference for latency-sensitive routing. Free tier for PoC. |
| **Polling (not WebSocket)** | Simpler implementation. 3-5s intervals are acceptable for this use case. |
| **Single Next.js app** | Frontend + API + DB in one process. Simplifies deployment for PoC. |
| **DB-driven tool assignment** | Agents can gain/lose tools via admin UI without code changes. |
| **Knowledge injection (not RAG)** | Policy documents are small enough to include in full. No vector DB overhead. |
