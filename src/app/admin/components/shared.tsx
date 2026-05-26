import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  FileText,
  AlertTriangle,
} from "lucide-react";

// --- Types ---

export type Approval = {
  id: string;
  conversation_id: string;
  employee_name: string;
  request_type: string;
  details: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: number;
  resolved_at: number | null;
};

export type AgentConfig = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  system_prompt: string;
  type: "general" | "benefits";
  enabled: number;
  created_at: number;
  updated_at: number;
};

export type Stats = {
  agentsEnabled: number;
  agentsTotal: number;
  pendingApprovals: number;
  totalRequests: number;
  totalConversations: number;
  openEscalations: number;
  activeAnnouncements: number;
};

export type PolicyAnalysis = {
  recommendation: "approve" | "reject" | "needs_review";
  confidence: "high" | "medium" | "low";
  reasoning: string;
  references: string[];
  flags: string[];
  summary: string;
};

export type Tool = {
  id: string;
  name: string;
  description: string;
  tool_type: "builtin" | "mcp";
  builtin_key: string | null;
  mcp_config: string | null;
  enabled: number;
  created_at: number;
  updated_at: number;
};

export type ViewState =
  | { type: "dashboard" }
  | { type: "approvals" }
  | { type: "agent-detail"; agentId: string }
  | { type: "agent-new" }
  | { type: "request-types" }
  | { type: "tools" }
  | { type: "escalations" }
  | { type: "escalation-detail"; conversationId: string }
  | { type: "knowledge" }
  | { type: "knowledge-edit"; filename: string }
  | { type: "announcements" };

// --- Constants ---

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export const TYPE_STYLES: Record<string, string> = {
  general: "bg-blue-50 text-blue-700 border-blue-200",
  benefits: "bg-purple-50 text-purple-700 border-purple-200",
};

export const RECOMMENDATION_STYLES: Record<string, { badge: string; border: string }> = {
  approve: {
    badge: "bg-green-50 text-green-700 border-green-200",
    border: "border-l-green-500",
  },
  reject: {
    badge: "bg-red-50 text-red-700 border-red-200",
    border: "border-l-red-500",
  },
  needs_review: {
    badge: "bg-yellow-50 text-yellow-700 border-yellow-200",
    border: "border-l-yellow-500",
  },
};

export const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-red-50 text-red-700 border-red-200",
};

// --- Helpers ---

export function parseDetails(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

export function timeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// --- Analysis Display ---

export function AnalysisDisplay({ analysis }: { analysis: PolicyAnalysis }) {
  const recStyle = RECOMMENDATION_STYLES[analysis.recommendation] ?? RECOMMENDATION_STYLES.needs_review;
  const confStyle = CONFIDENCE_STYLES[analysis.confidence] ?? CONFIDENCE_STYLES.low;

  return (
    <div className={`mt-3 bg-muted/30 border border-border rounded-lg p-3 border-l-4 ${recStyle.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          AI Policy Analysis
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Badge className={`text-xs border ${recStyle.badge}`}>
          {analysis.recommendation.replace("_", " ")}
        </Badge>
        <Badge className={`text-xs border ${confStyle}`}>
          {analysis.confidence} confidence
        </Badge>
      </div>

      <p className="text-sm text-foreground mb-2">{analysis.summary}</p>

      <p className="text-xs text-muted-foreground mb-2">{analysis.reasoning}</p>

      {analysis.references.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1 mb-1">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase">
              References
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {analysis.references.map((ref, i) => (
              <span key={i} className="text-[10px] bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded">
                {ref}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.flags.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3 text-yellow-600" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase">
              Flags
            </span>
          </div>
          {analysis.flags.map((flag, i) => (
            <p key={i} className="text-xs text-yellow-600">{flag}</p>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60 italic">
        AI-generated policy analysis -- not a final decision
      </p>
    </div>
  );
}
