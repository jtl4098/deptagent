import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getAllEscalations,
  getMessages,
  addMessage,
  resolveEscalation,
} from "@/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const all = getAllEscalations();
  const escalation = all.find((e) => e.id === id);
  if (!escalation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = getMessages(escalation.conversation_id);
  return NextResponse.json({ escalation, messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const all = getAllEscalations();
    const escalation = all.find((e) => e.id === id);
    if (!escalation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    addMessage({
      id: uuidv4(),
      conversationId: escalation.conversation_id,
      role: "assistant",
      content: message,
      isAdminReply: true,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[escalations] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  resolveEscalation(id);
  return NextResponse.json({ success: true });
}
