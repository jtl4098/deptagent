"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2 } from "lucide-react";
import {
  type Approval,
  type PolicyAnalysis,
  STATUS_STYLES,
  parseDetails,
  formatDate,
  AnalysisDisplay,
} from "./shared";

function ApprovalRow({
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
    <Card className="mb-4 bg-card border-border shadow-sm">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground">
                {approval.employee_name}
              </span>
              <Badge
                className={`text-xs border ${STATUS_STYLES[approval.status]}`}
              >
                {approval.status}
              </Badge>
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
              <p className="text-sm text-muted-foreground">
                {String(details.description)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(approval.created_at)}
            </p>
            {approval.admin_note && (
              <p className="text-sm mt-1 text-foreground">
                <span className="font-medium">Note: </span>
                {approval.admin_note}
              </p>
            )}
            {approval.resolved_at && (
              <p className="text-xs text-muted-foreground">
                Resolved: {formatDate(approval.resolved_at)}
              </p>
            )}
          </div>
        </div>

        {approval.status === "pending" && (
          <>
            {!analysis && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
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
              </div>
            )}

            {analysis && <AnalysisDisplay analysis={analysis} />}

            <Separator className="my-3" />
            <Textarea
              placeholder="Admin note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mb-2 text-sm bg-background border-border"
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ApprovalsView({
  approvals,
  onResolve,
  analyses,
  analyzingIds,
  onAnalyze,
}: {
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
  const pending = approvals.filter((a) => a.status === "pending");

  return (
    <div className="space-y-4">
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">
            Pending
            {pending.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No pending approvals.
            </p>
          ) : (
            pending.map((a) => (
              <ApprovalRow
                key={a.id}
                approval={a}
                onResolve={onResolve}
                analysis={analyses[a.id]}
                analyzing={analyzingIds.has(a.id)}
                onAnalyze={onAnalyze}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No requests yet.
            </p>
          ) : (
            approvals.map((a) => (
              <ApprovalRow
                key={a.id}
                approval={a}
                onResolve={onResolve}
                analysis={analyses[a.id]}
                analyzing={analyzingIds.has(a.id)}
                onAnalyze={onAnalyze}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
