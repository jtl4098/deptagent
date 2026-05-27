---
capability: agent-orchestration
version: 1
last_synced_from: 7adcbcf

entry_points:
  - path: src/app/api/chat/route.ts
    symbol: POST
    role: "Web chat entry. Pipelines escalation -> route -> getAgentById -> runAgent."
  - path: src/app/api/slack/events/route.ts
    symbol: handleMessage
    role: "Slack DM entry. Same pipeline as web chat. Fire-and-forget so Slack gets 200 within 3s."
  - path: src/core/orchestrator.ts
    symbol: route
    role: "LLM router. Returns the agent ID to handle the message."
  - path: src/core/agent-runner.ts
    symbol: runAgent
    role: "Agent execution loop. Builds system prompt, runs LLM with tools, returns response + optional approvalId."
  - path: src/core/escalation-detector.ts
    symbol: shouldEscalate
    role: "Keyword check that short-circuits the pipeline before routing."

invariants:
  - id: routing-always-returns-agent
    statement: "route() never throws to callers. Any error path returns the fallback agent (handbook_agent or first enabled agent)."
    enforced_by: src/core/orchestrator.ts:46-61
  - id: tool-loop-bounded
    statement: "Agent tool-call loop is capped at 3 steps per request."
    enforced_by: src/core/agent-runner.ts:50
  - id: escalation-before-routing
    statement: "Both keyword escalation check and existing-open-escalation check run BEFORE the orchestrator. An escalated conversation never reaches an agent."
    enforced_by: src/app/api/chat/route.ts:36-89, src/app/api/slack/events/route.ts:91-132
  - id: per-message-fresh-agent-list
    statement: "Enabled agent set is read from DB on every routing call. No in-memory cache."
    enforced_by: src/core/orchestrator.ts:8
  - id: getAgentById-policy-fallback
    statement: "If the routed agent ID is not found or disabled, the chat route falls back to policy_agent before returning an error."
    enforced_by: src/app/api/chat/route.ts:91-94

contracts:
  - symbol: route
    location: src/core/orchestrator.ts:39
    input: "message: string"
    output: "{ agent: string, reasoning: string }"
    side_effects:
      - "One Groq generateText call with model 'llama-3.3-70b-versatile' and maxOutputTokens: 100"
      - "Reads db.getEnabledAgentConfigs once per call (no cache)"
  - symbol: runAgent
    location: src/core/agent-runner.ts:15
    input: "(agent: AgentConfig, message: string, conversationId: string)"
    output: "{ response: string, agentId: string, approvalId?: string }"
    side_effects:
      - "Loads knowledge via knowledge-loader (cached per-agent)"
      - "Reads active announcements from DB and prepends them to system prompt"
      - "One generateText call; up to 3 tool-call steps if tools are bound to the agent"
      - "Captures approvalId from create_approval_request tool output if invoked"
  - symbol: shouldEscalate
    location: src/core/escalation-detector.ts:16
    input: "message: string"
    output: "{ escalate: boolean, reason: string }"
    side_effects:
      - "Pure function. No DB, no LLM. Lower-cases the message and substring-matches an in-module keyword list."

upstream_deps:
  - knowledge-base (knowledge-loader.loadKnowledgeForAgent)
  - tools-and-approvals (tools/registry; agent-runner binds tools at runtime)
  - admin-dashboard (announcements injected into system prompt by agent-runner)
  - db.getEnabledAgentConfigs, db.getAgentConfig, db.getToolsForAgent, db.getEnabledRequestTypes
  - "@ai-sdk/groq createGroq"
  - "ai (generateText, stepCountIs, ToolSet)"

downstream_consumers:
  - employee-chat-ui (calls POST /api/chat)
  - slack-integration (slack/events handler calls route + runAgent inline)

common_changes:
  - description: "Add a new built-in agent type"
    touches: [src/agents/types.ts, src/db (agents table seed/migration), src/app/admin/components/new-agent-view.tsx]
  - description: "Change the routing LLM or model parameters"
    touches: [src/core/orchestrator.ts:48-52]
  - description: "Change tool loop depth"
    touches: [src/core/agent-runner.ts:50]
  - description: "Add an escalation keyword"
    touches: [src/core/escalation-detector.ts:1-14]
  - description: "Change escalation routing target (e.g. notify a different channel)"
    touches: [src/app/api/chat/route.ts:67-89, src/app/api/slack/events/route.ts:106-132]

gotchas:
  - "Orchestrator JSON parse failure silently falls back to the default agent. No log, no metric. Add observability before trusting routing data."
  - "getEnabledAgentConfigs runs per-request with no cache. Admin UI changes take effect on the very next message (intentional)."
  - "Escalation logic is duplicated between src/app/api/chat/route.ts and src/app/api/slack/events/route.ts. Changing the behavior requires updating both. A future refactor should extract a shared helper."
  - "agent-runner reads announcements every request. Long announcement lists inflate the system prompt; consider a length cap if announcements grow."
  - "policy_agent is the hard-coded fallback in chat/route.ts. If you rename it, this fallback breaks."

cross_refs:
  - capability: knowledge-base
    relationship: "agent-runner injects loadKnowledgeForAgent output into the agent's system prompt"
  - capability: tools-and-approvals
    relationship: "agent-runner binds tools from BUILTIN_TOOLS via agent.getTools(convId)"
  - capability: admin-dashboard
    relationship: "Announcements posted via admin UI are read by agent-runner and prepended to the prompt"
  - capability: slack-integration
    relationship: "Slack events handler is a parallel front-end that invokes the same route()/runAgent() pipeline"
---

# agent-orchestration — Agent Context

## Mental model

Specialty selection (orchestrator LLM) is separated from answering (agent
LLM), with a guaranteed-safe fallback so routing failures never leave the
user without a response. Escalation is a hard short-circuit that happens
before the orchestrator runs.

## Read order (if you have a small token budget)

1. This file's frontmatter.
2. `src/core/orchestrator.ts` — the `route()` function (~60 lines).
3. `src/core/agent-runner.ts` — the `runAgent()` function (~68 lines).
4. `src/app/api/chat/route.ts` — the `POST` handler (~126 lines).
5. `src/core/escalation-detector.ts` — keyword list + short pure function (~24 lines).

The rest is glue. `src/agents/index.ts` is a thin row-to-AgentConfig adapter and only matters when you need to know how tools are bound (deferred to `tools-and-approvals` agent-context).
