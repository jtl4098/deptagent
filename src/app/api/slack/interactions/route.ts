import { NextResponse } from "next/server";
import {
  verifySlackRequest,
  postMessage,
  updateMessage,
  buildApprovalResultCard,
} from "@/lib/slack";
import { resolveApproval } from "@/db";

export async function POST(req: Request) {
  const { verified, body } = await verifySlackRequest(req);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const params = new URLSearchParams(body);
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  const payload = JSON.parse(payloadStr);

  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    if (!action) return NextResponse.json({ ok: true });

    const actionId = action.action_id as string;
    if (actionId !== "approve_request" && actionId !== "reject_request") {
      return NextResponse.json({ ok: true });
    }

    const value = JSON.parse(action.value);
    const approvalId = value.approvalId as string;
    const slackUserId = value.slackUserId as string;
    const adminUser = payload.user?.id as string;

    const resolution: "approve" | "reject" =
      actionId === "approve_request" ? "approve" : "reject";

    resolveApproval(approvalId, resolution);

    // Update the admin channel message: replace buttons with result
    const message = payload.message;
    if (message) {
      const originalText =
        message.blocks?.[0]?.text?.text ?? message.text ?? "";
      const resultBlocks = buildApprovalResultCard(
        resolution === "approve" ? "approved" : "rejected",
        adminUser,
        originalText
      );
      await updateMessage(
        payload.channel.id,
        message.ts,
        originalText,
        resultBlocks
      );
    }

    // Notify the employee via DM
    const status = resolution === "approve" ? "approved" : "rejected";
    const emoji = resolution === "approve" ? ":white_check_mark:" : ":x:";
    await postMessage(
      slackUserId,
      `${emoji} Your request has been *${status}* by an admin.`
    );
  }

  return NextResponse.json({ ok: true });
}
