import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  ClipboardCheck,
  Plus,
  MessageSquare,
  Headphones,
  Megaphone,
  BookOpen,
  Settings,
  Wrench,
} from "lucide-react";
import type { AgentConfig, ViewState } from "./shared";

export function Sidebar({
  agents,
  currentView,
  pendingCount,
  openEscalationCount,
  onNavigate,
}: {
  agents: AgentConfig[];
  currentView: ViewState;
  pendingCount: number;
  openEscalationCount: number;
  onNavigate: (view: ViewState) => void;
}) {
  const navButton = (
    view: ViewState,
    icon: React.ReactNode,
    label: string,
    badge?: number
  ) => {
    const isActive = currentView.type === view.type;
    return (
      <button
        onClick={() => onNavigate(view)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
        }`}
      >
        {icon}
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight">
          DeptAgent
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Admin Console</p>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-3 space-y-1">
        {navButton({ type: "dashboard" }, <LayoutDashboard className="h-4 w-4" />, "Dashboard")}
        {navButton({ type: "approvals" }, <ClipboardCheck className="h-4 w-4" />, "Approvals", pendingCount)}
      </nav>

      <Separator className="mx-3" />

      <nav className="px-3 py-3 space-y-1">
        {navButton({ type: "escalations" }, <Headphones className="h-4 w-4" />, "Escalations", openEscalationCount)}
        {navButton({ type: "announcements" }, <Megaphone className="h-4 w-4" />, "Announcements")}
        {navButton({ type: "knowledge" }, <BookOpen className="h-4 w-4" />, "Knowledge Base")}
        {navButton({ type: "request-types" }, <Settings className="h-4 w-4" />, "Request Types")}
        {navButton({ type: "tools" }, <Wrench className="h-4 w-4" />, "Tools")}
      </nav>

      <Separator className="mx-3" />

      {/* Agents Section */}
      <div className="px-3 py-3 flex-1 overflow-hidden flex flex-col">
        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Agents
        </p>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() =>
                  onNavigate({ type: "agent-detail", agentId: agent.id })
                }
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  currentView.type === "agent-detail" &&
                  currentView.agentId === agent.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <span className="text-base">{agent.emoji}</span>
                <span className="truncate flex-1 text-left">{agent.name}</span>
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    agent.enabled ? "bg-green-500" : "bg-gray-500"
                  }`}
                />
              </button>
            ))}
          </div>
        </ScrollArea>

        <button
          onClick={() => onNavigate({ type: "agent-new" })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 transition-colors mt-2"
        >
          <Plus className="h-4 w-4" />
          Add Agent
        </button>
      </div>

      <Separator className="mx-3" />

      {/* Bottom link */}
      <div className="px-3 py-3">
        <a
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          Employee Chat
        </a>
      </div>
    </div>
  );
}
