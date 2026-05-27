---
capability: tools-and-approvals
version: 1
last_synced_from: 7adcbcf

entry_points:
  - path: src/tools/registry.ts
    symbol: BUILTIN_TOOLS
    role: "Registry of built-in tools keyed by stable tool name. Only entry: create_approval_request."
  - path: src/tools/create-approval-request.ts
    symbol: makeCreateApprovalRequestTool
    role: "Factory that returns a Vercel-AI-SDK tool bound to a conversation. Its execute() writes an approval row and returns an approvalId."
  - path: src/app/api/approvals/[id]/analyze/route.ts
    symbol: POST
    role: "LLM-powered policy analysis for a pending approval. Reads benefits_agent knowledge as policy context."
  - path: src/app/api/approvals/[id]/resolve/route.ts
    role: "Admin action: approve or reject. Writes the resolution to DB."
  - path: src/app/api/approvals/route.ts
    role: "Read endpoints: list approvals, get status."
  - path: src/app/api/request-types/route.ts
    role: "CRUD for request types (e.g. 'book', 'course', 'certification'). Used to constrain the tool's requestType enum at bind time."

invariants:
  - id: tool-bind-uses-current-request-types
    statement: "When agent-runner binds tools for a request, getEnabledRequestTypes() is read from DB and used to build the zod enum schema for requestType. The set is captured per-invocation, not at module load."
    enforced_by: src/agents/index.ts:17-19, src/tools/create-approval-request.ts:16-20
  - id: approval-write-on-tool-success
    statement: "Every successful invocation of the create_approval_request tool inserts exactly one row into the approvals table with status='pending'."
    enforced_by: src/tools/create-approval-request.ts:42-58
  - id: approval-lifecycle-one-way
    statement: "An approval transitions pending -> approved or pending -> rejected. There is no 'reopen' path."
    enforced_by: "DB layer (createApproval, resolveApproval); UI does not expose a reopen action"
  - id: analyze-uses-benefits-knowledge-only
    statement: "The LLM policy analysis loads knowledge specifically via loadKnowledgeForAgent('benefits_agent'), not the global corpus."
    enforced_by: src/app/api/approvals/[id]/analyze/route.ts:103
  - id: analyze-output-shape-strict
    statement: "Analysis response is parsed as JSON with the exact fields recommendation/confidence/reasoning/references/flags/summary. Parse failures return a FALLBACK_ANALYSIS, never undefined."
    enforced_by: src/app/api/approvals/[id]/analyze/route.ts:41-79, 121

contracts:
  - symbol: makeCreateApprovalRequestTool
    location: src/tools/create-approval-request.ts:12
    input: "(conversationId: string, requestTypes?: RequestTypeInfo[])"
    output: "Vercel AI SDK tool with description + zod inputSchema + execute()"
    side_effects:
      - "tool.execute() writes to approvals table and returns { approvalId, message }"
  - symbol: POST /api/approvals/[id]/analyze
    location: src/app/api/approvals/[id]/analyze/route.ts:81
    input: "URL param: id (approval id). No body."
    output: "{ analysis: PolicyAnalysis } | { error: string }"
    side_effects:
      - "One Groq generateText call with full benefits_agent knowledge in system prompt"
      - "No DB write; analysis is computed on demand and returned to caller"
  - symbol: POST /api/approvals/[id]/resolve
    location: src/app/api/approvals/[id]/resolve/route.ts
    input: "URL param: id. Body: { action: 'approve' | 'reject', adminNote?: string }"
    output: "{ ok: true } | { error: string }"
    side_effects:
      - "DB write: approvals.status, approvals.admin_note, approvals.resolved_at"

upstream_deps:
  - knowledge-base (analyze endpoint uses loadKnowledgeForAgent)
  - db.createApproval, db.resolveApproval, db.getApprovalById, db.getEnabledRequestTypes
  - "ai (tool, generateText)"
  - "zod (input schema)"
  - "@ai-sdk/groq (analyze endpoint)"

downstream_consumers:
  - agent-orchestration (agent-runner binds create_approval_request when assigned to an agent; benefits_agent is the only one in the seed data)
  - admin-dashboard (Approvals view: list + analyze + resolve; new approvals refresh via 5s polling)
  - slack-integration (admin channel receives interactive approval card; Approve/Reject buttons invoke /api/slack/interactions which calls resolveApproval)
  - employee-chat-ui (ApprovalCard renders approval status inline; polls /api/conversations/[id] for status changes)

common_changes:
  - description: "Add a new built-in tool"
    touches: [src/tools/<new-tool>.ts, src/tools/registry.ts, "(optionally) admin UI tools-view"]
  - description: "Add a new request type (e.g. 'travel')"
    touches: ["DB: request_types table (seed or via admin UI)", src/app/admin/components/request-types-view.tsx]
  - description: "Change the analyze model or output schema"
    touches: [src/app/api/approvals/[id]/analyze/route.ts:9-39, src/app/admin/components/approvals-view.tsx]

gotchas:
  - "The requestType zod schema is z.string() when fewer than 2 request types exist (because z.enum requires at least 2 variants). This is a workaround; it relaxes type-level validation for tiny seed sets."
  - "Approval details are stored as a JSON-stringified blob in the details column. Anything that adds a new field needs a JSON parse + a schema doc somewhere, since the DB column itself is just TEXT."
  - "The analyze endpoint's FALLBACK_ANALYSIS has recommendation='needs_review' and is returned silently when the LLM output cannot be parsed. Inspect server logs to detect when this is happening at scale."
  - "createApproval is called inside the tool's execute(). If the tool LLM step is retried (rare, but possible if Vercel SDK retries), duplicate approval rows can be created. There is no idempotency key."
  - "Slack admin channel receives approval cards via fire-and-forget posts. If the network call fails, the approval still exists in DB but the admin sees nothing in Slack."

cross_refs:
  - capability: agent-orchestration
    relationship: "Tools are bound by agent-runner per-request; the only built-in tool is the approval submitter."
  - capability: knowledge-base
    relationship: "Approval analysis reuses the knowledge-loader to feed policy text to the LLM."
  - capability: admin-dashboard
    relationship: "Admin reviews approvals (with optional LLM analysis) and resolves them."
  - capability: slack-integration
    relationship: "Admin can also resolve approvals via Slack interactive buttons."
---

# tools-and-approvals — Agent Context

## Mental model

Agents do not just answer; they can submit Personal Development (PD)
approval requests on the employee's behalf. The only built-in tool today
writes a pending row that an admin then resolves (via web UI or Slack
buttons), optionally consulting an LLM-generated policy analysis that
references the benefits_agent knowledge base.

## Read order

1. This file's frontmatter.
2. `src/tools/create-approval-request.ts` — the tool factory and its zod schema (~67 lines).
3. `src/tools/registry.ts` — the registry stub (~17 lines; intentionally tiny).
4. `src/app/api/approvals/[id]/analyze/route.ts` — the LLM policy analyzer (~132 lines).
5. `src/app/api/approvals/[id]/resolve/route.ts` and `src/app/api/approvals/route.ts` for the admin-action surface.

When investigating "why didn't the agent invoke the tool?" the answer is usually in `src/core/agent-runner.ts:31-50` (tool binding + stopWhen depth), not in this capability.
