# Agent Orchestration — Overview

## What it is

When an employee sends a message in DeptAgent, the system does not pick a
single all-knowing chatbot to answer it. It picks a **specialist**.

A department configures several agents, each scoped to one part of HR — policy
questions, benefits enrollment, leave requests, recruiting, onboarding. Each
agent owns its own description, system prompt, knowledge base, and the set of
tools (actions) it is allowed to call. An orchestrator LLM reads the employee's
message, scans every agent's description, and chooses the one that should
respond.

The employee never sees this routing happen. They send one message and get
one reply. Behind the chat box, the orchestrator picked the agent, the agent
loaded its knowledge, and — if the agent has tools — it may have submitted an
approval request or kicked off a workflow on the employee's behalf.

## Why it exists

A single "HR chatbot" prompted with everything the department knows runs into
two problems quickly:

1. **Context bloat.** Every message pays for the full HR handbook, every
   benefits document, every recruiting policy. Token budgets, latency, and
   relevance all degrade.
2. **Action confusion.** If one agent has every tool — submit approvals, file
   tickets, look up payroll — the model has to decide which is appropriate
   for every message. Misfires get expensive (a wrong approval submission is
   a real artifact, not just a wrong sentence).

Splitting the system by specialty solves both. Each agent gets only its own
knowledge and only the tools that make sense for its scope. The orchestrator
keeps the routing decision separate from the answering decision, so the agent
doing the work never has to ask "is this even my job?"

## How an employee message flows

1. **Employee sends a message** through the web chat or Slack DM.
2. **Escalation check.** A keyword scan looks for explicit human-help requests
   ("talk to a human", "escalate", etc.). If matched, the conversation is
   handed to a department admin and the agent path is skipped entirely.
3. **Routing.** The orchestrator LLM is given the list of enabled agents and
   their descriptions, and asked to return the best match as JSON. If the
   model errors or returns malformed JSON, routing falls back to a default
   agent (typically the handbook/policy agent).
4. **Agent runs.** The chosen agent's system prompt is composed from its base
   prompt, its injected knowledge base files, and the currently active
   announcements. If the agent has tools assigned, those are passed to the
   LLM and may be called up to a small fixed number of steps.
5. **Response is persisted** with the agent ID, and any tool-side effects
   (e.g. a created approval request) are surfaced back to the employee.

## What this capability is not

- It is **not** the agents themselves. Agent definitions, knowledge, and tools
  are owned by the department admin via the admin dashboard — see the future
  Knowledge Base and Tool Registry capability docs.
- It is **not** the escalation pipeline. Escalation is the off-ramp that
  short-circuits routing; the orchestrator never sees escalated messages.
- It is **not** authentication or rate limiting. Those live above the chat API.

## Where to look in the code

| Concern | File |
|---|---|
| Orchestrator prompt + LLM call | `src/core/orchestrator.ts` |
| Chat pipeline (escalation → route → run) | `src/app/api/chat/route.ts` |
| Agent loading + tool binding | `src/agents/index.ts` |
| Agent execution + knowledge injection | `src/core/agent-runner.ts` |
| Escalation keyword check | `src/core/escalation-detector.ts` |

For the data flow, sequence diagram, and prompt structure, see the
[Architecture](architecture.md) page.
