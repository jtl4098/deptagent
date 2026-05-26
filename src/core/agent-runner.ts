import { generateText, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
import { AgentConfig } from "@/agents/types";
import { loadKnowledgeForAgent } from "./knowledge-loader";
import { getActiveAnnouncements } from "@/db";

type RunResult = {
  response: string;
  agentId: string;
  approvalId?: string;
};

export async function runAgent(
  agent: AgentConfig,
  message: string,
  conversationId: string
): Promise<RunResult> {
  const knowledge = loadKnowledgeForAgent(agent.id);
  let systemPrompt = `${agent.systemPrompt}\n\n## Company Knowledge Base\n\n${knowledge}`;

  const announcements = getActiveAnnouncements();
  if (announcements.length > 0) {
    const announcementText = announcements
      .map((a) => `- [${a.priority.toUpperCase()}] ${a.title}: ${a.content}`)
      .join("\n");
    systemPrompt += `\n\n## Active Announcements\n\nThe following announcements are currently active. Reference them when relevant to employee questions:\n${announcementText}`;
  }

  const tools = agent.getTools(conversationId);
  const hasTools = Object.keys(tools).length > 0;

  if (!hasTools) {
    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });
    return { response: text, agentId: agent.id };
  }

  let approvalId: string | undefined;

  const result = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
    tools,
    stopWhen: stepCountIs(3),
    onStepFinish: async (step) => {
      for (const toolResult of step.toolResults ?? []) {
        if (toolResult.toolName === "create_approval_request") {
          const output = toolResult.output as { approvalId: string; message: string };
          if (output?.approvalId) {
            approvalId = output.approvalId;
          }
        }
      }
    },
  });

  return {
    response: result.text,
    agentId: agent.id,
    approvalId,
  };
}
