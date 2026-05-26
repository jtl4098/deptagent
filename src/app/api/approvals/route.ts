import { NextRequest, NextResponse } from "next/server";
import { getPendingApprovals, getAllApprovals } from "@/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const approvals = status === "pending" ? getPendingApprovals() : getAllApprovals();

  return NextResponse.json({ approvals });
}
