"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones } from "lucide-react";
import type { ViewState } from "./shared";
import { timeAgo } from "./shared";

type Escalation = {
  id: string;
  conversation_id: string;
  reason: string;
  status: "open" | "closed";
  created_at: number;
  resolved_at: number | null;
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-yellow-50 text-yellow-700 border-yellow-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
};

export function EscalationsView({
  onNavigate,
}: {
  onNavigate: (view: ViewState) => void;
}) {
  const [escalations, setEscalations] = useState<Escalation[]>([]);

  const fetchEscalations = useCallback(async () => {
    try {
      const res = await fetch("/api/escalations");
      const data = await res.json();
      setEscalations(data.escalations ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchEscalations();
    const interval = setInterval(fetchEscalations, 5000);
    return () => clearInterval(interval);
  }, [fetchEscalations]);

  const open = escalations.filter((e) => e.status === "open");
  const closed = escalations.filter((e) => e.status === "closed");

  const renderEscalation = (esc: Escalation) => (
    <Card
      key={esc.id}
      className="bg-card border-border shadow-sm mb-3 cursor-pointer hover:border-muted-foreground/50 transition-colors"
      onClick={() => onNavigate({ type: "escalation-detail", conversationId: esc.id })}
    >
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <Headphones className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-foreground">
                {esc.conversation_id.slice(0, 8)}...
              </span>
              <Badge className={`text-xs border ${STATUS_STYLES[esc.status]}`}>
                {esc.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{esc.reason}</p>
            <p className="text-xs text-muted-foreground mt-1">{timeAgo(esc.created_at)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">
            Open
            {open.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {open.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No open escalations.
            </p>
          ) : (
            open.map(renderEscalation)
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4">
          {closed.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No resolved escalations.
            </p>
          ) : (
            closed.map(renderEscalation)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
