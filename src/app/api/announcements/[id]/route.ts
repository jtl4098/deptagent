import { NextRequest, NextResponse } from "next/server";
import { updateAnnouncement, deleteAnnouncement, getAllAnnouncements } from "@/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const all = getAllAnnouncements();
  const announcement = all.find((a) => a.id === id);
  if (!announcement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ announcement });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { title, content, priority, active, expiresAt } = await req.json();
    updateAnnouncement({
      id,
      title,
      content,
      priority: priority || "normal",
      active: active !== undefined ? (active ? 1 : 0) : 1,
      expiresAt: expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[announcements] PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteAnnouncement(id);
  return NextResponse.json({ success: true });
}
