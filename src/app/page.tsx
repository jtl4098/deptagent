"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Info, X, Headphones } from "lucide-react";

type ApprovalInfo = {
  id: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: { id: string; name: string; emoji: string };
  approval?: ApprovalInfo | null;
  isAdminReply?: boolean;
  isEscalation?: boolean;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 border-yellow-300 text-yellow-800",
  approved: "bg-green-100 border-green-300 text-green-800",
  rejected: "bg-red-100 border-red-300 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending Admin Review",
  approved: "Approved",
  rejected: "Rejected",
};

function ApprovalCard({ approval }: { approval: ApprovalInfo }) {
  return (
    <div className={`mt-2 p-3 rounded border text-sm ${STATUS_COLORS[approval.status]}`}>
      <div className="font-semibold">PD Request — {STATUS_LABELS[approval.status]}</div>
      <div className="text-xs mt-1 opacity-70">ID: {approval.id}</div>
      {approval.adminNote && (
        <div className="mt-1">
          <span className="font-medium">Note: </span>
          {approval.adminNote}
        </div>
      )}
    </div>
  );
}

const BANNER_STYLES: Record<string, string> = {
  urgent: "border-l-4 border-l-red-500 bg-red-50 text-red-800",
  high: "border-l-4 border-l-red-500 bg-red-50 text-red-800",
  normal: "border-l-4 border-l-blue-500 bg-blue-50 text-blue-800",
  low: "border-l-4 border-l-gray-400 bg-gray-50 text-gray-700",
};

function AnnouncementBanner({
  announcements,
  dismissed,
  onDismiss,
}: {
  announcements: Announcement[];
  dismissed: Set<string>;
  onDismiss: (id: string) => void;
}) {
  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-1 mb-3">
      {visible.map((ann) => {
        const isUrgent = ann.priority === "urgent" || ann.priority === "high";
        const Icon = isUrgent ? AlertTriangle : Info;
        return (
          <div
            key={ann.id}
            className={`px-3 py-2 text-sm flex items-center gap-2 rounded ${BANNER_STYLES[ann.priority]}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              <span className="font-medium">{ann.title}</span>
              {ann.content && ` — ${ann.content.slice(0, 100)}`}
            </span>
            <button onClick={() => onDismiss(ann.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [isEscalated, setIsEscalated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch("/api/announcements?active=true");
        const data = await res.json();
        setAnnouncements(data.announcements ?? []);
      } catch {
        // ignore
      }
    };
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 30000);
    return () => clearInterval(interval);
  }, []);

  // Poll for escalation replies
  const pollConversation = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      const data = await res.json();
      const msgs: Message[] = (data.messages ?? []).map((m: {
        id: string;
        role: string;
        content: string;
        agent_id: string | null;
        is_admin_reply: number;
      }) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        isAdminReply: m.is_admin_reply === 1,
      }));
      setMessages(msgs);

      if (data.escalation) {
        setIsEscalated(data.escalation.status === "open");
      }
    } catch {
      // ignore
    }
  }, []);

  const pollApprovals = useCallback(async (currentMessages: Message[]) => {
    const pendingIds = currentMessages
      .filter((m) => m.approval?.status === "pending")
      .map((m) => m.approval!.id);

    if (pendingIds.length === 0) return;

    try {
      const res = await fetch("/api/approvals");
      const data = await res.json();
      const approvalMap: Record<string, ApprovalInfo> = {};
      for (const a of data.approvals ?? []) {
        approvalMap[a.id] = { id: a.id, status: a.status, adminNote: a.admin_note };
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.approval && approvalMap[m.approval.id]) {
            return { ...m, approval: approvalMap[m.approval.id] };
          }
          return m;
        })
      );
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    const hasPending = messages.some((m) => m.approval?.status === "pending");

    if (hasPending || isEscalated) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          if (hasPending) pollApprovals(messages);
          if (isEscalated && conversationId) pollConversation(conversationId);
        }, 3000);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [messages, isEscalated, conversationId, pollApprovals, pollConversation]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, conversationId }),
      });

      const data = await res.json();

      if (!conversationId) setConversationId(data.conversationId);

      if (data.escalated) {
        setIsEscalated(true);
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        agent: data.agentUsed ?? undefined,
        approval: data.approval,
        isEscalation: data.escalated,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      scrollToBottom();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "An error occurred. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">HR Assistant</h1>
        <a href="/admin" className="text-sm text-blue-600 hover:underline">
          Admin Dashboard
        </a>
      </div>

      <AnnouncementBanner
        announcements={announcements}
        dismissed={dismissedAnnouncements}
        onDismiss={(id) =>
          setDismissedAnnouncements((prev) => new Set(prev).add(id))
        }
      />

      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-16">
              <p className="text-lg">Hello! I&apos;m your HR Assistant.</p>
              <p className="text-sm mt-2">
                Ask me about company policies or submit a PD budget request.
              </p>
            </div>
          )}
          {messages.map((msg) => {
            // Escalation banner
            if (msg.isEscalation) {
              return (
                <div key={msg.id} className="mb-4 flex justify-center">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800 max-w-[80%] flex items-start gap-2">
                    <Headphones className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{msg.content}</span>
                  </div>
                </div>
              );
            }

            // Admin reply
            if (msg.isAdminReply) {
              return (
                <div key={msg.id} className="mb-4 flex justify-start">
                  <div className="max-w-[80%] flex flex-col items-start">
                    <Badge className="text-xs bg-purple-100 text-purple-800 border-purple-300 mb-1">
                      Admin
                    </Badge>
                    <div className="rounded-lg px-4 py-2 text-sm whitespace-pre-wrap bg-purple-50 text-gray-900">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {msg.role === "assistant" && msg.agent && (
                    <div className="flex items-center gap-1 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {msg.agent.emoji} {msg.agent.name}
                      </Badge>
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.approval && <ApprovalCard approval={msg.approval} />}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-500 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="p-4 border-t flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about HR policies or request PD budget..."
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
