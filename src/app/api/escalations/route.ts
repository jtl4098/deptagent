import { NextRequest, NextResponse } from "next/server";
import { getOpenEscalations, getAllEscalations } from "@/db";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const escalations = status === "open" ? getOpenEscalations() : getAllEscalations();
  return NextResponse.json({ escalations });
}
