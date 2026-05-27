---
version: 1
last_synced_from: 7adcbcf

mappings:
  # agent-orchestration
  - pattern: "src/agents/**"
    capability: agent-orchestration
  - pattern: "src/core/orchestrator.ts"
    capability: agent-orchestration
  - pattern: "src/core/agent-runner.ts"
    capability: agent-orchestration
  - pattern: "src/core/escalation-detector.ts"
    capability: agent-orchestration
  - pattern: "src/app/api/chat/**"
    capability: agent-orchestration

  # knowledge-base (more specific routes win over admin-dashboard's
  # agents/** pattern below — see "Conventions")
  - pattern: "src/knowledge/**"
    capability: knowledge-base
  - pattern: "src/core/knowledge-loader.ts"
    capability: knowledge-base
  - pattern: "src/app/api/knowledge/**"
    capability: knowledge-base
  - pattern: "src/app/api/agents/[id]/knowledge/**"
    capability: knowledge-base

  # tools-and-approvals (same caveat on agents/[id]/tools)
  - pattern: "src/tools/**"
    capability: tools-and-approvals
  - pattern: "src/app/api/tools/**"
    capability: tools-and-approvals
  - pattern: "src/app/api/approvals/**"
    capability: tools-and-approvals
  - pattern: "src/app/api/request-types/**"
    capability: tools-and-approvals
  - pattern: "src/app/api/agents/[id]/tools/**"
    capability: tools-and-approvals

  # slack-integration
  - pattern: "src/lib/slack.ts"
    capability: slack-integration
  - pattern: "src/app/api/slack/**"
    capability: slack-integration

  # admin-dashboard (broad agents/** match is intentionally last —
  # knowledge/[id]/knowledge and tools/[id]/tools above are
  # longer-specific and therefore take precedence)
  - pattern: "src/app/admin/**"
    capability: admin-dashboard
  - pattern: "src/app/api/agents/**"
    capability: admin-dashboard
  - pattern: "src/app/api/announcements/**"
    capability: admin-dashboard
  - pattern: "src/app/api/escalations/**"
    capability: admin-dashboard
  - pattern: "src/app/api/conversations/**"
    capability: admin-dashboard
  - pattern: "src/app/api/stats/**"
    capability: admin-dashboard

  # employee-chat-ui
  - pattern: "src/app/page.tsx"
    capability: employee-chat-ui
  - pattern: "src/app/layout.tsx"
    capability: employee-chat-ui
  - pattern: "src/components/**"
    capability: employee-chat-ui

unmapped_intentional:
  # Shared infrastructure, not its own capability. Eligible for a
  # future docs/reference/ entry, not for agent-context.md.
  - "src/db/**"
  - "src/lib/utils.ts"
  # Generated / framework-owned files.
  - "src/app/globals.css"
  - "src/app/favicon.ico"

on_unmapped_change:
  action: comment-only
  message: |
    The PR changes files not mapped to any capability in
    _agent-index.md, and not in unmapped_intentional. If this
    introduces a new capability area, add a mapping and create
    docs/capabilities/<name>/agent-context.md. Otherwise, add the
    paths to unmapped_intentional with a short rationale.
---

# Agent Index

Routing table for the docs-sync workflow. Maps source file glob
patterns to the capability whose `agent-context.md` should be consulted
(and possibly updated) when those paths change.

## Conventions

- **Longest specific match wins.** When a file matches multiple
  patterns (for example `src/app/api/agents/abc/knowledge/route.ts`
  matches both `src/app/api/agents/**` and
  `src/app/api/agents/[id]/knowledge/**`), the longest pattern is the
  one used. File order in `mappings:` is for human readability only.
- **A file maps to one capability only.** Cross-capability concerns
  belong in the `cross_refs:` field inside each `agent-context.md` (for
  example: `admin-dashboard` references `agent-orchestration` because
  announcements posted via admin are injected into agent system
  prompts).
- **`unmapped_intentional` is the explicit "we know about these, no
  docs" list.** Anything not in `mappings` and not in
  `unmapped_intentional` triggers the `on_unmapped_change` action.
- **Adding a new capability requires two changes:**
  1. A new entry under `mappings:` above.
  2. A new folder `docs/capabilities/<slug>/` with at least
     `agent-context.md`.
