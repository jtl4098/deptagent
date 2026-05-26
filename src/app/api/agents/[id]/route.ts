import { NextRequest, NextResponse } from "next/server";
import { getAgentConfig, upsertAgentConfig, deleteAgentConfig } from "@/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const agent = getAgentConfig(id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = getAgentConfig(id);

  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const body = await req.json();

    upsertAgentConfig({
      id,
      name: body.name ?? existing.name,
      emoji: body.emoji ?? existing.emoji,
      description: body.description ?? existing.description,
      system_prompt: body.systemPrompt ?? existing.system_prompt,
      type: body.type ?? existing.type,
      enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
    });

    return NextResponse.json({ success: true, agent: getAgentConfig(id) });
  } catch (err) {
    console.error("[agents/[id]] PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = getAgentConfig(id);

  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  deleteAgentConfig(id);
  return NextResponse.json({ success: true });
}
