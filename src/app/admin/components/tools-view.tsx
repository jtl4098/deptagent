"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, X, MessageSquare, Calendar, TicketCheck, Github } from "lucide-react";
import type { Tool } from "./shared";

const MCP_ICONS: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  TicketCheck: <TicketCheck className="h-5 w-5" />,
  Github: <Github className="h-5 w-5" />,
};

function getMcpIcon(mcpConfig: string | null): React.ReactNode {
  if (!mcpConfig) return null;
  try {
    const config = JSON.parse(mcpConfig);
    return MCP_ICONS[config.icon] ?? null;
  } catch {
    return null;
  }
}

export function ToolsView() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [editing, setEditing] = useState<Tool | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", description: "", builtin_key: "" });
  const [saving, setSaving] = useState(false);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch("/api/tools");
      const data = await res.json();
      setTools(data.tools ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const builtinTools = tools.filter((t) => t.tool_type === "builtin");
  const mcpTools = tools.filter((t) => t.tool_type === "mcp");

  const handleCreate = async () => {
    setSaving(true);
    await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id,
        name: form.name,
        description: form.description,
        builtin_key: form.builtin_key || form.id,
      }),
    });
    setSaving(false);
    setCreating(false);
    resetForm();
    fetchTools();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/tools/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
      }),
    });
    setSaving(false);
    setEditing(null);
    resetForm();
    fetchTools();
  };

  const handleToggleEnabled = async (tool: Tool) => {
    await fetch(`/api/tools/${tool.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !tool.enabled }),
    });
    fetchTools();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tool?")) return;
    await fetch(`/api/tools/${id}`, { method: "DELETE" });
    fetchTools();
  };

  const resetForm = () => {
    setForm({ id: "", name: "", description: "", builtin_key: "" });
  };

  const startEdit = (tool: Tool) => {
    setEditing(tool);
    setCreating(false);
    setForm({ id: tool.id, name: tool.name, description: tool.description, builtin_key: tool.builtin_key || "" });
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    resetForm();
  };

  const cancelForm = () => {
    setCreating(false);
    setEditing(null);
    resetForm();
  };

  const showForm = creating || editing;

  return (
    <div className="space-y-8">
      {/* Built-in Tools Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Built-in Tools</h2>
          {!showForm && (
            <Button size="sm" onClick={startCreate}>
              <Plus className="h-4 w-4 mr-1" />
              New Built-in Tool
            </Button>
          )}
        </div>

        {showForm && (
          <Card className="bg-card border-border">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {creating && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">ID</label>
                    <input
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                      value={form.id}
                      onChange={(e) => setForm({ ...form, id: e.target.value })}
                      placeholder="e.g. my_tool"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. My Tool"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>

              {creating && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Builtin Key</label>
                  <input
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground font-mono"
                    value={form.builtin_key}
                    onChange={(e) => setForm({ ...form, builtin_key: e.target.value })}
                    placeholder="Defaults to ID if empty"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={cancelForm} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={editing ? handleUpdate : handleCreate}
                  disabled={saving || (!editing && (!form.id || !form.name))}
                >
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {builtinTools.map((tool) => (
          <Card key={tool.id} className="bg-card border-border shadow-sm">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{tool.name}</span>
                    {tool.builtin_key && (
                      <Badge className="text-xs border bg-muted/50 text-muted-foreground font-mono">
                        {tool.builtin_key}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      tool.enabled ? "bg-green-500" : "bg-gray-300"
                    }`}
                    onClick={() => handleToggleEnabled(tool)}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tool.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(tool)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(tool.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {builtinTools.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No built-in tools configured.
          </p>
        )}
      </div>

      {/* MCP / External Connectors Section */}
      <div className="space-y-4 opacity-60">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">External Connectors (MCP)</h2>
          <Badge className="text-xs border bg-muted/50 text-muted-foreground">
            Coming Soon
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect external services via Model Context Protocol. Configuration will be available in a future update.
        </p>

        {mcpTools.map((tool) => {
          const icon = getMcpIcon(tool.mcp_config);

          return (
            <Card key={tool.id} className="bg-card border-border shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {icon && (
                      <div className="text-muted-foreground">{icon}</div>
                    )}
                    <div>
                      <span className="font-semibold text-foreground">{tool.name}</span>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed"
                      disabled
                    >
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                    </button>
                    <Button size="sm" variant="outline" disabled className="cursor-not-allowed">
                      Configure
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
