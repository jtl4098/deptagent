import { NextRequest, NextResponse } from "next/server";
import { getMessages, getEscalationByConversationId } from "@/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = getMessages(id);
  const escalation = getEscalationByConversationId(id);
  return NextResponse.json({ messages, escalation: escalation ?? null });
}
