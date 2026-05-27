---
capability: slack-integration
version: 1
last_synced_from: 7adcbcf

entry_points:
  - path: src/app/api/slack/events/route.ts
    symbol: POST
    role: "Slack Events API webhook. Handles url_verification + message events. Returns 200 within 3s by deferring real work to handleMessage()."
  - path: src/app/api/slack/events/route.ts
    symbol: handleMessage
    role: "The full chat pipeline mirrored for Slack: escalation check, route, runAgent, post response, post approval card."
  - path: src/app/api/slack/interactions/route.ts
    symbol: POST
    role: "Slack Interactivity webhook. Handles approve_request and reject_request button clicks; resolves the approval and updates messages."
  - path: src/lib/slack.ts
    symbol: verifySlackRequest
    role: "HMAC-SHA256 signature verification + 5-minute replay window check."
  - path: src/lib/slack.ts
    symbol: postMessage / updateMessage / buildApprovalCard / buildApprovalResultCard
    role: "Block Kit message helpers."

invariants:
  - id: hmac-verified-before-work
    statement: "Both /events and /interactions verify the Slack signature before touching the payload. Any unverified request returns 401."
    enforced_by: src/app/api/slack/events/route.ts:27-29, src/app/api/slack/interactions/route.ts:11-13
  - id: replay-window-five-minutes
    statement: "Requests with x-slack-request-timestamp older than 5 minutes from server clock are rejected."
    enforced_by: src/lib/slack.ts:18-22
  - id: events-respond-within-3s
    statement: "POST /events must return 200 quickly; the real work runs fire-and-forget via handleMessage().catch(...). Slack retries unanswered events."
    enforced_by: src/app/api/slack/events/route.ts:62-65
  - id: event-id-dedup
    statement: "Each Slack event_id is added to an in-process Set on first handling. Retries with the same event_id short-circuit immediately."
    enforced_by: src/app/api/slack/events/route.ts:23-53
  - id: bot-and-subtype-filtered
    statement: "handleMessage runs only for top-level message events from users (no bot_id, no subtype). Edits, deletes, and bot echoes are ignored."
    enforced_by: src/app/api/slack/events/route.ts:56
  - id: conversation-id-derived-from-slack-user
    statement: "Slack conversations use conversationId = `slack-${slackUserId}`. One Slack user = one conversation, persistent across messages."
    enforced_by: src/app/api/slack/events/route.ts:76

contracts:
  - symbol: verifySlackRequest
    location: src/lib/slack.ts:11
    input: "req: Request"
    output: "Promise<{ verified: boolean, body: string }>"
    side_effects:
      - "Reads request body (consuming it; callers receive the body string)"
      - "No DB or network. Pure crypto + timestamp math."
  - symbol: postMessage
    location: src/lib/slack.ts:41
    input: "(channel: string, text: string, blocks?: KnownBlock[])"
    output: "Promise<WebAPICallResult>"
    side_effects:
      - "Calls Slack chat.postMessage with SLACK_BOT_TOKEN auth"
  - symbol: updateMessage
    location: src/lib/slack.ts:49
    input: "(channel: string, ts: string, text: string, blocks?: KnownBlock[])"
    output: "Promise<WebAPICallResult>"
    side_effects:
      - "Calls Slack chat.update; requires the ts (timestamp) of the original message"
  - symbol: buildApprovalCard
    location: src/lib/slack.ts:60
    input: "(approval: {id, employee_name, request_type, details, created_at}, slackUserId: string)"
    output: "{ text: string, blocks: KnownBlock[] }"
    side_effects:
      - "Pure. Stamps two action buttons (Approve, Reject) with stringified JSON values."

upstream_deps:
  - agent-orchestration (handleMessage invokes route() and runAgent() inline)
  - tools-and-approvals (approval cards rendered when handleMessage receives approvalId; resolveApproval called from /interactions)
  - db (createConversation, addMessage, getMessages, createEscalation, getEscalationByConversationId, getApprovalById, getApprovalStatus, resolveApproval)
  - "@slack/web-api WebClient"
  - "node crypto (HMAC)"
  - "Env: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_ADMIN_CHANNEL_ID"

downstream_consumers:
  - "External: Slack workspace (DM channels and the admin channel)"

common_changes:
  - description: "Add a new Slack interaction (e.g. a Reassign button)"
    touches: [src/lib/slack.ts (new Block Kit helper), src/app/api/slack/interactions/route.ts (new action_id case)]
  - description: "Notify a different admin channel"
    touches: ["env SLACK_ADMIN_CHANNEL_ID"]
  - description: "Support Slack DMs from bots or threads"
    touches: [src/app/api/slack/events/route.ts:56 (filter relaxation), "handleMessage to handle thread_ts"]

gotchas:
  - "processedEvents is an in-memory Set. Restarts wipe it, so the same event_id can be processed twice across a deploy. Slack stops retrying after several attempts (~max ~4) so practical risk is bounded but not zero."
  - "The processedEvents cap (size > 1000) evicts the first inserted entry on overflow. This is FIFO, not LRU; an old-but-still-being-retried event can be re-handled. Rare in practice."
  - "handleMessage is fire-and-forget. If it throws, the error is logged but Slack never knows. There is no admin-visible failure surface; consider adding an admin Slack channel error post if reliability matters."
  - "Both /events and /interactions duplicate the verifySlackRequest call. The escalation logic in handleMessage also duplicates what's in /api/chat/route.ts. A refactor candidate after PoC."
  - "The 'agent label' prefix on Slack responses (`[emoji name]\\n...`) is plain text. It mixes with the agent's prose; long agent names visually compete with the response."
  - "SLACK_SIGNING_SECRET defaulting to empty string means HMAC comparison succeeds against an empty secret only if Slack's signature is also empty (never happens). Effectively, missing secret = all requests rejected. Failure is loud, which is correct."

cross_refs:
  - capability: agent-orchestration
    relationship: "Second front-end: handleMessage delegates to the same route()/runAgent() pipeline as /api/chat."
  - capability: tools-and-approvals
    relationship: "Renders approval cards in the admin channel and accepts approve/reject via interactive buttons."
  - capability: admin-dashboard
    relationship: "Both surfaces (web admin and Slack admin channel) can resolve the same approval; resolveApproval is the shared write path."
---

# slack-integration — Agent Context

## Mental model

Slack is a second front-end for DeptAgent — the same routing-and-execution
pipeline that powers the web chat is reused, mirrored across a separate
handler. Slack-specific concerns (signature verification, 3-second
response rule, event-id dedup, Block Kit) are localized in this
capability; everything below them is `agent-orchestration` territory.

## Read order

1. This file's frontmatter.
2. `src/lib/slack.ts` — verification + message helpers + Block Kit (~136 lines).
3. `src/app/api/slack/events/route.ts` — events webhook + handleMessage (~177 lines).
4. `src/app/api/slack/interactions/route.ts` — button-click handler (~72 lines).

When debugging "Slack didn't respond", check this sequence in order: signature 401 in logs, then duplicate event_id (dedup hit), then handleMessage uncaught error, then upstream agent-orchestration failure.
