import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  verifySlackRequest,
  postMessage,
  buildApprovalCard,
  ADMIN_CHANNEL,
} from "@/lib/slack";
import {
  createConversation,
  addMessage,
  getApprovalStatus,
  createEscalation,
  getEscalationByConversationId,
  getMessages,
} from "@/db";
import { route } from "@/core/orchestrator";
import { runAgent } from "@/core/agent-runner";
import { getAgentById } from "@/agents";
import { shouldEscalate } from "@/core/escalation-detector";

// Slack retries events if it doesn't get a 200 quickly.
// Track processed event IDs to avoid duplicate processing.
const processedEvents = new Set<string>();

export async function POST(req: Request) {
  const { verified, body } = await verifySlackRequest(req);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // URL verification challenge
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Event callback
  if (payload.type === "event_callback") {
    const event = payload.event;
    const eventId = payload.event_id as string;

    // Deduplicate retried events
    if (processedEvents.has(eventId)) {
      return NextResponse.json({ ok: true });
    }
    processedEvents.add(eventId);
    // Prevent memory leak: cap the set size
    if (processedEvents.size > 1000) {
      const first = processedEvents.values().next().value;
      if (first) processedEvents.delete(first);
    }

    // Only handle DM messages from users (not bots)
    if (event.type === "message" && !event.bot_id && !event.subtype) {
      const slackUserId = event.user as string;
      const channel = event.channel as string;
      const text = event.text as string;

      // Fire-and-forget: process async so we return 200 within 3s
      handleMessage(slackUserId, channel, text).catch((err) =>
        console.error("[slack/events] async handler error:", err)
      );
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleMessage(
  slackUserId: string,
  channel: string,
  text: string
) {
  const conversationId = `slack-${slackUserId}`;

  // Create conversation if it doesn't exist yet
  const existing = getMessages(conversationId);
  if (existing.length === 0) {
    createConversation(conversationId);
  }

  addMessage({
    id: uuidv4(),
    conversationId,
    role: "user",
    content: text,
  });

  // Check for existing open escalation
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
    await postMessage(channel, response);
    return;
  }

  // Check for escalation keywords
  const escalationCheck = shouldEscalate(text);
  if (escalationCheck.escalate) {
    createEscalation({
      id: uuidv4(),
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
    await postMessage(channel, response);

    if (ADMIN_CHANNEL) {
      await postMessage(
        ADMIN_CHANNEL,
        `Escalation from <@${slackUserId}>: ${escalationCheck.reason}`
      );
    }
    return;
  }

  // Route to agent
  const { agent: agentId } = await route(text);
  const agent =
    getAgentById(agentId, conversationId) ??
    getAgentById("policy_agent", conversationId);

  if (!agent) {
    await postMessage(channel, "Sorry, no agents are available right now.");
    return;
  }

  const { response, agentId: usedAgentId, approvalId } = await runAgent(
    agent,
    text,
    conversationId
  );

  addMessage({
    id: uuidv4(),
    conversationId,
    role: "assistant",
    content: response,
    agentId: usedAgentId,
  });

  // Send response to employee DM
  const agentLabel = `[${agent.emoji} ${agent.name}]`;
  await postMessage(channel, `${agentLabel}\n${response}`);

  // If an approval was created, notify admin channel
  if (approvalId && ADMIN_CHANNEL) {
    const approval = getApprovalStatus(approvalId);
    if (approval) {
      // Fetch full approval details for the card
      const { getApprovalById } = await import("@/db");
      const fullApproval = getApprovalById(approvalId);
      if (fullApproval) {
        const card = buildApprovalCard(fullApproval, slackUserId);
        await postMessage(ADMIN_CHANNEL, card.text, card.blocks);
      }
    }
  }
}
