# DeptAgent

**An open-source, department-level AI agent orchestration platform.**

Every department has its own knowledge, workflows, and processes. DeptAgent gives each department a self-contained AI system where domain-specific agents handle questions, automate requests, and route employees to the right resource -- all through a single chat interface.

---

## The Problem

Organizations run on departmental knowledge -- HR policies, engineering runbooks, finance procedures, legal guidelines. Today, this knowledge lives in scattered wikis, PDFs, and Slack threads. Employees waste time searching, asking the wrong person, or getting outdated answers.

Existing solutions either:
- **Generic chatbots** that hallucinate because they lack domain context
- **Enterprise platforms** that cost six figures and take months to deploy
- **Single-purpose tools** that solve one workflow but can't generalize

There is no lightweight, self-hosted solution that lets each department own and operate its own AI agent system.

## The Solution

DeptAgent is a **department-scoped multi-agent orchestration platform**. Each department gets:

1. **A set of specialized agents** -- each with its own role, knowledge base, and capabilities
2. **An intelligent router** -- an LLM orchestrator that reads employee intent and routes to the best agent
3. **An admin dashboard** -- department admins manage agents, review requests, and monitor usage without writing code
4. **An action layer** -- agents don't just answer questions; they can trigger workflows like approval requests, ticket creation, or form submissions

The key insight: **the department is the right unit of AI deployment**, not the entire organization. Each department has distinct knowledge, distinct workflows, and distinct owners who should control the system.

---

## How It Works

```
Employee: "I'd like to request PD budget for an AWS certification."

                        +------------------+
   Employee message --> | LLM Orchestrator | --> Reads all agent descriptions
                        +------------------+     and routes by intent
                                |
            +-------------------+-------------------+
            |                   |                   |
      +-----------+      +-----------+      +-----------+
      |  Policy   |      | Benefits  |      |  Leave    |
      |  Agent    |      |  Agent    |      |  Agent    |
      +-----------+      +-----------+      +-----------+
            |                   |                   |
       Knowledge           Knowledge +          Knowledge
        (markdown)          Tools (actions)      (markdown)
                                |
                        Submits approval
                        request to admin queue
```

### End-to-End Flow

1. Employee sends a message through the chat interface
2. The **Orchestrator** (LLM) analyzes the message against all enabled agent descriptions and selects the best match
3. The selected **Agent** runs with its own system prompt + the department's knowledge base
4. If the agent has **tools**, it can take actions (e.g., submit an approval request, create a ticket)
5. The response is returned to the employee, tagged with which agent handled it
6. **Admins** review action items (approvals, requests) through the dashboard with optional AI-powered policy analysis

---

## Architecture

```
src/
+-- knowledge/          # Department knowledge base (Markdown files)
|   +-- pd-policy.md
|   +-- recruiting-policy.md
|   +-- onboarding-guide.md
|   +-- pto-vacation-policy.md
|
+-- core/
|   +-- orchestrator.ts   # LLM-based intent routing
|   +-- agent-runner.ts   # Agent execution engine
|   +-- knowledge-loader.ts  # Loads all .md files as context
|
+-- agents/
|   +-- types.ts          # AgentConfig interface
|   +-- index.ts          # Agent registry (DB-backed)
|
+-- tools/                # Agent capabilities (actions)
|   +-- create-approval-request.ts
|
+-- db/                   # SQLite persistence
|   +-- index.ts          # Schema, CRUD, agent seeding
|
+-- app/                  # Next.js App Router
    +-- page.tsx           # Employee chat interface
    +-- admin/page.tsx     # Admin dashboard
    +-- api/               # REST API layer
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Markdown knowledge base** | Non-technical department owners can edit policies without touching code |
| **SQLite** | Zero-config, single-file database. No infrastructure needed to get started |
| **Agent configs in DB** | Admins can add/edit/disable agents from the dashboard at runtime |
| **LLM orchestrator (not keyword matching)** | Natural language understanding for routing means agents can be added without updating routing rules |
| **Tool system per agent type** | Only agents that need actions get tools. Information-only agents stay simple and safe |

---

## Example: HR Department

This is the built-in demo. An HR department with 5 specialized agents:

| Agent | Role | Type |
|-------|------|------|
| Policy Agent | General HR policy Q&A | Information |
| Benefits Agent | PD budget submissions & approvals | Action |
| Recruiting Agent | Hiring process, referrals, interview procedures | Information |
| Onboarding Agent | New hire checklist, IT setup, account access | Information |
| Leave Agent | PTO, sick leave, parental leave policies | Information |

### Sample Interactions

**Policy question routed to a specialized agent:**
```
Employee: "How does the employee referral bonus work?"
Orchestrator -> recruiting_agent (description match: "referral bonus program")
Agent: "Our Employee Referral Program offers $2,000 for IC roles and
        $3,500 for manager-level and above. The bonus is paid after
        the referred hire completes 90 days..."
```

**Action request routed to the benefits agent:**
```
Employee: "I want to use my PD budget for a $450 Coursera subscription."
Orchestrator -> benefits_agent (intent: submit/apply/request)
Agent: [Calls create_approval_request tool]
       "Your PD request has been submitted! Approval ID: abc-123.
        The request for Coursera subscription ($450) is now in the
        admin queue for review."
