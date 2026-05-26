import { WebClient, type KnownBlock } from "@slack/web-api";
import crypto from "crypto";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET ?? "";
const ADMIN_CHANNEL = process.env.SLACK_ADMIN_CHANNEL_ID ?? "";

// --- Request verification ---

export async function verifySlackRequest(
  req: Request
): Promise<{ verified: boolean; body: string }> {
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";
  const body = await req.text();

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    return { verified: false, body };
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(sigBasestring)
    .digest("hex");
  const expected = `v0=${hmac}`;

  const verified = crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );

  return { verified, body };
}

// --- Messaging helpers ---

export async function postMessage(
  channel: string,
  text: string,
  blocks?: KnownBlock[]
) {
  return slack.chat.postMessage({ channel, text, blocks });
}

export async function updateMessage(
  channel: string,
  ts: string,
  text: string,
  blocks?: KnownBlock[]
) {
  return slack.chat.update({ channel, ts, text, blocks });
}

// --- Block Kit builders ---

export function buildApprovalCard(approval: {
  id: string;
  employee_name: string;
  request_type: string;
  details: string;
  created_at: number;
}, slackUserId: string) {
  const details = JSON.parse(approval.details);
  const text =
    `*New Approval Request*\n` +
    `*Employee:* <@${slackUserId}>\n` +
    `*Type:* ${approval.request_type}\n` +
    `*Item:* ${details.itemName ?? "N/A"}\n` +
    `*Cost:* $${details.costUsd ?? "N/A"}\n` +
    `*Description:* ${details.description ?? "N/A"}`;

  return {
    text,
    blocks: [
      {
        type: "section" as const,
        text: { type: "mrkdwn" as const, text },
      },
      {
        type: "actions" as const,
        elements: [
          {
            type: "button" as const,
            text: { type: "plain_text" as const, text: "Approve" },
            style: "primary" as const,
            action_id: "approve_request",
            value: JSON.stringify({
              approvalId: approval.id,
              slackUserId,
            }),
          },
          {
            type: "button" as const,
            text: { type: "plain_text" as const, text: "Reject" },
            style: "danger" as const,
            action_id: "reject_request",
            value: JSON.stringify({
              approvalId: approval.id,
              slackUserId,
            }),
          },
        ],
      },
    ] satisfies KnownBlock[],
  };
}

export function buildApprovalResultCard(
  action: "approved" | "rejected",
  adminUser: string,
  originalText: string
) {
  const emoji = action === "approved" ? "white_check_mark" : "x";
  const label = action === "approved" ? "Approved" : "Rejected";

  return [
    {
      type: "section" as const,
      text: { type: "mrkdwn" as const, text: originalText },
    },
    {
      type: "section" as const,
      text: {
        type: "mrkdwn" as const,
        text: `:${emoji}: *${label}* by <@${adminUser}>`,
      },
    },
  ] satisfies KnownBlock[];
}

export { ADMIN_CHANNEL };
