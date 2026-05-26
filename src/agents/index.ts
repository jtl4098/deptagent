import { ToolSet } from "ai";
import { AgentConfig } from "./types";
import { getAgentConfig, getEnabledAgentConfigs, getEnabledRequestTypes, getToolsForAgent, AgentConfigRow } from "@/db";
import { BUILTIN_TOOLS } from "@/tools/registry";

function rowToAgentConfig(row: AgentConfigRow): AgentConfig {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    description: row.description,
    systemPrompt: row.system_prompt,
    getTools: (convId: string) => {
      const toolRows = getToolsForAgent(row.id);
      const toolSet: ToolSet = {};
      for (const t of toolRows) {
        if (t.tool_type === "builtin" && t.builtin_key && BUILTIN_TOOLS[t.builtin_key]) {
          const requestTypes = getEnabledRequestTypes();
          toolSet[t.builtin_key] = BUILTIN_TOOLS[t.builtin_key].factory(convId, requestTypes);
        }
      }
      return toolSet;
    },
  };
}

export function getAgentById(
  id: string,
  conversationId: string
): AgentConfig | undefined {
  const row = getAgentConfig(id);
  if (!row || !row.enabled) return undefined;
  return rowToAgentConfig(row);
}

export function getEnabledAgents(): AgentConfig[] {
  return getEnabledAgentConfigs().map((row) => rowToAgentConfig(row));
}

export type { AgentConfig };
