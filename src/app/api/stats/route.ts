import { NextResponse } from "next/server";
import {
  getAllAgentConfigs,
  getEnabledAgentConfigs,
  getPendingApprovals,
  getAllApprovals,
  getConversationCount,
  getOpenEscalationCount,
  getActiveAnnouncements,
} from "@/db";

export async function GET() {
  const allAgents = getAllAgentConfigs();
  const enabledAgents = getEnabledAgentConfigs();

  return NextResponse.json({
    agentsEnabled: enabledAgents.length,
    agentsTotal: allAgents.length,
    pendingApprovals: getPendingApprovals().length,
    totalRequests: getAllApprovals().length,
    totalConversations: getConversationCount(),
    openEscalations: getOpenEscalationCount(),
    activeAnnouncements: getActiveAnnouncements().length,
  });
}
