import { NextRequest, NextResponse } from "next/server";
import { getAgentConfig, getKnowledgeFilesForAgent, setAgentKnowledge } from "@/db";
import { clearKnowledgeCache } from "@/core/knowledge-loader";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const agent = getAgentConfig(id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const filenames = getKnowledgeFilesForAgent(id);
  return NextResponse.json({ filenames });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const agent = getAgentConfig(id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { filenames } = body;

    if (!Array.isArray(filenames)) {
      return NextResponse.json(
        { error: "filenames must be an array" },
        { status: 400 }
      );
    }

    setAgentKnowledge(id, filenames);
    clearKnowledgeCache();
    return NextResponse.json({ success: true, filenames: getKnowledgeFilesForAgent(id) });
  } catch (err) {
    console.error("[agents/[id]/knowledge] PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
