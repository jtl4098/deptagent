import { NextRequest, NextResponse } from "next/server";
import { getRequestType, upsertRequestType, deleteRequestType } from "@/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rt = getRequestType(id);
  if (!rt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ requestType: rt });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { name, description, requiredFields, enabled } = await req.json();
    const existing = getRequestType(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    upsertRequestType({
      id,
      name: name ?? existing.name,
      description: description ?? existing.description,
      required_fields: requiredFields !== undefined ? JSON.stringify(requiredFields) : existing.required_fields,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[request-types] PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteRequestType(id);
  return NextResponse.json({ success: true });
}
