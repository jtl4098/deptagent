import { NextRequest, NextResponse } from "next/server";
import { getAllTools, upsertTool, getTool } from "@/db";

export async function GET() {
  const tools = getAllTools();
  return NextResponse.json({ tools });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, builtin_key } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: "id and name are required" },
        { status: 400 }
      );
    }

    const existing = getTool(id);
    if (existing) {
      return NextResponse.json(
        { error: `Tool with id '${id}' already exists` },
        { status: 409 }
      );
    }

    upsertTool({
      id,
      name,
      description: description || "",
      tool_type: "builtin",
      builtin_key: builtin_key || id,
      enabled: 1,
    });

    return NextResponse.json({ success: true, tool: getTool(id) }, { status: 201 });
  } catch (err) {
    console.error("[tools/route] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
