import { NextRequest, NextResponse } from "next/server";
import { getAgentConfig, getToolIdsForAgent, setAgentTools } from "@/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const agent = getAgentConfig(id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const toolIds = getToolIdsForAgent(id);
  return NextResponse.json({ toolIds });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const agent = getAgentConfig(id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { toolIds } = body;

    if (!Array.isArray(toolIds)) {
      return NextResponse.json(
        { error: "toolIds must be an array" },
        { status: 400 }
      );
    }

    setAgentTools(id, toolIds);
    return NextResponse.json({ success: true, toolIds: getToolIdsForAgent(id) });
  } catch (err) {
    console.error("[agents/[id]/tools] PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
