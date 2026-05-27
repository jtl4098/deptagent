---
capability: employee-chat-ui
version: 1
last_synced_from: 7adcbcf

entry_points:
  - path: src/app/page.tsx
    symbol: "default export (Home)"
    role: "The single-page employee chat. State machine: messages[], announcements[], pending approval inline cards, escalation polling."
  - path: src/app/layout.tsx
    role: "Root Next.js layout. Global styles, fonts. Wraps the chat page."
  - path: src/components/ui/
    role: "shadcn/ui primitives (button, card, input, badge, scroll-area, separator, tabs, textarea)."

invariants:
  - id: chat-is-client-only
    statement: "src/app/page.tsx is 'use client'. All state lives in the browser; the server is just an API surface."
    enforced_by: src/app/page.tsx:1
  - id: conversation-persists-by-id
    statement: "On first message a conversationId is generated server-side; subsequent client messages include it so the API appends to the same conversation."
    enforced_by: src/app/api/chat/route.ts:18-26, "client useState<string|null> threading the id"
  - id: approval-card-inline-with-message
    statement: "An assistant message that triggered an approval renders the ApprovalCard immediately below it. Approval status updates come from the same message object as it is refreshed."
    enforced_by: src/app/page.tsx (ApprovalCard component)
  - id: escalation-banner-once
    statement: "After escalation, the chat input is disabled and a banner is shown. Re-enabling requires admin action (resolve escalation)."
    enforced_by: "src/app/page.tsx isEscalated state"
  - id: announcement-priority-affects-style-only
    statement: "Announcements with priority high/urgent change banner color but do not change delivery semantics. All active announcements are shown to all users."
    enforced_by: src/app/page.tsx (Announcement display)

contracts:
  - symbol: "Client -> POST /api/chat"
    input: "{ message: string, conversationId?: string }"
    output: "{ response, conversationId, agentUsed: {id,name,emoji}|null, approval: {id,status,adminNote}|null, escalated: boolean }"
    side_effects:
      - "Server-side: adds user message + assistant message rows, may trigger LLM, may create approval, may create escalation"
  - symbol: "Client -> GET /api/conversations/[id]"
    input: "URL param: conversation id"
    output: "{ messages, approvals, escalation? }"
    side_effects:
      - "Read-only. Used by client to poll for admin replies after escalation."
  - symbol: "Client -> GET /api/announcements?active=true"
    input: "(none)"
    output: "{ announcements: Announcement[] }"
    side_effects:
      - "Read-only. Fetched on mount to display banners."

upstream_deps:
  - agent-orchestration (POST /api/chat is the route() + runAgent() pipeline)
  - tools-and-approvals (approval data shapes; ApprovalCard renders status)
  - admin-dashboard (announcements feed; escalation admin replies)
  - "@/components/ui/* (shadcn primitives)"
  - "lucide-react (icons)"

downstream_consumers:
  - "External: employees via browser at /"

common_changes:
  - description: "Add a new inline card type (e.g. policy citation card)"
    touches: [src/app/page.tsx (new component + branch in message rendering)]
  - description: "Change escalation polling cadence"
    touches: [src/app/page.tsx (the setInterval for conversation polling)]
  - description: "Add a third role (e.g. system notice)"
    touches: [src/app/page.tsx (Message type union), src/app/api/chat/route.ts (response shape)]
  - description: "Replace shadcn primitives"
    touches: [src/components/ui/, "every importer in src/app/page.tsx and src/app/admin/**"]

gotchas:
  - "The chat polls /api/conversations/[id] during escalation to surface admin replies. Polling cadence is hard-coded; if escalation is rare, the polling cost is fixed regardless."
  - "Announcement banner does not poll. New announcements posted via admin are visible only on next page refresh."
  - "Approval status update is sourced from the original /api/chat response. If the admin resolves the approval, the employee does not see the update until the next employee message OR until the conversation polling kicks in (during escalation). Outside escalation, approvals can appear stuck."
  - "The chat input does not have a typing indicator or streaming. Long agent responses block the UI until generateText completes."
  - "There is no rate limit. An employee that spams the input fires a chain of LLM calls."

cross_refs:
  - capability: agent-orchestration
    relationship: "Primary upstream: every user message goes through route() + runAgent()."
  - capability: tools-and-approvals
    relationship: "ApprovalCard renders status; approval object comes from the chat API response."
  - capability: admin-dashboard
    relationship: "Announcements fetched here are CRUD'd in admin. Admin replies to escalations also surface in this UI via conversation polling."
---

# employee-chat-ui — Agent Context

## Mental model

A single-page React chat. The server is a thin API; everything else
(message history, announcement display, approval state, escalation
state) lives in client state. Approval and announcement state are not
push-driven; they refresh on message send or on conversation polling
during escalation, which is a known UX limitation.

## Read order

1. This file's frontmatter.
2. `src/app/page.tsx` — the entire client component (several hundred lines; the only file with significant logic).
3. `src/app/layout.tsx` for the root layout (small).
4. `src/components/ui/` to understand which primitives are in play; do not read deeply unless restyling.

When debugging "the UI shows X but the DB says Y", check whether X is from the most recent /api/chat response (stale unless re-sent) or from /api/conversations/[id] (only polled during escalation).
