---
capability: admin-dashboard
version: 1
last_synced_from: 7adcbcf

entry_points:
  - path: src/app/admin/page.tsx
    symbol: AdminPage
    role: "Top-level admin SPA. Manages view routing, data fetching, 5-second polling refresh."
  - path: src/app/admin/components/sidebar.tsx
    role: "Nav: Dashboard / Agents / Approvals / Knowledge / Announcements / Tools / Request Types / Escalations."
  - path: src/app/admin/components/agent-detail-view.tsx
    role: "Edit form for one agent: name, prompt, knowledge bindings, tool bindings, enabled flag."
  - path: src/app/admin/components/approvals-view.tsx
    role: "Approval queue with inline LLM analysis (calls /api/approvals/[id]/analyze) and resolve buttons."
  - path: src/app/admin/components/escalations-view.tsx
    role: "List of open conversations escalated to a human."
  - path: src/app/api/agents/route.ts
    role: "Agent CRUD."
  - path: src/app/api/announcements/route.ts
    role: "Announcement CRUD. Active announcements are injected into every agent prompt."
  - path: src/app/api/escalations/[id]/route.ts
    role: "Admin reply on an escalated conversation; injected back into the employee's message stream."
  - path: src/app/api/stats/route.ts
    role: "Aggregate counts for the dashboard summary cards."

invariants:
  - id: admin-writes-bypass-llm
    statement: "Admin actions (create agent, post announcement, resolve approval, reply to escalation) are direct DB writes. No LLM call sits in the admin write path."
    enforced_by: "All routes under src/app/api/{agents,announcements,approvals/[id]/resolve,escalations/[id]}/"
  - id: polling-interval-5s
    statement: "Admin SPA refetches approvals, agents, and stats every 5 seconds via setInterval. There is no push channel."
    enforced_by: src/app/admin/page.tsx:76-83
  - id: active-announcements-injected-everywhere
    statement: "Any announcement with active=true and within its date window is read by agent-runner on every request and prepended to the agent's system prompt."
    enforced_by: src/core/agent-runner.ts:23-29
  - id: no-auth
    statement: "There is no authentication or authorization layer. /admin and all /api/* are open. Production deployment requires an external gate (e.g. middleware, reverse proxy auth)."
    enforced_by: "Absence of auth middleware in next.config.ts and src/app/**"
  - id: agent-disable-not-delete
    statement: "Disabling an agent (enabled=0) removes it from routing immediately but preserves history. Deletion is a separate, harder action."
    enforced_by: src/core/orchestrator.ts:8 (filters by enabled), src/agents/index.ts:33 (skip if !enabled)

contracts:
  - symbol: GET /api/stats
    location: src/app/api/stats/route.ts
    input: "(none)"
    output: "{ agentsEnabled, agentsTotal, pendingApprovals, totalRequests, totalConversations, openEscalations, activeAnnouncements }"
    side_effects:
      - "Multiple DB count queries. No write."
  - symbol: GET/POST /api/agents
    location: src/app/api/agents/route.ts
    input: "list (GET) or { name, emoji, description, systemPrompt, type, enabled } (POST)"
    output: "{ agents: AgentConfigRow[] } or { agent: AgentConfigRow }"
  - symbol: GET/POST/DELETE /api/announcements
    location: src/app/api/announcements/route.ts
    input: "list / { title, content, priority, startsAt?, endsAt? } / DELETE by id"
    output: "{ announcements } or { announcement } or { ok: true }"
  - symbol: POST /api/escalations/[id]
    location: src/app/api/escalations/[id]/route.ts
    input: "{ message: string }"
    output: "{ ok: true }"
    side_effects:
      - "addMessage with role='assistant', isAdminReply=true so the employee sees it as admin response"

