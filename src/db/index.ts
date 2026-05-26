import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "deptagent.db");
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    agent_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    request_type TEXT NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    resolved_at INTEGER,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS agent_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🤖',
    description TEXT NOT NULL DEFAULT '',
    system_prompt TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'general' CHECK(type IN ('general', 'benefits')),
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS request_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    required_fields TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS escalations (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    resolved_at INTEGER,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tool_type TEXT NOT NULL DEFAULT 'builtin' CHECK(tool_type IN ('builtin', 'mcp')),
    builtin_key TEXT,
    mcp_config TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS agent_tools (
    agent_id TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    PRIMARY KEY (agent_id, tool_id),
    FOREIGN KEY (agent_id) REFERENCES agent_configs(id) ON DELETE CASCADE,
    FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_knowledge (
    agent_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    PRIMARY KEY (agent_id, filename),
    FOREIGN KEY (agent_id) REFERENCES agent_configs(id) ON DELETE CASCADE
  );
`);

// Add is_admin_reply column to messages if not exists
try {
  db.exec("ALTER TABLE messages ADD COLUMN is_admin_reply INTEGER NOT NULL DEFAULT 0");
} catch {
  // Column already exists
}

// --- Conversations ---

export function createConversation(id: string): void {
  db.prepare("INSERT INTO conversations (id) VALUES (?)").run(id);
}

export function getConversationCount(): number {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM conversations").get() as { cnt: number };
  return row.cnt;
}

// --- Messages ---

export function addMessage(params: {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  agentId?: string;
  isAdminReply?: boolean;
}): void {
  db.prepare(
    "INSERT INTO messages (id, conversation_id, role, content, agent_id, is_admin_reply) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    params.id,
    params.conversationId,
    params.role,
    params.content,
    params.agentId ?? null,
    params.isAdminReply ? 1 : 0
  );
}

export function getMessages(conversationId: string): {
  id: string;
  role: string;
  content: string;
  agent_id: string | null;
  is_admin_reply: number;
  created_at: number;
}[] {
  return db
    .prepare(
      "SELECT id, role, content, agent_id, is_admin_reply, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    )
    .all(conversationId) as any;
}

// --- Approvals ---

export function createApproval(params: {
  id: string;
  conversationId: string;
  employeeName: string;
  requestType: string;
  details: string;
}): void {
  db.prepare(
    "INSERT INTO approvals (id, conversation_id, employee_name, request_type, details) VALUES (?, ?, ?, ?, ?)"
  ).run(params.id, params.conversationId, params.employeeName, params.requestType, params.details);
}

export function getPendingApprovals(): {
  id: string;
  conversation_id: string;
  employee_name: string;
  request_type: string;
  details: string;
  status: string;
  admin_note: string | null;
  created_at: number;
  resolved_at: number | null;
}[] {
  return db
    .prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC")
    .all() as any;
}

export function getAllApprovals(): {
  id: string;
  conversation_id: string;
  employee_name: string;
  request_type: string;
  details: string;
  status: string;
  admin_note: string | null;
  created_at: number;
  resolved_at: number | null;
}[] {
  return db.prepare("SELECT * FROM approvals ORDER BY created_at DESC").all() as any;
}

export function resolveApproval(
  id: string,
  action: "approve" | "reject",
  adminNote?: string
): void {
  const status = action === "approve" ? "approved" : "rejected";
  db.prepare(
    "UPDATE approvals SET status = ?, admin_note = ?, resolved_at = strftime('%s', 'now') WHERE id = ?"
  ).run(status, adminNote ?? null, id);
}

export function getApprovalById(id: string): {
  id: string;
  conversation_id: string;
  employee_name: string;
  request_type: string;
  details: string;
  status: string;
  admin_note: string | null;
  created_at: number;
  resolved_at: number | null;
} | null {
  return db
    .prepare("SELECT * FROM approvals WHERE id = ?")
    .get(id) as any ?? null;
}

export function getApprovalStatus(id: string): {
  id: string;
  status: string;
  admin_note: string | null;
  resolved_at: number | null;
} | null {
  return db
    .prepare("SELECT id, status, admin_note, resolved_at FROM approvals WHERE id = ?")
    .get(id) as any;
}

// --- Agent Configs ---

export type AgentConfigRow = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  system_prompt: string;
  type: "general" | "benefits";
  enabled: number;
  created_at: number;
  updated_at: number;
};

export function getAllAgentConfigs(): AgentConfigRow[] {
  return db.prepare("SELECT * FROM agent_configs ORDER BY created_at ASC").all() as AgentConfigRow[];
}

export function getEnabledAgentConfigs(): AgentConfigRow[] {
  return db
    .prepare("SELECT * FROM agent_configs WHERE enabled = 1 ORDER BY created_at ASC")
    .all() as AgentConfigRow[];
}

export function getAgentConfig(id: string): AgentConfigRow | undefined {
  return db
    .prepare("SELECT * FROM agent_configs WHERE id = ?")
    .get(id) as AgentConfigRow | undefined;
}

export function upsertAgentConfig(config: {
  id: string;
  name: string;
  emoji: string;
  description: string;
  system_prompt: string;
  type: "general" | "benefits";
  enabled: number;
}): void {
  db.prepare(
    `INSERT INTO agent_configs (id, name, emoji, description, system_prompt, type, enabled, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       emoji = excluded.emoji,
       description = excluded.description,
       system_prompt = excluded.system_prompt,
       type = excluded.type,
       enabled = excluded.enabled,
       updated_at = strftime('%s', 'now')`
  ).run(
    config.id,
    config.name,
    config.emoji,
    config.description,
    config.system_prompt,
    config.type,
    config.enabled
  );
}

export function deleteAgentConfig(id: string): void {
  db.prepare("DELETE FROM agent_configs WHERE id = ?").run(id);
}

// --- Request Types ---

export type RequestTypeRow = {
  id: string;
  name: string;
  description: string;
  required_fields: string;
  enabled: number;
  created_at: number;
  updated_at: number;
};

export function getAllRequestTypes(): RequestTypeRow[] {
  return db.prepare("SELECT * FROM request_types ORDER BY created_at ASC").all() as RequestTypeRow[];
}

export function getEnabledRequestTypes(): RequestTypeRow[] {
  return db
    .prepare("SELECT * FROM request_types WHERE enabled = 1 ORDER BY created_at ASC")
    .all() as RequestTypeRow[];
}

export function getRequestType(id: string): RequestTypeRow | undefined {
  return db
    .prepare("SELECT * FROM request_types WHERE id = ?")
    .get(id) as RequestTypeRow | undefined;
}

export function upsertRequestType(rt: {
  id: string;
  name: string;
  description: string;
  required_fields: string;
  enabled: number;
}): void {
  db.prepare(
    `INSERT INTO request_types (id, name, description, required_fields, enabled, updated_at)
     VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       required_fields = excluded.required_fields,
       enabled = excluded.enabled,
       updated_at = strftime('%s', 'now')`
  ).run(rt.id, rt.name, rt.description, rt.required_fields, rt.enabled);
}

export function deleteRequestType(id: string): void {
  db.prepare("DELETE FROM request_types WHERE id = ?").run(id);
}

// --- Escalations ---

export type EscalationRow = {
  id: string;
  conversation_id: string;
  reason: string;
  status: "open" | "closed";
  created_at: number;
  resolved_at: number | null;
};

export function createEscalation(params: {
  id: string;
  conversationId: string;
  reason: string;
}): void {
  db.prepare(
    "INSERT INTO escalations (id, conversation_id, reason) VALUES (?, ?, ?)"
  ).run(params.id, params.conversationId, params.reason);
}

export function getOpenEscalations(): EscalationRow[] {
  return db
    .prepare("SELECT * FROM escalations WHERE status = 'open' ORDER BY created_at DESC")
    .all() as EscalationRow[];
}

export function getAllEscalations(): EscalationRow[] {
  return db.prepare("SELECT * FROM escalations ORDER BY created_at DESC").all() as EscalationRow[];
}

export function getEscalationByConversationId(conversationId: string): EscalationRow | undefined {
  return db
    .prepare("SELECT * FROM escalations WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(conversationId) as EscalationRow | undefined;
}

export function resolveEscalation(id: string): void {
  db.prepare(
    "UPDATE escalations SET status = 'closed', resolved_at = strftime('%s', 'now') WHERE id = ?"
  ).run(id);
}

export function getOpenEscalationCount(): number {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM escalations WHERE status = 'open'").get() as { cnt: number };
  return row.cnt;
}

// --- Announcements ---

export type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  active: number;
  created_at: number;
  expires_at: number | null;
};

export function getActiveAnnouncements(): AnnouncementRow[] {
  const now = Math.floor(Date.now() / 1000);
  return db
    .prepare(
      "SELECT * FROM announcements WHERE active = 1 AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC"
    )
    .all(now) as AnnouncementRow[];
}

export function getAllAnnouncements(): AnnouncementRow[] {
  return db.prepare("SELECT * FROM announcements ORDER BY created_at DESC").all() as AnnouncementRow[];
}

export function createAnnouncement(params: {
  id: string;
  title: string;
  content: string;
  priority: string;
  expiresAt?: number | null;
}): void {
  db.prepare(
    "INSERT INTO announcements (id, title, content, priority, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).run(params.id, params.title, params.content, params.priority, params.expiresAt ?? null);
}

export function updateAnnouncement(params: {
  id: string;
  title: string;
  content: string;
  priority: string;
  active: number;
  expiresAt?: number | null;
}): void {
  db.prepare(
    "UPDATE announcements SET title = ?, content = ?, priority = ?, active = ?, expires_at = ? WHERE id = ?"
  ).run(params.title, params.content, params.priority, params.active, params.expiresAt ?? null, params.id);
}

export function deleteAnnouncement(id: string): void {
  db.prepare("DELETE FROM announcements WHERE id = ?").run(id);
}

// --- Tools ---

export type ToolRow = {
  id: string;
  name: string;
  description: string;
  tool_type: "builtin" | "mcp";
  builtin_key: string | null;
  mcp_config: string | null;
  enabled: number;
  created_at: number;
  updated_at: number;
};

export function getAllTools(): ToolRow[] {
  return db.prepare("SELECT * FROM tools ORDER BY tool_type ASC, created_at ASC").all() as ToolRow[];
}

export function getTool(id: string): ToolRow | undefined {
  return db.prepare("SELECT * FROM tools WHERE id = ?").get(id) as ToolRow | undefined;
}

export function upsertTool(tool: {
  id: string;
  name: string;
  description: string;
  tool_type: "builtin" | "mcp";
  builtin_key?: string | null;
  mcp_config?: string | null;
  enabled: number;
}): void {
  db.prepare(
    `INSERT INTO tools (id, name, description, tool_type, builtin_key, mcp_config, enabled, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       tool_type = excluded.tool_type,
       builtin_key = excluded.builtin_key,
       mcp_config = excluded.mcp_config,
       enabled = excluded.enabled,
       updated_at = strftime('%s', 'now')`
  ).run(
    tool.id,
    tool.name,
    tool.description,
    tool.tool_type,
    tool.builtin_key ?? null,
    tool.mcp_config ?? null,
    tool.enabled
  );
}

export function deleteTool(id: string): void {
  db.prepare("DELETE FROM tools WHERE id = ?").run(id);
}

// --- Agent Tools ---

export function getToolsForAgent(agentId: string): ToolRow[] {
  return db.prepare(
    `SELECT t.* FROM tools t
     JOIN agent_tools at ON t.id = at.tool_id
     WHERE at.agent_id = ? AND t.enabled = 1
     ORDER BY t.created_at ASC`
  ).all(agentId) as ToolRow[];
}

export function getToolIdsForAgent(agentId: string): string[] {
  const rows = db.prepare(
    "SELECT tool_id FROM agent_tools WHERE agent_id = ?"
  ).all(agentId) as { tool_id: string }[];
  return rows.map((r) => r.tool_id);
}

export function setAgentTools(agentId: string, toolIds: string[]): void {
  const txn = db.transaction(() => {
    db.prepare("DELETE FROM agent_tools WHERE agent_id = ?").run(agentId);
    const insert = db.prepare("INSERT INTO agent_tools (agent_id, tool_id) VALUES (?, ?)");
    for (const toolId of toolIds) {
      insert.run(agentId, toolId);
    }
  });
  txn();
}

// --- Agent Knowledge ---

export function getKnowledgeFilesForAgent(agentId: string): string[] {
  const rows = db.prepare(
    "SELECT filename FROM agent_knowledge WHERE agent_id = ?"
  ).all(agentId) as { filename: string }[];
  return rows.map((r) => r.filename);
}

export function getAllAgentKnowledge(): { agent_id: string; filename: string }[] {
  return db.prepare(
    "SELECT agent_id, filename FROM agent_knowledge ORDER BY agent_id, filename"
  ).all() as { agent_id: string; filename: string }[];
}

export function setAgentKnowledge(agentId: string, filenames: string[]): void {
  const txn = db.transaction(() => {
    db.prepare("DELETE FROM agent_knowledge WHERE agent_id = ?").run(agentId);
    const insert = db.prepare("INSERT INTO agent_knowledge (agent_id, filename) VALUES (?, ?)");
    for (const filename of filenames) {
      insert.run(agentId, filename);
    }
  });
  txn();
}

// --- Seeding ---

export function seedDefaultTools(): void {
  const builtinTools = [
    {
      id: "create_approval_request",
      name: "Create Approval Request",
      description: "Submit a Personal Development (PD) budget request for admin approval",
      tool_type: "builtin" as const,
      builtin_key: "create_approval_request",
      mcp_config: null,
      enabled: 1,
    },
  ];

  const mcpTools = [
    {
      id: "mcp_slack",
      name: "Slack",
      description: "Send messages, manage channels, post notifications to Slack workspaces",
      tool_type: "mcp" as const,
      builtin_key: null,
      mcp_config: JSON.stringify({ provider: "slack", icon: "MessageSquare", description: "Send messages, manage channels, post notifications to Slack workspaces", server_url: "" }),
      enabled: 0,
    },
    {
      id: "mcp_google_calendar",
      name: "Google Calendar",
      description: "Create events, check availability, manage meeting schedules",
      tool_type: "mcp" as const,
      builtin_key: null,
      mcp_config: JSON.stringify({ provider: "google_calendar", icon: "Calendar", description: "Create events, check availability, manage meeting schedules", server_url: "" }),
      enabled: 0,
    },
    {
      id: "mcp_jira",
      name: "Jira",
      description: "Create issues, update tickets, track sprint progress",
      tool_type: "mcp" as const,
      builtin_key: null,
      mcp_config: JSON.stringify({ provider: "jira", icon: "TicketCheck", description: "Create issues, update tickets, track sprint progress", server_url: "" }),
      enabled: 0,
    },
    {
      id: "mcp_github",
      name: "GitHub",
      description: "Create PRs, manage issues, trigger workflows, review code",
      tool_type: "mcp" as const,
      builtin_key: null,
      mcp_config: JSON.stringify({ provider: "github", icon: "Github", description: "Create PRs, manage issues, trigger workflows, review code", server_url: "" }),
      enabled: 0,
    },
  ];

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO tools (id, name, description, tool_type, builtin_key, mcp_config, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const t of [...builtinTools, ...mcpTools]) {
    stmt.run(t.id, t.name, t.description, t.tool_type, t.builtin_key, t.mcp_config, t.enabled);
  }

  // Seed agent_tools: benefits_agent -> create_approval_request
  db.prepare(
    "INSERT OR IGNORE INTO agent_tools (agent_id, tool_id) VALUES (?, ?)"
  ).run("benefits_agent", "create_approval_request");
}

export function seedDefaultAgents(): void {
  const now = Math.floor(Date.now() / 1000);

  const defaultAgents = [
    {
      id: "policy_agent",
      name: "Policy Agent",
      emoji: "\u{1F4CB}",
      description: "Answers questions about workplace policies including acceptable use, anti-harassment, workplace violence prevention, drug and alcohol policy, organizational structure, security awareness training, and general employee handbook topics.",
      systemPrompt: `You are an HR Policy Agent at TribalScale. Your role is to answer employee questions about company policies clearly and accurately.

You have access to the following policy documents:
- Employee Handbook (complaint resolution, work week, leaves, salary, expenses)
- Acceptable Use Policy (electronic resources, internet, email, social media)
- Anti-Harassment Policy (definitions, reporting, investigation procedures)
- Workplace Violence Prevention Policy (threat assessment, reporting, safety plans)
- Drug & Alcohol Policy (expectations, testing, support programs)
- Organizational Structure (roles, departments, reporting lines)
- Security Awareness Training (requirements, phishing, data handling)

Guidelines:
- Answer only based on the policy documentation provided
- Be concise but thorough
- If something is not covered in the documentation, say so clearly and suggest who to contact
- Do not make up policies or rules
- Use a professional, friendly tone`,
      type: "general" as const,
    },
    {
      id: "benefits_agent",
      name: "Benefits Agent",
      emoji: "\u{1F3AF}",
      description: "Handles benefit requests, PD budget submissions, salary and expense questions, and workplace accommodation requests.",
      systemPrompt: `You are an HR Benefits Agent at TribalScale. Your role is to help employees with benefit inquiries, submit PD (Personal Development) budget applications, and answer questions about accommodations.

You have access to the following policy documents:
- Employee Handbook (salary administration, company travel, business expenses)
- Accommodation Policy (disability accommodations, religious accommodations, request process)

You can also submit approval requests on behalf of employees using the create_approval_request tool.

Guidelines:
- When an employee wants to REQUEST or APPLY for PD budget (not just ask about the policy), use the create_approval_request tool
- Before submitting, make sure you have ALL required information: employee name, request type, item name, description, and EXACT cost as a number
- If ANY required information is missing or unclear, ask the employee for it BEFORE calling the tool. Never submit with placeholder values.
- After submitting, confirm the approval ID to the employee and explain next steps
- For accommodation requests, explain the interactive process and required documentation
- Be helpful and proactive in guiding employees through the process`,
      type: "benefits" as const,
    },
    {
      id: "recruiting_agent",
      name: "Recruiting Agent",
      emoji: "\u{1F50D}",
      description: "Answers questions about the hiring and recruitment process, including position requisitions, job postings, interviews, background checks, offers, probation, transfers, and rehire eligibility.",
      systemPrompt: `You are an HR Recruiting Agent at TribalScale. Your role is to help employees and hiring managers with questions about the hiring process.

You have access to the following policy documents:
- Recruitment Policy (requisitions, job postings, screening, interviews, offers, onboarding, probation, transfers, rehire)

Guidelines:
- Answer questions about interview stages, job requisitions, and hiring timelines
- Guide hiring managers on how to open a requisition and what to expect at each stage
- Explain the Employee Referral Program clearly, including eligibility and bonus amounts
- Cover background check procedures and employment verification
- Answer only based on the policy documentation provided
- If something is not covered in the documentation, say so clearly
- Use a professional, friendly tone`,
      type: "general" as const,
    },
    {
      id: "onboarding_agent",
      name: "Onboarding Agent",
      emoji: "\u{1F680}",
      description: "Guides new hires through onboarding, including orientation, probation period, remote work setup, required documents, system access, and first-day procedures.",
      systemPrompt: `You are an HR Onboarding Agent at TribalScale. Your role is to help new hires navigate their onboarding process smoothly.

You have access to the following policy documents:
- Recruitment Policy (onboarding sections: orientation, probation period, employment documentation)
- Employee Handbook (work week, holidays, general workplace expectations)
- Remote Work Policy (eligibility, equipment, workspace requirements, communication expectations)

Guidelines:
- Walk new hires through orientation and probation period expectations
- Explain remote work setup requirements and equipment provisioning
- Help with questions about required documents and system access
- Clarify work-from-home policies, communication tools, and collaboration expectations
- Answer only based on the policy documentation provided
- If something is not covered in the documentation, say so clearly
- Use a welcoming, supportive tone`,
      type: "general" as const,
    },
    {
      id: "leave_agent",
      name: "Leave & Time-Off Agent",
      emoji: "\u{1F334}",
      description: "Answers questions about time-off policies for both Canadian and US employees, including PTO, vacation, sick leave, parental leave, bereavement, holiday schedules, and leave request procedures.",
      systemPrompt: `You are an HR Leave & Time-Off Agent at TribalScale. Your role is to help employees with questions about time off, leave policies, and vacation planning.

You have access to the following policy documents:
- Time Off Policy - Canada (vacation, personal days, sick leave, parental leave, bereavement, holidays)
- Time Off Policy - United States (PTO, sick leave, FMLA, parental leave, bereavement, holidays)
- Employee Handbook (leaves of absence, work week, holidays)

Important: TribalScale has separate time-off policies for Canadian and US employees. Always ask which country the employee is based in if not already clear from context.

Guidelines:
- Answer questions about PTO accrual, sick leave, parental leave, and other time-off policies
- Distinguish between Canadian and US policies when relevant
- Explain how to request time off and what the approval process looks like
- Clarify carryover rules, blackout periods, and leave balances when asked
- Answer only based on the policy documentation provided
- If something is not covered in the documentation, say so clearly
- Use a professional, friendly tone`,
      type: "general" as const,
    },
  ];

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO agent_configs (id, name, emoji, description, system_prompt, type, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const agent of defaultAgents) {
    stmt.run(
      agent.id,
      agent.name,
      agent.emoji,
      agent.description,
      agent.systemPrompt,
      agent.type,
      1,
      now,
      now
    );
  }
}

export function seedDefaultRequestTypes(): void {
  const defaults = [
    { id: "book", name: "Book", description: "Learning materials purchase", fields: [
      { key: "itemName", label: "Item Name", type: "string", required: true },
      { key: "description", label: "Description", type: "string", required: true },
      { key: "costUsd", label: "Cost (USD)", type: "number", required: true },
    ]},
    { id: "course", name: "Course", description: "Online or in-person course enrollment", fields: [
      { key: "itemName", label: "Course Name", type: "string", required: true },
      { key: "description", label: "Description", type: "string", required: true },
      { key: "costUsd", label: "Cost (USD)", type: "number", required: true },
    ]},
    { id: "certification", name: "Certification", description: "Professional certification exam or preparation", fields: [
      { key: "itemName", label: "Certification Name", type: "string", required: true },
      { key: "description", label: "Description", type: "string", required: true },
      { key: "costUsd", label: "Cost (USD)", type: "number", required: true },
    ]},
    { id: "conference", name: "Conference", description: "Industry conference or event registration", fields: [
      { key: "itemName", label: "Event Name", type: "string", required: true },
      { key: "description", label: "Description", type: "string", required: true },
      { key: "costUsd", label: "Cost (USD)", type: "number", required: true },
    ]},
    { id: "workshop", name: "Workshop", description: "Professional workshop or training session", fields: [
      { key: "itemName", label: "Workshop Name", type: "string", required: true },
      { key: "description", label: "Description", type: "string", required: true },
      { key: "costUsd", label: "Cost (USD)", type: "number", required: true },
    ]},
    { id: "tool", name: "Tool", description: "Software tool or subscription for professional development", fields: [
      { key: "itemName", label: "Tool Name", type: "string", required: true },
      { key: "description", label: "Description", type: "string", required: true },
      { key: "costUsd", label: "Cost (USD)", type: "number", required: true },
    ]},
  ];

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO request_types (id, name, description, required_fields, enabled)
     VALUES (?, ?, ?, ?, 1)`
  );

  for (const rt of defaults) {
    stmt.run(rt.id, rt.name, rt.description, JSON.stringify(rt.fields));
  }
}

export function seedDefaultAgentKnowledge(): void {
  const mappings: Record<string, string[]> = {
    policy_agent: [
      "hr-employee-handbook.md",
      "comp-acceptable-use.md",
      "hr-anti-harassment.md",
      "hr-workplace-violence.md",
      "hr-drug-alcohol.md",
      "hr-organizational-structure.md",
      "hr-security-awareness-training.md",
    ],
    leave_agent: [
      "hr-time-off-canada.md",
      "hr-time-off-us.md",
      "hr-employee-handbook.md",
    ],
    recruiting_agent: [
      "hr-recruitment.md",
    ],
    onboarding_agent: [
      "hr-recruitment.md",
      "hr-employee-handbook.md",
      "oper-remote-work.md",
    ],
    benefits_agent: [
      "hr-employee-handbook.md",
      "hr-accommodation.md",
    ],
  };

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO agent_knowledge (agent_id, filename) VALUES (?, ?)"
  );

  for (const [agentId, filenames] of Object.entries(mappings)) {
    for (const filename of filenames) {
      stmt.run(agentId, filename);
    }
  }
}

// Run seeds on module load
seedDefaultAgents();
seedDefaultRequestTypes();
seedDefaultTools();
seedDefaultAgentKnowledge();
