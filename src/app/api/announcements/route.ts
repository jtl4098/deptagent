import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getActiveAnnouncements, getAllAnnouncements, createAnnouncement } from "@/db";

export async function GET(req: NextRequest) {
  const active = req.nextUrl.searchParams.get("active");
  const announcements = active === "true" ? getActiveAnnouncements() : getAllAnnouncements();
  return NextResponse.json({ announcements });
}

export async function POST(req: NextRequest) {
  try {
    const { title, content, priority, expiresAt } = await req.json();

    if (!title || !content) {
      return NextResponse.json({ error: "title and content are required" }, { status: 400 });
    }

    const id = uuidv4();
    createAnnouncement({
      id,
      title,
      content,
      priority: priority || "normal",
      expiresAt: expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null,
    });

    return NextResponse.json({ id });
  } catch (err) {
    console.error("[announcements] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
