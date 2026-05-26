import { Tool, ToolSet } from "ai";

export type AgentConfig = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  systemPrompt: string;
  getTools: (conversationId: string) => ToolSet;
};

export type AgentConfigRow = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  system_prompt: string;
  type: "general" | "benefits";
  enabled: number;
};
