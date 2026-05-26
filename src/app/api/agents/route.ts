import { NextRequest, NextResponse } from "next/server";
import { getAllAgentConfigs, upsertAgentConfig, getAgentConfig } from "@/db";

export async function GET() {
  const agents = getAllAgentConfigs();
  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, emoji, description, systemPrompt, type } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: "id and name are required" },
        { status: 400 }
      );
    }

    const agentType = type && ["general", "benefits"].includes(type) ? type : "general";

    const existing = getAgentConfig(id);
    if (existing) {
      return NextResponse.json(
        { error: `Agent with id '${id}' already exists` },
        { status: 409 }
      );
    }

    upsertAgentConfig({
      id,
      name,
      emoji: emoji || "\u{1F916}",
      description: description || "",
      system_prompt: systemPrompt || "",
      type: agentType,
      enabled: 1,
    });

    return NextResponse.json({ success: true, agent: getAgentConfig(id) }, { status: 201 });
  } catch (err) {
    console.error("[agents/route] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