```

**Admin reviews with AI-powered analysis:**
```
Admin clicks "Analyze" on the pending request.
AI Policy Analyst: {
  recommendation: "approve",
  confidence: "high",
  reasoning: "Online courses are explicitly listed as eligible PD expenses.
              Cost is under the $500 VP-approval threshold.",
  flags: []
}
```

---

## Beyond HR: Other Department Examples

DeptAgent is not an HR tool. HR is one example. The same architecture works for any department:

### Engineering / DevOps
| Agent | Role | Possible Tools |
|-------|------|----------------|
| Incident Agent | Runbook lookup, escalation procedures | Create PagerDuty incident |
| Infrastructure Agent | Cloud resource policies, cost guidelines | Submit infra request |
| Security Agent | Compliance policies, vulnerability response | Create Jira security ticket |
| Release Agent | Deployment procedures, rollback guides | Trigger CI/CD pipeline |

### Finance
| Agent | Role | Possible Tools |
|-------|------|----------------|
| Expense Agent | Expense policy, reimbursement rules | Submit expense report |
| Budget Agent | Department budget queries, fiscal calendar | Request budget allocation |
| Procurement Agent | Vendor policies, purchasing thresholds | Create purchase order |

### Legal
| Agent | Role | Possible Tools |
|-------|------|----------------|
| Contract Agent | Contract templates, review guidelines | Request legal review |
| Compliance Agent | Regulatory requirements, audit procedures | File compliance report |
| IP Agent | Patent process, NDA policies | Submit IP disclosure |

### IT / Helpdesk
| Agent | Role | Possible Tools |
|-------|------|----------------|
| Access Agent | Account provisioning, permission policies | Submit access request |
| Equipment Agent | Hardware policies, refresh cycles | Create equipment ticket |
| Network Agent | VPN setup, connectivity troubleshooting | Open network ticket |

Each department deploys its own DeptAgent instance with its own knowledge files, agents, and tools -- fully independent, fully owned by the department.

---

## Admin Dashboard

The admin dashboard gives department owners full control without code:

### Dashboard Overview
- Active agents count, pending approvals, total requests, conversation volume
- Recent activity feed with resolved/pending items

### Agent Management
- Add, edit, or disable agents from the UI
- Edit system prompts and descriptions in real time
- Toggle agent availability without redeployment

### Approval Workflow
- Review pending action requests submitted by agents
- AI-powered policy analysis for each request (recommendation, confidence, reasoning, flags)
- Approve/reject with admin notes
- Full audit trail of all decisions

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui |
| LLM | Groq (Llama 3.3 70B) via Vercel AI SDK |
| Database | SQLite (better-sqlite3) |
| Language | TypeScript |
| Tools | Zod schema validation |

### Why This Stack

- **Next.js**: Full-stack in one project. API routes + SSR + static pages. No separate backend to deploy.
- **SQLite**: Zero infrastructure. The entire state is a single file. Clone, install, run.
- **Groq + Llama**: Fast inference, no vendor lock-in. Swap to OpenAI, Anthropic, or local models by changing one line (Vercel AI SDK abstraction).
- **Markdown knowledge**: Anyone can update department knowledge. No embedding pipeline, no vector DB -- just edit a file.

---

## Getting Started

```bash
# Clone and install
git clone <repo-url>
cd deptagent-poc
pnpm install

# Set your LLM API key
echo "GROQ_API_KEY=gsk_your_key_here" > .env.local

# Run
pnpm dev
```

That's it. Open `http://localhost:3000` to chat, `http://localhost:3000/admin` to manage.

### Adding a New Agent (No Code Required)

1. Go to Admin Dashboard > Agent Management > "Add Agent"
2. Fill in: ID, name, description, system prompt, type
3. Save. The orchestrator will immediately start routing relevant messages to it.

### Adding Department Knowledge (No Code Required)

1. Drop a `.md` file into `src/knowledge/`
2. Restart the server (or wait for hot reload in dev mode)
3. All agents now have access to the new knowledge.

---

## Roadmap

### Near-Term
- [ ] RAG with vector embeddings for large knowledge bases
- [ ] Per-agent knowledge scoping (agent sees only relevant documents)
- [ ] Conversation history context (multi-turn memory)
- [ ] Authentication and role-based access

### Mid-Term
- [ ] Multi-department support (single deployment, isolated departments)
- [ ] Pluggable tool registry (connect to Jira, Slack, PagerDuty, etc.)
- [ ] Webhook integrations for action notifications
- [ ] Usage analytics and agent performance metrics

### Long-Term
- [ ] Multi-tenant SaaS mode
- [ ] Custom LLM provider per department
- [ ] Agent-to-agent handoff (escalation chains)
- [ ] Audit logging and compliance export

---

## Why DeptAgent?

| | Generic Chatbot | Enterprise Platform | DeptAgent |
|---|---|---|---|
| Setup time | Minutes | Months | Minutes |
| Department ownership | No | Partial | Full |
| Agent customization | Limited | Config-heavy | Dashboard UI |
| Action capabilities | No | Yes | Yes (extensible tools) |
| Self-hosted option | Rare | No | Yes |
| Cost | Free-$$ | $$$$$ | Free (OSS) |
| Knowledge format | Embeddings | Proprietary | Markdown files |

**DeptAgent sits in the sweet spot**: powerful enough to handle real workflows with approval chains and tool execution, simple enough that a department admin can set it up in an afternoon.

---

## License

MIT

---

*DeptAgent -- Give every department its own AI team.*
