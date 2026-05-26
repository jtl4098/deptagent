"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/sidebar";
import { DashboardView } from "./components/dashboard-view";
import { ApprovalsView } from "./components/approvals-view";
import { AgentDetailView } from "./components/agent-detail-view";
import { NewAgentView } from "./components/new-agent-view";
import { AnnouncementsView } from "./components/announcements-view";
import { RequestTypesView } from "./components/request-types-view";
import { ToolsView } from "./components/tools-view";
import { KnowledgeView } from "./components/knowledge-view";
import { EscalationsView } from "./components/escalations-view";
import { EscalationDetailView } from "./components/escalation-detail-view";
import type { Approval, AgentConfig, Stats, PolicyAnalysis, ViewState } from "./components/shared";

export default function AdminPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [stats, setStats] = useState<Stats>({
    agentsEnabled: 0,
    agentsTotal: 0,
    pendingApprovals: 0,
    totalRequests: 0,
    totalConversations: 0,
    openEscalations: 0,
    activeAnnouncements: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>({
    type: "dashboard",
  });
  const [analyses, setAnalyses] = useState<Record<string, PolicyAnalysis>>({});
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals");
      const data = await res.json();
      setApprovals(data.approvals ?? []);
    } catch {
      // ignore
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data.agents ?? []);
    } catch {
      // ignore
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchApprovals(), fetchAgents(), fetchStats()]).then(() =>
      setLoading(false)
    );
    const interval = setInterval(() => {
      fetchApprovals();
      fetchAgents();
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchApprovals, fetchAgents, fetchStats]);

  const handleResolve = async (
    id: string,
    action: "approve" | "reject",
    note: string
  ) => {
    await fetch(`/api/approvals/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: note || undefined }),
    });
    fetchApprovals();
    fetchStats();
  };

  const handleRefresh = () => {
    fetchAgents();
    fetchStats();
  };

  const handleAnalyze = useCallback(async (id: string) => {
    setAnalyzingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/approvals/${id}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyses((prev) => ({ ...prev, [id]: data.analysis }));
      }
    } catch {
      // ignore
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const currentAgent =
    currentView.type === "agent-detail"
      ? agents.find((a) => a.id === currentView.agentId)
      : null;

  useEffect(() => {
    if (currentView.type === "agent-detail" && !loading && !currentAgent) {
      setCurrentView({ type: "dashboard" });
    }
  }, [currentView, currentAgent, loading]);

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  const viewTitle =
    currentView.type === "dashboard"
      ? "DASHBOARD"
      : currentView.type === "approvals"
        ? "APPROVALS"
        : currentView.type === "agent-new"
          ? "NEW AGENT"
          : currentView.type === "request-types"
            ? "REQUEST TYPES"
            : currentView.type === "tools"
              ? "TOOLS"
              : currentView.type === "escalations"
              ? "ESCALATIONS"
              : currentView.type === "escalation-detail"
                ? `ESCALATION`
                : currentView.type === "knowledge"
                  ? "KNOWLEDGE BASE"
                  : currentView.type === "knowledge-edit"
                    ? `EDITING: ${currentView.filename}`
                    : currentView.type === "announcements"
                      ? "ANNOUNCEMENTS"
                      : currentAgent
                        ? currentAgent.name.toUpperCase()
                        : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        agents={agents}
        currentView={currentView}
        pendingCount={pendingCount}
        openEscalationCount={stats.openEscalations}
        onNavigate={setCurrentView}
      />

      <main className="flex-1 min-w-0">
        <div className="p-6 lg:p-8">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            {viewTitle}
          </h1>

          {currentView.type === "dashboard" && (
            <DashboardView
              stats={stats}
              approvals={approvals}
              onResolve={handleResolve}
              analyses={analyses}
              analyzingIds={analyzingIds}
              onAnalyze={handleAnalyze}
            />
          )}

          {currentView.type === "approvals" && (
            <ApprovalsView
              approvals={approvals}
              onResolve={handleResolve}
              analyses={analyses}
              analyzingIds={analyzingIds}
              onAnalyze={handleAnalyze}
            />
          )}

          {currentView.type === "agent-detail" && currentAgent && (
            <AgentDetailView
              agent={currentAgent}
              onRefresh={handleRefresh}
              onNavigate={setCurrentView}
            />
          )}

          {currentView.type === "agent-new" && (
            <NewAgentView
              onRefresh={handleRefresh}
              onNavigate={setCurrentView}
            />
          )}

          {currentView.type === "announcements" && (
            <AnnouncementsView />
          )}

          {currentView.type === "request-types" && (
            <RequestTypesView />
          )}

          {currentView.type === "tools" && (
            <ToolsView />
          )}

          {currentView.type === "knowledge" && (
            <KnowledgeView onNavigate={setCurrentView} />
          )}

          {currentView.type === "knowledge-edit" && (
            <KnowledgeView
              onNavigate={setCurrentView}
              editingFilename={currentView.filename}
            />
          )}

          {currentView.type === "escalations" && (
            <EscalationsView onNavigate={setCurrentView} />
          )}

          {currentView.type === "escalation-detail" && (
            <EscalationDetailView
              conversationId={currentView.conversationId}
              onNavigate={setCurrentView}
            />
          )}
        </div>
      </main>
    </div>
  );
}
