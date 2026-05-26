import { NextRequest, NextResponse } from "next/server";
import { getTool, upsertTool, deleteTool } from "@/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const tool = getTool(id);

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  return NextResponse.json({ tool });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = getTool(id);

  if (!existing) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  try {
    const body = await req.json();

    upsertTool({
      id,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      tool_type: existing.tool_type,
      builtin_key: existing.builtin_key,
      mcp_config: existing.mcp_config,
      enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
    });

    return NextResponse.json({ success: true, tool: getTool(id) });
  } catch (err) {
    console.error("[tools/[id]] PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = getTool(id);

  if (!existing) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  deleteTool(id);
  return NextResponse.json({ success: true });
}
