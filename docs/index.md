# DeptAgent Documentation

DeptAgent is a department-level AI agent orchestration platform. Each department
runs its own set of specialized agents behind a single chat interface. An LLM
orchestrator reads the employee's intent and routes the message to the agent
best suited to answer it or to take action on the employee's behalf.

This site documents DeptAgent at the **capability** level, not at the file or
package level. Each capability has at most four document types:

- **Overview** — what the capability does and why it exists, in domain language.
- **Architecture** — how it is built, with diagrams and code pointers.
- **Decisions** — one file per architectural decision (ADR).
- **Playbook** — common issues and how to triage them.

## Browse capabilities

- [Agent Orchestration](capabilities/agent-orchestration/overview.md) — how an
  employee message becomes a routed conversation with the right specialized agent.

## Audience

These docs are written for a developer or technical product manager with some
familiarity with the domain. We assume you know what an LLM and a tool call are,
and that you have read DeptAgent's README. We do not assume you have read the
source.
