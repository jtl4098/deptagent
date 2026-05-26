import { tool } from "ai";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createApproval } from "@/db";

type RequestTypeInfo = {
  id: string;
  name: string;
  required_fields: string;
};

export function makeCreateApprovalRequestTool(
  conversationId: string,
  requestTypes?: RequestTypeInfo[]
) {
  const typeIds = requestTypes?.map((rt) => rt.id) ?? [];
  const requestTypeSchema =
    typeIds.length >= 2
      ? z.enum(typeIds as [string, ...string[]]).describe("Category of the request")
      : z.string().describe("Category of the request");

  const inputSchema = z.object({
    employeeName: z.string().describe("Full name of the employee making the request"),
    requestType: requestTypeSchema,
    itemName: z.string().describe("Name of the book, course, certification, or event"),
    description: z
      .string()
      .describe("Brief description of the item and its relevance to the employee's role"),
    costUsd: z.string().describe("Cost in USD (e.g. '300')"),
  });

  type Input = z.infer<typeof inputSchema>;

  const typeList =
    requestTypes && requestTypes.length > 0
      ? `Available request types: ${requestTypes.map((rt) => `${rt.id} (${rt.name})`).join(", ")}`
      : "";

  return tool({
    description: `Submit a Personal Development (PD) budget request for admin approval. Use this when an employee wants to request PD budget for a specific item. ${typeList}`,
    inputSchema,
    execute: async (input: Input) => {
      const approvalId = uuidv4();

      const details = JSON.stringify({
        itemName: input.itemName,
        description: input.description,
        costUsd: parseFloat(input.costUsd) || 0,
      });

      createApproval({
        id: approvalId,
        conversationId,
        employeeName: input.employeeName,
        requestType: input.requestType,
        details,
      });

      const cost = parseFloat(input.costUsd) || 0;
      return {
        approvalId,
        message: `PD request submitted successfully. Approval ID: ${approvalId}. The request for "${input.itemName}" ($${cost}) has been sent to the admin queue for review. You will be notified once a decision is made.`,
      };
    },
  });
}
