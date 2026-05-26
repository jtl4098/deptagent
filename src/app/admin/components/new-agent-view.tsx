"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Tool, ViewState } from "./shared";

export function NewAgentView({
  onRefresh,
  onNavigate,
}: {
  onRefresh: () => void;
  onNavigate: (view: ViewState) => void;
}) {
  const [form, setForm] = useState({
    id: "",
    name: "",
    emoji: "",
    description: "",
    system_prompt: "",
  });
  const [saving, setSaving] = useState(false);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set());

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch("/api/tools");
      const data = await res.json();
      setAvailableTools(data.tools ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleToolToggle = (toolId: string) => {
    setSelectedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    setSaving(true);
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id,
        name: form.name,
        emoji: form.emoji || undefined,
        description: form.description,
        systemPrompt: form.system_prompt,
        type: "general",
      }),
    });
    if (res.ok) {
      // Assign tools after agent creation
      if (selectedToolIds.size > 0) {
        await fetch(`/api/agents/${form.id}/tools`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toolIds: Array.from(selectedToolIds) }),
        });
      }
      onRefresh();
      onNavigate({ type: "agent-detail", agentId: form.id });
    } else {
      const err = await res.json();
      alert(err.error || "Failed to create agent");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Create New Agent</h2>

      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                ID
              </label>
              <input
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="e.g. onboarding_agent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Name
              </label>
              <input
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Onboarding Agent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Emoji
            </label>
            <input
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              placeholder="e.g. emoji character"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <input
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Brief description for routing"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tools
            </label>
            <div className="space-y-2 border border-border rounded-md p-3 bg-background">
              {availableTools.filter((t) => t.tool_type === "builtin" && t.enabled).length === 0 && (
                <p className="text-sm text-muted-foreground">No built-in tools available.</p>
              )}
              {availableTools
                .filter((t) => t.tool_type === "builtin" && t.enabled)
                .map((tool) => (
                  <label key={tool.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedToolIds.has(tool.id)}
                      onChange={() => handleToolToggle(tool.id)}
                      className="rounded border-border"
                    />
                    <span className="font-medium">{tool.name}</span>
                    <span className="text-muted-foreground">- {tool.description}</span>
                  </label>
                ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              System Prompt
            </label>
            <Textarea
              className="text-sm font-mono bg-background border-border text-foreground"
              rows={10}
              value={form.system_prompt}
              onChange={(e) =>
                setForm({ ...form, system_prompt: e.target.value })
              }
              placeholder="System prompt for this agent..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onNavigate({ type: "dashboard" })}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !form.id || !form.name}
            >
              {saving ? "Creating..." : "Create Agent"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
