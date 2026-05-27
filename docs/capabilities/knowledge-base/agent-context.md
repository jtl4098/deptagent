---
capability: knowledge-base
version: 1
last_synced_from: 7adcbcf

entry_points:
  - path: src/core/knowledge-loader.ts
    symbol: loadKnowledgeForAgent
    role: "Read markdown for one agent and return concatenated text. Cached per-agent."
  - path: src/core/knowledge-loader.ts
    symbol: loadKnowledge
    role: "Read every markdown file in src/knowledge/. Cached globally. Used as fallback when an agent has no assigned files."
  - path: src/knowledge/
    role: "Directory of HR policy markdown files (12 files: handbook, time-off, anti-harassment, security, etc.)."
  - path: src/app/api/knowledge/route.ts
    role: "Admin CRUD for knowledge files (list, create)."
  - path: src/app/api/knowledge/[filename]/route.ts
    role: "Admin CRUD for a single knowledge file (read, update, delete)."
  - path: src/app/api/agents/[id]/knowledge/route.ts
    role: "Admin endpoint for binding which knowledge files an agent uses."

invariants:
  - id: knowledge-cache-per-process
    statement: "Both agentCache (Map<agentId, string>) and allCache (string|null) live in module scope. They survive across requests but not across server restarts."
    enforced_by: src/core/knowledge-loader.ts:7-8
  - id: fallback-to-all-files
    statement: "If an agent has no entries in agent_knowledge_files, loadKnowledgeForAgent returns the content of every markdown file in src/knowledge/."
    enforced_by: src/core/knowledge-loader.ts:28-33
  - id: filesystem-is-source-of-truth
    statement: "Knowledge content is read from the filesystem (src/knowledge/*.md), not from DB. The DB only stores the mapping agent -> filename."
    enforced_by: src/core/knowledge-loader.ts:5, 14
  - id: cache-must-be-cleared-on-write
    statement: "Any admin write to src/knowledge/ or to agent_knowledge_files must call clearKnowledgeCache() or the next agent invocation will return stale content."
    enforced_by: src/core/knowledge-loader.ts:50-53

contracts:
  - symbol: loadKnowledgeForAgent
    location: src/core/knowledge-loader.ts:20
    input: "agentId: string"
    output: "string  // concatenated markdown, files separated by '--- <filename> ---' delimiters"
    side_effects:
      - "Reads from filesystem on cache miss"
      - "Writes to in-process agentCache map"
  - symbol: loadKnowledge
    location: src/core/knowledge-loader.ts:40
    input: "()"
    output: "string  // concatenation of all *.md files in src/knowledge/"
    side_effects:
      - "Reads filesystem directory listing + each file on cache miss"
      - "Writes to in-process allCache"
  - symbol: clearKnowledgeCache
    location: src/core/knowledge-loader.ts:50
    input: "()"
    output: "void"
    side_effects:
      - "Empties both caches; next read repopulates from disk"

upstream_deps:
  - db.getKnowledgeFilesForAgent (the agent -> filename mapping table)
  - "fs (node)"
  - "path (node)"

downstream_consumers:
  - agent-orchestration (runAgent injects loadKnowledgeForAgent output into the system prompt)
  - tools-and-approvals (POST /api/approvals/[id]/analyze uses loadKnowledgeForAgent('benefits_agent') for policy analysis)
  - admin-dashboard (knowledge management UI; KnowledgeView)

common_changes:
  - description: "Add a new policy document"
    touches: [src/knowledge/<new-file>.md, "(optionally) admin UI to assign to agents"]
  - description: "Change which agent uses which files"
    touches: [src/app/admin/components/agent-detail-view.tsx, src/app/api/agents/[id]/knowledge/route.ts, "DB: agent_knowledge_files table"]
  - description: "Switch knowledge storage out of the filesystem"
    touches: [src/core/knowledge-loader.ts:5-18, "all callers"]

gotchas:
  - "Cache is in-process and never invalidates by itself. A direct filesystem edit (outside the admin UI) is invisible until restart or until clearKnowledgeCache() is called explicitly."
  - "The all-files fallback can quietly hide a missing mapping. An agent with zero assigned files looks identical to one assigned every file. Investigate by checking DB agent_knowledge_files rows before assuming a bug in the loader."
  - "File separators use '--- <filename> ---' delimiters. Anything downstream that parses concatenated knowledge content depends on this exact format."
  - "loadKnowledge() in fallback path holds the FULL knowledge corpus in memory per-agent (cache key is the agent id). With many agents and many files this becomes a memory pressure source."

cross_refs:
  - capability: agent-orchestration
    relationship: "Primary consumer. Agent system prompts depend on this capability for content."
  - capability: tools-and-approvals
    relationship: "Approval analysis endpoint reuses this capability to load policy context for the LLM analysis."
  - capability: admin-dashboard
    relationship: "Admin UI manages both the files on disk and the per-agent assignments."
---

# knowledge-base — Agent Context

## Mental model

Markdown files on disk are the source of truth for policy content. A
small in-process cache turns them into per-agent prompt fragments. The DB
holds only the agent-to-filename mapping; the content itself never leaves
the filesystem.

## Read order

1. This file's frontmatter.
2. `src/core/knowledge-loader.ts` — entire file, ~54 lines.
3. `src/app/api/knowledge/route.ts` and `src/app/api/knowledge/[filename]/route.ts` for the admin CRUD surface.
4. The DB schema for `agent_knowledge_files` (in `src/db/`) when investigating mapping issues.

A representative knowledge file (any one of `src/knowledge/hr-*.md`) is worth a glance to understand the prose density and section style; the loader does not parse structure, but downstream LLM behavior depends on it.