upstream_deps:
  - db (extensive — every table)
  - knowledge-base (KnowledgeView reads/writes src/knowledge/*.md via API)
  - tools-and-approvals (ApprovalsView resolves approvals)
  - agent-orchestration (announcements feed into prompts; agent-detail-view edits prompts/tools/knowledge bindings)

downstream_consumers:
  - "Internal: department admins via browser at /admin"
  - employee-chat-ui (active announcements show as banners; escalation admin replies appear in the chat)
  - slack-integration (admin can also resolve approvals via Slack; escalations notify admin channel)

common_changes:
  - description: "Add a new admin view"
    touches: [src/app/admin/components/<new-view>.tsx, src/app/admin/components/sidebar.tsx, src/app/admin/components/shared.tsx (ViewState type), src/app/admin/page.tsx (route)]
  - description: "Add a new field to an agent (e.g. temperature)"
    touches: ["DB: agents schema migration", src/agents/types.ts, src/app/admin/components/agent-detail-view.tsx, src/app/admin/components/new-agent-view.tsx, src/app/api/agents/route.ts, src/app/api/agents/[id]/route.ts, "agent-runner if the field affects behavior"]
  - description: "Add a new approval status (e.g. 'awaiting-info')"
    touches: ["DB: approvals.status enum widening", src/app/api/approvals/[id]/resolve/route.ts, src/app/admin/components/approvals-view.tsx, src/components (employee ApprovalCard)]
  - description: "Add authentication"
    touches: ["new middleware.ts", "session storage", "all /api/* routes", "/admin layout"]

gotchas:
  - "5-second polling is wasteful at scale but simple. If the admin has the tab open all day, it issues ~17K API calls. Acceptable for PoC; replace with SSE or WebSocket when scaling."
  - "There is no soft-delete for agents. Deleting an agent loses history references (messages.agent_id is just a string and may become dangling)."
  - "Resolving an approval has no idempotency. Clicking 'Approve' twice fires two DB writes; the second is a no-op only because the row is already updated. A burst of double-clicks can also produce a flicker in the polling-refreshed UI."
  - "AdminPage uses one big component for view routing. Each new view ships a tighter coupling to shared.tsx ViewState. Refactor candidate when ViewState grows past ~10 variants."
  - "Stats route does N count queries every 5s. With many concurrent admins, this becomes the bottleneck before the LLM does."
  - "Knowledge editor writes directly to src/knowledge/*.md via the filesystem. In a containerized deploy, the path inside the container is what gets written; this requires a writable mount or the docs vanish on restart."

cross_refs:
  - capability: agent-orchestration
    relationship: "Announcements managed here are injected into every agent system prompt. Agent enable/disable here changes routing on the next message."
  - capability: knowledge-base
    relationship: "Admin UI is the only safe way to edit knowledge files; manual filesystem edits bypass cache invalidation."
  - capability: tools-and-approvals
    relationship: "Approval resolution is one of admin's most frequent actions; the resolve endpoint is shared with Slack interactions."
  - capability: slack-integration
    relationship: "Escalations show up in admin's Slack channel as a notification; admin can resolve approvals from either surface."
---

# admin-dashboard — Agent Context

## Mental model

Admins manipulate the system by writing to the database, not by talking
to an LLM. The /admin SPA polls the API every 5 seconds and renders the
state. Most "admin changes" take effect on the very next agent invocation
because the agent path always re-reads its config (no caching at the
agent level).

## Read order

1. This file's frontmatter.
2. `src/app/admin/page.tsx` — the SPA shell and view routing (~300+ lines).
3. `src/app/admin/components/shared.tsx` — types, constants, ViewState.
4. The specific view component matching your investigation (approvals-view.tsx, agent-detail-view.tsx, announcements-view.tsx, knowledge-view.tsx, escalations-view.tsx).
5. The corresponding `src/app/api/*` route handler for the write path.

When investigating "admin change did not take effect", check three layers in order: DB row (did the write happen?), polling refresh (did the SPA see it within 5s?), and downstream consumer (does the agent re-read on every request?).
