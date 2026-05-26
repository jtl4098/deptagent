import { NextRequest, NextResponse } from "next/server";
import { resolveApproval, getApprovalStatus } from "@/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action, note } = await req.json();

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const existing = getApprovalStatus(id);
    if (!existing) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Approval already resolved" }, { status: 409 });
    }

    resolveApproval(id, action, note);

    const updated = getApprovalStatus(id);
    return NextResponse.json({ approval: updated });
  } catch (err) {
    console.error("[approvals/resolve] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
