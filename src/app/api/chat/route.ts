import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createConversation,
  addMessage,
  getApprovalStatus,
  createEscalation,
  getEscalationByConversationId,
} from "@/db";
import { route } from "@/core/orchestrator";
import { runAgent } from "@/core/agent-runner";
import { getAgentById } from "@/agents";
import { shouldEscalate } from "@/core/escalation-detector";

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId: existingConversationId } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const conversationId = existingConversationId ?? uuidv4();

    if (!existingConversationId) {
      createConversation(conversationId);
    }

    addMessage({
      id: uuidv4(),
      conversationId,
      role: "user",
      content: message,
    });

    // Check if conversation already has an open escalation
    const existingEscalation = getEscalationByConversationId(conversationId);
    if (existingEscalation && existingEscalation.status === "open") {
      const response =
        "Your conversation has been escalated to a department admin. They will respond shortly. Please wait for their reply.";
      addMessage({
        id: uuidv4(),
        conversationId,
        role: "assistant",
        content: response,
      });
      return NextResponse.json({
        response,
        conversationId,
        agentUsed: null,
        approval: null,
        escalated: true,
      });
    }

    // Check for escalation keywords
    const escalationCheck = shouldEscalate(message);
    if (escalationCheck.escalate) {
      const escalationId = uuidv4();
      createEscalation({
        id: escalationId,
        conversationId,
        reason: escalationCheck.reason,
      });

      const response =
        "I understand you'd like to speak with a human. I've escalated your conversation to a department admin. They will review your conversation and respond shortly.";
      addMessage({
        id: uuidv4(),
        conversationId,
        role: "assistant",
        content: response,
      });

      return NextResponse.json({
        response,
        conversationId,
        agentUsed: null,
        approval: null,
        escalated: true,
      });
    }

    const { agent: agentId } = await route(message);
    const agent =
      getAgentById(agentId, conversationId) ??
      getAgentById("policy_agent", conversationId);

    if (!agent) {
      return NextResponse.json({ error: "No agents available" }, { status: 500 });
    }

    const { response, agentId: usedAgentId, approvalId } = await runAgent(agent, message, conversationId);

    addMessage({
      id: uuidv4(),
      conversationId,
      role: "assistant",
      content: response,
      agentId: usedAgentId,
    });

    const approval = approvalId ? getApprovalStatus(approvalId) : null;

    return NextResponse.json({
      response,
      conversationId,
      agentUsed: {
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
      },
      approval: approval
        ? {
            id: approval.id,
            status: approval.status,
            adminNote: approval.admin_note,
          }
        : null,
      escalated: false,
    });
  } catch (err) {
    console.error("[chat/route] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
