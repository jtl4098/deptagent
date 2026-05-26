"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AgentConfig, Tool, ViewState } from "./shared";

export function AgentDetailView({
  agent,
  onRefresh,
  onNavigate,
}: {
  agent: AgentConfig;
  onRefresh: () => void;
  onNavigate: (view: ViewState) => void;
}) {
  const [form, setForm] = useState({
    name: agent.name,
    emoji: agent.emoji,
    description: agent.description,
    system_prompt: agent.system_prompt,
  });
  const [saving, setSaving] = useState(false);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set());
  const [knowledgeFiles, setKnowledgeFiles] = useState<string[]>([]);
  const [selectedKnowledge, setSelectedKnowledge] = useState<Set<string>>(new Set());

  const fetchAgentTools = useCallback(async () => {
    try {
      const [toolsRes, agentToolsRes, knowledgeListRes, agentKnowledgeRes] = await Promise.all([
        fetch("/api/tools"),
        fetch(`/api/agents/${agent.id}/tools`),
        fetch("/api/knowledge"),
        fetch(`/api/agents/${agent.id}/knowledge`),
      ]);
      const toolsData = await toolsRes.json();
      const agentToolsData = await agentToolsRes.json();
      const knowledgeData = await knowledgeListRes.json();
      const agentKnowledgeData = await agentKnowledgeRes.json();
      setAvailableTools(toolsData.tools ?? []);
      setSelectedToolIds(new Set(agentToolsData.toolIds ?? []));
      setKnowledgeFiles((knowledgeData.files ?? []).map((f: { filename: string }) => f.filename));
      setSelectedKnowledge(new Set(agentKnowledgeData.filenames ?? []));
    } catch {
      // ignore
    }
  }, [agent.id]);

  useEffect(() => {
    setForm({
      name: agent.name,
      emoji: agent.emoji,
      description: agent.description,
      system_prompt: agent.system_prompt,
    });
    fetchAgentTools();
  }, [agent, fetchAgentTools]);

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

  const handleKnowledgeToggle = (filename: string) => {
    setSelectedKnowledge((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: agent.id,
          name: form.name,
          emoji: form.emoji,
          description: form.description,
          systemPrompt: form.system_prompt,
        }),
      }),
      fetch(`/api/agents/${agent.id}/tools`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolIds: Array.from(selectedToolIds) }),
      }),
      fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filenames: Array.from(selectedKnowledge) }),
      }),
    ]);
    setSaving(false);
    onRefresh();
  };

  const handleToggleEnabled = async () => {
    await fetch(`/api/agents/${agent.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !agent.enabled }),
    });
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`))
      return;
    await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    onRefresh();
    onNavigate({ type: "dashboard" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{agent.emoji}</span>
          <div>
            <h2 className="text-xl font-bold text-foreground">{agent.name}</h2>
            <p className="text-xs text-muted-foreground">ID: {agent.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              agent.enabled ? "bg-green-500" : "bg-gray-300"
            }`}
            onClick={handleToggleEnabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                agent.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <Button size="sm" variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Name
              </label>
              <input
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Emoji
              </label>
              <input
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              />
            </div>
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
              Knowledge Files
            </label>
            <div className="space-y-2 border border-border rounded-md p-3 bg-background max-h-48 overflow-y-auto">
              {knowledgeFiles.length === 0 && (
                <p className="text-sm text-muted-foreground">No knowledge files available.</p>
              )}
              {knowledgeFiles.map((filename) => (
                <label key={filename} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedKnowledge.has(filename)}
                    onChange={() => handleKnowledgeToggle(filename)}
                    className="rounded border-border"
                  />
                  <span className="font-mono text-xs">{filename}</span>
                </label>
              ))}
            </div>
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
            />
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
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
