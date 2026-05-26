import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { getEnabledAgentConfigs } from "@/db";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

function buildOrchestratorPrompt(): { prompt: string; fallbackAgentId: string } {
  const agents = getEnabledAgentConfigs();

  if (agents.length === 0) {
    return { prompt: "", fallbackAgentId: "" };
  }

  const agentDescriptions = agents
    .map((a) => `- ${a.id}: ${a.description}`)
    .join("\n");

  const fallbackAgentId =
    agents.find((a) => a.id === "handbook_agent")?.id ?? agents[0].id;

  const prompt = `You are an HR request router. Classify the employee's message and route it to the correct agent.

Available agents:
${agentDescriptions}

Rules:
- Read each agent's description carefully.
- Route to the agent whose description best matches the employee's intent.
- For policy questions, prefer specialized agents (leave, recruiting, onboarding) over the general policy agent.
- For submission/application requests, route to agents with action capabilities (e.g., benefits).
- When in doubt, use ${fallbackAgentId}.

Respond with ONLY valid JSON in this exact format:
{"agent": "${fallbackAgentId}", "reasoning": "brief reason"}`;

  return { prompt, fallbackAgentId };
}

export async function route(message: string): Promise<{ agent: string; reasoning: string }> {
  const { prompt: orchestratorPrompt, fallbackAgentId } = buildOrchestratorPrompt();

  if (!fallbackAgentId) {
    return { agent: "policy_agent", reasoning: "no agents configured" };
  }

  try {
    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      system: orchestratorPrompt,
      prompt: message,
      maxOutputTokens: 100,
    });

    const parsed = JSON.parse(text.trim());
    if (parsed.agent && typeof parsed.agent === "string") {
      return parsed;
    }
    return { agent: fallbackAgentId, reasoning: "fallback: invalid response format" };
  } catch {
    return { agent: fallbackAgentId, reasoning: "fallback: routing error" };
  }
}
