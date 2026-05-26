import { NextRequest, NextResponse } from "next/server";
import { getAllRequestTypes, upsertRequestType } from "@/db";

export async function GET() {
  const requestTypes = getAllRequestTypes();
  return NextResponse.json({ requestTypes });
}

export async function POST(req: NextRequest) {
  try {
    const { id, name, description, requiredFields, enabled } = await req.json();

    if (!id || !name) {
      return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    upsertRequestType({
      id,
      name,
      description: description || "",
      required_fields: JSON.stringify(requiredFields || []),
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : 1,
    });

    return NextResponse.json({ id });
  } catch (err) {
    console.error("[request-types] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
