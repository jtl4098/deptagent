import { Card, CardContent } from "@/components/ui/card";
import { Bot, Clock, ClipboardCheck, Users, Headphones, Megaphone } from "lucide-react";
import type { Stats } from "./shared";

export function SummaryCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      title: "Agents Enabled",
      value: `${stats.agentsEnabled} / ${stats.agentsTotal}`,
      subtitle: `${stats.agentsEnabled} enabled, ${stats.agentsTotal - stats.agentsEnabled} disabled`,
      icon: Bot,
    },
    {
      title: "Pending Approvals",
      value: stats.pendingApprovals,
      subtitle: "awaiting review",
      icon: Clock,
    },
    {
      title: "Open Escalations",
      value: stats.openEscalations,
      subtitle: "awaiting response",
      icon: Headphones,
    },
    {
      title: "Total Requests",
      value: stats.totalRequests,
      subtitle: "all time",
      icon: ClipboardCheck,
    },
    {
      title: "Conversations",
      value: stats.totalConversations,
      subtitle: "total sessions",
      icon: Users,
    },
    {
      title: "Announcements",
      value: stats.activeAnnouncements,
      subtitle: "currently active",
      icon: Megaphone,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="bg-card border-border shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {card.title}
              </p>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {card.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
