"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send } from "lucide-react";
import type { ViewState } from "./shared";

type EscalationMessage = {
  id: string;
  role: string;
  content: string;
  agent_id: string | null;
  is_admin_reply: number;
  created_at: number;
};

type EscalationDetail = {
  id: string;
  conversation_id: string;
  reason: string;
  status: "open" | "closed";
  created_at: number;
  resolved_at: number | null;
};

export function EscalationDetailView({
  conversationId,
  onNavigate,
}: {
  conversationId: string;
  onNavigate: (view: ViewState) => void;
}) {
  const [escalation, setEscalation] = useState<EscalationDetail | null>(null);
  const [messages, setMessages] = useState<EscalationMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/escalations/${conversationId}`);
      const data = await res.json();
      setEscalation(data.escalation ?? null);
      setMessages(data.messages ?? []);
    } catch {
      // ignore
    }
  }, [conversationId]);

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 3000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    await fetch(`/api/escalations/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply.trim() }),
    });
    setReply("");
    setSending(false);
    fetchDetail();
  };

  const handleClose = async () => {
    if (!confirm("Close this escalation?")) return;
    await fetch(`/api/escalations/${conversationId}`, { method: "PATCH" });
    fetchDetail();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!escalation) {
    return (
      <div className="text-sm text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="mb-4">
        <button
          onClick={() => onNavigate({ type: "escalations" })}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Escalations
        </button>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Reason: {escalation.reason}
            </p>
            <Badge
              className={`text-xs border ${
                escalation.status === "open"
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                  : "bg-gray-100 text-gray-700 border-gray-200"
              }`}
            >
              {escalation.status}
            </Badge>
          </div>
          {escalation.status === "open" && (
            <Button size="sm" variant="destructive" onClick={handleClose}>
              Close Escalation
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 border border-border rounded-lg p-4 mb-4">
        <div className="space-y-3">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const isAdmin = msg.is_admin_reply === 1;
            const isSystem = msg.content.includes("I've escalated your conversation") ||
              msg.content.includes("has been escalated");

            if (isSystem && !isAdmin) {
              return (
                <div key={msg.id} className="text-center py-2">
                  <p className="text-xs text-muted-foreground italic">{msg.content}</p>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                  {!isUser && (
                    <div className="flex items-center gap-1 mb-1">
                      {isAdmin ? (
                        <Badge className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          Admin
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {msg.agent_id || "Assistant"}
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                      isUser
                        ? "bg-blue-600 text-white"
                        : isAdmin
                          ? "bg-purple-50 border border-purple-200 text-foreground"
                          : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(msg.created_at * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {escalation.status === "open" && (
        <div className="flex gap-2">
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply..."
            disabled={sending}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={sending || !reply.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {escalation.status === "closed" && (
        <p className="text-sm text-muted-foreground text-center py-2">
          This escalation has been closed.
        </p>
      )}
    </div>
  );
}
