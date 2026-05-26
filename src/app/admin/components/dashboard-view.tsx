"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { SummaryCards } from "./summary-cards";
import {
  type Approval,
  type Stats,
  type PolicyAnalysis,
  STATUS_STYLES,
  parseDetails,
  timeAgo,
  AnalysisDisplay,
} from "./shared";

function ApprovalFeedItem({ approval }: { approval: Approval }) {
  const details = parseDetails(approval.details);
  const statusIcon =
    approval.status === "approved" ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : approval.status === "rejected" ? (
      <XCircle className="h-4 w-4 text-red-600" />
    ) : (
      <Clock className="h-4 w-4 text-yellow-600" />
    );

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="mt-0.5">{statusIcon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {approval.employee_name}
          </span>
          <Badge
            className={`text-[10px] border ${STATUS_STYLES[approval.status]}`}
          >
            {approval.status}
          </Badge>
        </div>
        {details && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {String(details.itemName ?? "")}
            {details.costUsd != null && ` - $${details.costUsd}`}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {timeAgo(approval.resolved_at || approval.created_at)}
        </p>
      </div>
    </div>
  );
}

function PendingApprovalCard({
  approval,
  onResolve,
  analysis,
  analyzing,
  onAnalyze,
}: {
  approval: Approval;
  onResolve: (
    id: string,
    action: "approve" | "reject",
    note: string
  ) => Promise<void>;
  analysis?: PolicyAnalysis;
  analyzing?: boolean;
  onAnalyze: (id: string) => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const details = parseDetails(approval.details);

  const handleAction = async (action: "approve" | "reject") => {
    setSubmitting(true);
    await onResolve(approval.id, action, note);
    setSubmitting(false);
  };

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-foreground">
          {approval.employee_name}
        </span>
        <span className="text-xs text-muted-foreground capitalize">
          {approval.request_type}
        </span>
      </div>
      {details && (
        <div className="text-sm text-muted-foreground mb-1">
          <span className="font-medium text-foreground">
            {String(details.itemName ?? "")}
          </span>
          {details.costUsd != null && (
            <span className="ml-2 text-green-700 font-semibold">
              ${String(details.costUsd)}
            </span>
          )}
        </div>
      )}
      {details?.description != null && (
        <p className="text-xs text-muted-foreground mb-2">
          {String(details.description)}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground mb-2">
        {timeAgo(approval.created_at)}
      </p>

      {!analysis && (
        <Button
          size="sm"
          variant="outline"
          className="mb-2 text-xs"
          onClick={() => onAnalyze(approval.id)}
          disabled={analyzing}
        >
          {analyzing ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 mr-1" />
              Analyze with AI
            </>
          )}
        </Button>
      )}

      {analysis && <AnalysisDisplay analysis={analysis} />}

      <Textarea
        placeholder="Admin note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mb-2 mt-2 text-sm bg-background border-border"
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => handleAction("approve")}
          disabled={submitting}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleAction("reject")}
          disabled={submitting}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}

export function DashboardView({
  stats,
  approvals,
  onResolve,
  analyses,
  analyzingIds,
  onAnalyze,
}: {
  stats: Stats;
  approvals: Approval[];
  onResolve: (
    id: string,
    action: "approve" | "reject",
    note: string
  ) => Promise<void>;
  analyses: Record<string, PolicyAnalysis>;
  analyzingIds: Set<string>;
  onAnalyze: (id: string) => void;
}) {
  const resolved = approvals
    .filter((a) => a.status !== "pending")
    .slice(0, 10);
  const pending = approvals.filter((a) => a.status === "pending").slice(0, 10);

  return (
    <div className="space-y-6">
      <SummaryCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resolved.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No resolved requests yet.
              </p>
            ) : (
              resolved.map((a) => <ApprovalFeedItem key={a.id} approval={a} />)
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No pending approvals.
              </p>
            ) : (
              pending.map((a) => (
                <PendingApprovalCard
                  key={a.id}
                  approval={a}
                  onResolve={onResolve}
                  analysis={analyses[a.id]}
                  analyzing={analyzingIds.has(a.id)}
                  onAnalyze={onAnalyze}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
