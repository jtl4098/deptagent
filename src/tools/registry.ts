import { makeCreateApprovalRequestTool } from "./create-approval-request";

type RequestTypeInfo = {
  id: string;
  name: string;
  required_fields: string;
};

export const BUILTIN_TOOLS: Record<
  string,
  { factory: (conversationId: string, requestTypes: RequestTypeInfo[]) => ReturnType<typeof makeCreateApprovalRequestTool> }
> = {
  create_approval_request: {
    factory: (conversationId: string, requestTypes: RequestTypeInfo[]) =>
      makeCreateApprovalRequestTool(conversationId, requestTypes),
  },
};
